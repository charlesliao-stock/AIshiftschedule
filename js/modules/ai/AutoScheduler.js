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

            // 預填固定班 (Optional, 視需求開啟，目前建議關閉讓 Solver 統一處理)
            // this.prefillFixedShifts(context);

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

        staffList.forEach(s => {
            const uid = s.uid || s.id;
            assignments[uid] = {};
            stats[uid] = { D:0, E:0, N:0, OFF:0 };
            
            // --- 1. 歷史回溯 (強化版) ---
            const userHistory = historyAssignments[uid] || {};
            // 確保日期是數字並由大到小排序 (31, 30, 29...)
            const days = Object.keys(userHistory).map(Number).sort((a, b) => b - a);
            
            let lastDayShift = 'OFF';
            
            // 設定 Day 0 (上月最後一天) 與 Day -1
            if (days.length > 0) assignments[uid][0] = userHistory[days[0]] || 'OFF';
            else assignments[uid][0] = 'OFF';
            
            if (days.length > 1) assignments[uid][-1] = userHistory[days[1]] || 'OFF';
            else assignments[uid][-1] = 'OFF';

            // 計算上月底連續上班天數
            let cons = 0;
            for (let d of days) {
                const shift = userHistory[d];
                // 只要不是 OFF 或 M_OFF 就視為上班
                if (shift && shift !== 'OFF' && shift !== 'M_OFF') cons++;
                else break; // 遇到休假就中斷
            }
            lastMonthConsecutive[uid] = cons;

            // 上限設定
            let myMaxConsecutive = globalMax;
            if (allowLongLeave && s.isLongLeave) myMaxConsecutive = 7;
            if (!s.constraints) s.constraints = {};
            s.constraints.calculatedMaxConsecutive = myMaxConsecutive;

            // --- 2. 白名單邏輯 (Strict Preference Mode) ---
            const staticFixed = s.constraints?.allowFixedShift ? s.constraints.fixedShiftConfig : null;
            
            const sub = preScheduleData.submissions?.[uid] || {};
            const pref = sub.preferences || {};
            const monthlyBatch = pref.batch; // 包班選擇
            
            let allowed = []; 

            // (A) 特殊身分 / 懷孕：鎖定 D
            if (s.constraints?.isPregnant || s.constraints?.isSpecialStatus) {
                allowed = ['D'];
            }
            // (B) 包班：鎖定該班別
            else if (monthlyBatch === 'N') allowed = ['N'];
            else if (monthlyBatch === 'E') allowed = ['E'];
            else if (!monthlyBatch && staticFixed === 'N') allowed = ['N'];
            else if (!monthlyBatch && staticFixed === 'E') allowed = ['E'];
            // (C) 一般人員：依據偏好動態生成
            else {
                // 收集所有填寫的願望
                const wishes = new Set();
                if (pref.priority1) wishes.add(pref.priority1);
                if (pref.priority2) wishes.add(pref.priority2);
                if (pref.priority3) wishes.add(pref.priority3);

                if (wishes.size > 0) {
                    // ✅ 關鍵修正：如果有填願望，白名單就只包含願望中的班別 (嚴格遵守)
                    allowed = Array.from(wishes);
                } else {
                    // 若完全沒填，才回退到預設全開
                    allowed = ['D', 'E', 'N'];
                }
            }
            
            // 確保 OFF 永遠存在
            if (!allowed.includes('OFF')) allowed.push('OFF');
            whitelists[uid] = allowed;
            
            // 3. 填入預班 (User Wishes)
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

    static async solveDay(day, context) {
        if (Date.now() - context.startTime > MAX_RUNTIME) return false;
        if (day > context.daysInMonth) return true;

        // 隨機打亂，避免排序靠前的人總是先選班
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
        
        // --- 1. 連續上班紅線檢查 (Hard Limit) ---
        let consecutive = 0;
        // 往前追溯當月
        for (let d = day - 1; d >= 1; d--) {
            const s = context.assignments[uid][d];
            if (s && s !== 'OFF' && s !== 'M_OFF') consecutive++;
            else break;
        }
        // 若追溯到1號仍是上班，加上上月累積值
        if (consecutive === day - 1) {
            consecutive += context.lastMonthConsecutive[uid];
        }

        const maxCons = staff.constraints.calculatedMaxConsecutive; // 通常是 6
        let candidates = [];

        // 🔥 修正：若已達到上限 (例如已連6)，當天強制只能選 OFF
        if (consecutive >= maxCons) {
            candidates = [{ shift: 'OFF', score: 10000 }]; 
        } else {
            // 正常評分邏輯
            const currentCounts = {};
            context.staffList.forEach(s => {
                const sh = context.assignments[s.uid][day];
                if (sh && sh !== 'OFF') currentCounts[sh] = (currentCounts[sh]||0) + 1;
            });

            // 取得白名單內的班別並評分
            candidates = context.whitelists[uid].map(shift => ({
                shift,
                score: context.StrategyEngine.calculateScore(uid, shift, day, context, currentCounts, w)
            })).sort((a, b) => b.score - a.score);
        }

        // --- 2. 嘗試填入 ---
        for (const item of candidates) {
            const shift = item.shift;
            
            context.assignments[uid][day] = shift;
            context.stats[uid][shift] = (context.stats[uid][shift]||0) + 1;

            // 再次呼叫 RuleEngine 確保萬無一失 (包含間隔檢查)
            const valid = RuleEngine.validateStaff(
                context.assignments[uid], 
                day, 
                context.shiftDefs, 
                { constraints: { minInterval11h: true } }, 
                staff.constraints,
                context.assignments[uid][0], 
                context.lastMonthConsecutive[uid]
            );

            if (!valid.errors[day]) {
                if (await this.solveRecursive(day, list, idx + 1, context)) return true;
            }

            // 回溯 (Backtrack)
            context.stats[uid][shift]--;
            delete context.assignments[uid][day];
        }

        // 若無合法解，填入 OFF 並強制推進 (這會導致該員當天變成休假，可能會缺工，但不會違法)
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
