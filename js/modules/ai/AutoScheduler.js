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

            // 2. 預填包班與預班
            this.prefillFixedShifts(context);

            // 3. 每日步進求解
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
        
        // 讀取人力需求
        const staffReq = unitSettings.staffRequirements || { D:[], E:[], N:[] };

        staffList.forEach(s => {
            const uid = s.uid || s.id;
            assignments[uid] = {};
            stats[uid] = { D:0, E:0, N:0, OFF:0 };
            
            // --- 1. 歷史回溯 (計算連續天數) ---
            const userHistory = historyAssignments[uid] || {};
            const days = Object.keys(userHistory).map(Number).sort((a, b) => b - a);
            
            let lastDayShift = 'OFF';
            let cons = 0;

            if (days.length > 0) {
                const lastDayKey = days[0];
                lastDayShift = userHistory[lastDayKey] || 'OFF';
                for (let d of days) {
                    const shift = userHistory[d];
                    if (shift && shift !== 'OFF' && shift !== 'M_OFF') cons++;
                    else break;
                }
            }
            
            lastMonthConsecutive[uid] = cons;
            assignments[uid][0] = lastDayShift;

            let myMaxConsecutive = globalMax;
            if (allowLongLeave && s.isLongLeave) myMaxConsecutive = 7;
            if (!s.constraints) s.constraints = {};
            s.constraints.calculatedMaxConsecutive = myMaxConsecutive;

            // --- 2. 關鍵修正：嚴格白名單邏輯 (Strict Whitelist) ---
            const staticFixed = s.constraints?.allowFixedShift ? s.constraints.fixedShiftConfig : null; // 靜態包班設定
            const staticLane = s.constraints?.rotatingLane || 'DN'; // 靜態組別 (預設 DN)
            
            // 讀取當月預班偏好
            const sub = preScheduleData.submissions?.[uid] || {};
            const pref = sub.preferences || {};
            const monthlyBatch = pref.batch; // 當月選擇包班
            const monthlyMix = pref.monthlyMix; // 2種 or 3種

            let allowed = []; 

            // (A) 母性保護/特殊身分：最高優先，只排白班
            if (s.constraints?.isPregnant || s.constraints?.isSpecialStatus) {
                allowed = ['D', 'OFF'];
            }
            // (B) 當月選擇包班：次高優先，鎖定該班別
            else if (monthlyBatch === 'N') {
                allowed = ['N', 'OFF'];
            }
            else if (monthlyBatch === 'E') {
                allowed = ['E', 'OFF'];
            }
            // (C) 靜態設定包班 (若當月沒選，但人員屬性是包班)：鎖定
            else if (!monthlyBatch && staticFixed === 'N') {
                allowed = ['N', 'OFF'];
            }
            else if (!monthlyBatch && staticFixed === 'E') {
                allowed = ['E', 'OFF'];
            }
            // (D) 一般輪班 (Rotating)
            else {
                // 基礎：依據靜態組別 (DN 或 DE)
                if (staticLane === 'DE') allowed = ['D', 'E', 'OFF'];
                else allowed = ['D', 'N', 'OFF']; // 預設 DN

                // 動態調整：依據當月偏好擴充
                // 若選擇「混和3種」，則全開
                if (monthlyMix === '3') {
                    allowed = ['D', 'E', 'N', 'OFF'];
                } else {
                    // 若選擇「混和2種」(預設)，檢查 P1/P2 是否有填寫「非組別」的班
                    // 例如：本來是 DN 組，但 P1 填了 E，表示本月想上 E，應允許
                    const wishes = [pref.priority1, pref.priority2, pref.priority3];
                    if (wishes.includes('E') && !allowed.includes('E')) allowed.push('E');
                    if (wishes.includes('N') && !allowed.includes('N')) allowed.push('N');
                    if (wishes.includes('D') && !allowed.includes('D')) allowed.push('D');
                }
            }
            
            whitelists[uid] = allowed;
            
            // --- 3. 填入預班 (Wishes) ---
            if (sub.wishes) {
                Object.entries(sub.wishes).forEach(([d, w]) => {
                    assignments[uid][d] = (w === 'M_OFF' ? 'OFF' : w);
                });
            }

            // --- 4. 讀取偏好 (Preferences) ---
            preferences[uid] = {
                p1: pref.priority1,
                p2: pref.priority2,
                p3: pref.priority3
            };
        });

        return {
            year: currentSchedule.year,
            month: currentSchedule.month,
            daysInMonth: new Date(currentSchedule.year, currentSchedule.month, 0).getDate(),
            staffList: staffList.map(s => ({ ...s, uid: s.uid || s.id })),
            assignments,
            preferences,
            whitelists,
            stats,
            lastMonthConsecutive,
            shiftDefs: unitSettings.settings?.shifts || [],
            staffReq,
            logs: [],
            startTime: Date.now()
        };
    }

    static prefillFixedShifts(context) {
        Object.entries(context.whitelists).forEach(([uid, allowed]) => {
            const workingShift = allowed.find(s => s !== 'OFF');
            // 若白名單只有 [Working, OFF] 兩項，且沒有被預班鎖定，則預填
            // 這樣可以確保包班者優先佔據該班別名額
            if (allowed.length === 2 && workingShift) {
                for (let d = 1; d <= context.daysInMonth; d++) {
                    if (!context.assignments[uid][d]) {
                        context.assignments[uid][d] = workingShift;
                        context.stats[uid][workingShift]++;
                    }
                }
            }
        });
    }

    static async solveDay(day, context) {
        if (Date.now() - context.startTime > MAX_RUNTIME) return false;
        if (day > context.daysInMonth) return true;

        // 隨機打亂順序，避免固定人員總是先被排到
        const pending = context.staffList.filter(s => !context.assignments[s.uid][day]);
        this.shuffleArray(pending);

        const success = await this.solveRecursive(day, pending, 0, context);
        return await this.solveDay(day + 1, context);
    }

    static async solveRecursive(day, list, idx, context) {
        if (idx >= list.length) return true;
        
        const staff = list[idx];
        const uid = staff.uid;
        const w = new Date(context.year, context.month - 1, day).getDay();
        
        // 統計目前當天各班人數
        const currentCounts = {};
        context.staffList.forEach(s => {
            const sh = context.assignments[s.uid][day];
            if (sh && sh !== 'OFF') currentCounts[sh] = (currentCounts[sh]||0) + 1;
        });

        // 根據策略計算分數並排序
        let candidates = context.whitelists[uid].map(shift => ({
            shift,
            score: context.StrategyEngine.calculateScore(uid, shift, day, context, currentCounts, w)
        })).sort((a, b) => b.score - a.score);

        for (const item of candidates) {
            const shift = item.shift;
            
            context.assignments[uid][day] = shift;
            context.stats[uid][shift] = (context.stats[uid][shift]||0) + 1;

            const valid = RuleEngine.validateStaff(
                context.assignments[uid], 
                day, 
                context.shiftDefs, 
                { constraints: { minInterval11h: true } }, 
                staff.constraints,
                context.assignments[uid][0], 
                context.lastMonthConsecutive[uid], 
                day
            );

            if (!valid.errors[day]) {
                if (await this.solveRecursive(day, list, idx + 1, context)) return true;
            }

            // 回溯
            context.stats[uid][shift]--;
            delete context.assignments[uid][day];
        }

        // 若無解，暫填 OFF 以推進
        context.assignments[uid][day] = 'OFF';
        return true;
    }

    static shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }
}
