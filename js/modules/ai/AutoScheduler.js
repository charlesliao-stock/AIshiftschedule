import { RuleEngine } from "./RuleEngine.js";
import { BalanceStrategy, PreferenceStrategy, PatternStrategy } from "./AIStrategies.js";

const MAX_RUNTIME = 30000;

export class AutoScheduler {

    static async run(currentSchedule, staffList, unitSettings, preScheduleData, strategyCode = 'A') {
        console.log(`🚀 AI 排班啟動: 策略 ${strategyCode}`);
        const startTime = Date.now();

        try {
            let StrategyEngine = BalanceStrategy;
            if (strategyCode === 'B') StrategyEngine = PreferenceStrategy;
            if (strategyCode === 'C') StrategyEngine = PatternStrategy;

            const context = this.prepareContext(currentSchedule, staffList, unitSettings, preScheduleData, strategyCode);
            context.StrategyEngine = StrategyEngine;

            const success = await this.solveDay(1, context);

            const duration = (Date.now() - startTime) / 1000;
            const status = success ? `成功 (${duration}s)` : "超時/部分完成";
            context.logs.push(`策略 ${strategyCode} ${status}`);

            return { assignments: context.assignments, logs: context.logs };

        } catch (e) {
            console.error(e);
            return { assignments: {}, logs: [`Error: ${e.message}`] };
        }
    }

    static prepareContext(currentSchedule, staffList, unitSettings, preScheduleData, strategyCode) {
        const assignments = {};
        const preferences = {};
        const whitelists = {};
        const stats = {}; 
        const lastMonthConsecutive = {}; 
        const historyAssignments = preScheduleData.assignments || {};

        const rules = unitSettings.settings?.rules || {};
        const globalMax = rules.maxConsecutiveWork || 6;
        const allowLongLeave = rules.constraints?.allowLongLeaveException || false;
        
        const staffReq = unitSettings.staffRequirements || { D:[], E:[], N:[] };

        // --- 1. 計算全月標準與每日限制 ---
        const daysInMonth = new Date(currentSchedule.year, currentSchedule.month, 0).getDate();
        const staffCount = staffList.length;
        let totalWorkSlotsNeeded = 0;
        
        // 儲存每一天的「最大可放假人數」
        const dailyMaxOff = {}; 

        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(currentSchedule.year, currentSchedule.month - 1, d);
            const w = date.getDay(); 
            const reqD = parseInt(staffReq.D?.[w] || 0);
            const reqE = parseInt(staffReq.E?.[w] || 0);
            const reqN = parseInt(staffReq.N?.[w] || 0);
            const dailyTotalReq = reqD + reqE + reqN;
            
            totalWorkSlotsNeeded += dailyTotalReq;
            
            // 🔥 每日放假上限 = 總人數 - 每日需上班人數
            // 例如 15 人 - 需 10 人 = 最多 5 人放假
            let maxOff = staffCount - dailyTotalReq;
            if (maxOff < 0) maxOff = 0; // 防呆
            dailyMaxOff[d] = maxOff;
        }

        // 計算整個月的「平均應放假天數」
        let idealOffDays = 0;
        if (staffCount > 0) {
            const totalCapacity = daysInMonth * staffCount;
            const totalOffNeeded = totalCapacity - totalWorkSlotsNeeded;
            idealOffDays = totalOffNeeded / staffCount;
        }
        if (idealOffDays < 0) idealOffDays = 0;

        console.log(`📊 統計：總需求 ${totalWorkSlotsNeeded}，平均每人月休 ${idealOffDays.toFixed(1)} 天`);

        staffList.forEach(s => {
            const uid = s.uid || s.id;
            assignments[uid] = {};
            stats[uid] = { D:0, E:0, N:0, OFF:0 };
            
            // 歷史回溯
            const userHistory = historyAssignments[uid] || {};
            const days = Object.keys(userHistory).map(Number).sort((a, b) => b - a);
            
            if (days.length > 0) assignments[uid][0] = userHistory[days[0]] || 'OFF';
            else assignments[uid][0] = 'OFF';
            
            if (days.length > 1) assignments[uid][-1] = userHistory[days[1]] || 'OFF';
            else assignments[uid][-1] = 'OFF';

            let cons = 0;
            for (let d of days) {
                const shift = userHistory[d];
                if (shift && shift !== 'OFF' && shift !== 'M_OFF') cons++;
                else break;
            }
            lastMonthConsecutive[uid] = cons;

            let myMaxConsecutive = globalMax;
            if (allowLongLeave && s.isLongLeave) myMaxConsecutive = 7;
            if (!s.constraints) s.constraints = {};
            s.constraints.calculatedMaxConsecutive = myMaxConsecutive;

            // 白名單
            const staticFixed = s.constraints?.allowFixedShift ? s.constraints.fixedShiftConfig : null;
            const sub = preScheduleData.submissions?.[uid] || {};
            const pref = sub.preferences || {};
            const monthlyBatch = pref.batch; 
            
            let allowed = []; 

            if (s.constraints?.isPregnant || s.constraints?.isSpecialStatus) allowed = ['D'];
            else if (monthlyBatch === 'N') allowed = ['N'];
            else if (monthlyBatch === 'E') allowed = ['E'];
            else if (!monthlyBatch && staticFixed === 'N') allowed = ['N'];
            else if (!monthlyBatch && staticFixed === 'E') allowed = ['E'];
            else {
                const wishes = new Set();
                if (pref.priority1) wishes.add(pref.priority1);
                if (pref.priority2) wishes.add(pref.priority2);
                if (pref.priority3) wishes.add(pref.priority3);

                if (wishes.size > 0) allowed = Array.from(wishes);
                else allowed = ['D', 'E', 'N'];
            }
            
            if (!allowed.includes('OFF')) allowed.push('OFF');
            whitelists[uid] = allowed;
            
            if (sub.wishes) {
                Object.entries(sub.wishes).forEach(([d, w]) => {
                    assignments[uid][d] = (w === 'M_OFF' ? 'OFF' : w);
                });
            }

            preferences[uid] = {
                p1: pref.priority1,
                p2: pref.priority2,
                p3: pref.priority3
            };
        });

        return {
            year: currentSchedule.year,
            month: currentSchedule.month,
            daysInMonth,
            staffList: staffList.map(s => ({ ...s, uid: s.uid || s.id })),
            assignments,
            preferences,
            whitelists,
            stats,
            lastMonthConsecutive,
            shiftDefs: unitSettings.settings?.shifts || [],
            staffReq,
            logs: [],
            startTime: Date.now(),
            idealOffDays,
            dailyMaxOff // ✅ 傳入每日放假上限
        };
    }

    static async solveDay(day, context) {
        if (Date.now() - context.startTime > MAX_RUNTIME) return false;
        if (day > context.daysInMonth) return true;

        const pending = context.staffList.filter(s => !context.assignments[s.uid][day]);
        this.shuffleArray(pending);

        const success = await this.solveRecursive(day, pending, 0, context);
        return await this.solveDay(day + 1, context);
    }

    static async solveRecursive(day, list, idx, context) {
        if (idx >= list.length) return true;
        
        const staff = list[idx];
        const uid = staff.uid;
        
        // 1. 連續上班檢查 (個人限制)
        let consecutive = 0;
        for (let d = day - 1; d >= 1; d--) {
            const s = context.assignments[uid][d];
            if (s && s !== 'OFF' && s !== 'M_OFF') consecutive++;
            else break;
        }
        if (consecutive === day - 1) consecutive += context.lastMonthConsecutive[uid];
        const maxCons = staff.constraints.calculatedMaxConsecutive;

        // 2. 統計當天目前狀況 (全域限制)
        const w = new Date(context.year, context.month - 1, day).getDay();
        const currentCounts = { D:0, E:0, N:0, OFF:0 };
        context.staffList.forEach(s => {
            const sh = context.assignments[s.uid][day];
            if (sh) {
                if (sh === 'M_OFF') currentCounts['OFF']++;
                else currentCounts[sh] = (currentCounts[sh]||0) + 1;
            }
        });

        // 🔥 關鍵修正：檢查今日「OFF」名額是否已滿
        const maxOffAllowed = context.dailyMaxOff[day];
        const currentOffCount = currentCounts['OFF'];
        const isOffFull = currentOffCount >= maxOffAllowed;

        let candidates = [];

        // 情況 A: 強制休假 (連6)
        if (consecutive >= maxCons) {
            candidates = [{ shift: 'OFF', score: 99999 }];
        } 
        // 情況 B: 正常排班
        else {
            candidates = context.whitelists[uid].map(shift => {
                // ⛔️ 若今日放假名額已滿，且該員嘗試排 OFF -> 禁止 (給極低分或過濾掉)
                // 除非是 M_OFF (預班強休，上面已處理)
                if (shift === 'OFF' && isOffFull) {
                    return { shift, score: -999999 }; // 絕對不排
                }

                return {
                    shift,
                    score: context.StrategyEngine.calculateScore(uid, shift, day, context, currentCounts, w)
                };
            }).sort((a, b) => b.score - a.score);
        }

        // 3. 嘗試填入
        for (const item of candidates) {
            // 若分數過低 (例如 OFF 名額已滿)，則跳過該選項
            if (item.score < -50000) continue;

            const shift = item.shift;
            
            context.assignments[uid][day] = shift;
            context.stats[uid][shift] = (context.stats[uid][shift]||0) + 1;

            const valid = RuleEngine.validateStaff(
                context.assignments[uid], day, context.shiftDefs, 
                { constraints: { minInterval11h: true } }, 
                staff.constraints, context.assignments[uid][0], context.lastMonthConsecutive[uid]
            );

            if (!valid.errors[day]) {
                if (await this.solveRecursive(day, list, idx + 1, context)) return true;
            }

            context.stats[uid][shift]--;
            delete context.assignments[uid][day];
        }

        // 若無解 (例如必須上班但所有班別都滿了，或者必須休假但額度滿了)
        // 優先權：法規 > 人力需求
        // 若連6，必須休，即使導致當天少人
        if (consecutive >= maxCons) {
            context.assignments[uid][day] = 'OFF';
        } else {
            // 否則，若被迫無解，暫填 OFF 防止死結 (會變成紅字缺人)
            context.assignments[uid][day] = 'OFF';
        }
        return true;
    }

    static shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }
}
