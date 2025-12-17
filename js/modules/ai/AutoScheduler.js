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

            // ⚠️ 修正：不再呼叫 prefillFixedShifts 進行強制填滿
            // 讓 solveDay 逐日決定，才能觸發「連6休1」的檢查

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
            
            // 1. 歷史回溯
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

            // 2. 白名單邏輯
            const staticFixed = s.constraints?.allowFixedShift ? s.constraints.fixedShiftConfig : null;
            const staticLane = s.constraints?.rotatingLane || 'DN';
            
            const sub = preScheduleData.submissions?.[uid] || {};
            const pref = sub.preferences || {};
            const monthlyBatch = pref.batch;
            const monthlyMix = pref.monthlyMix;

            let allowed = []; 

            // (A) 特殊身分
            if (s.constraints?.isPregnant || s.constraints?.isSpecialStatus) {
                allowed = ['D', 'OFF'];
            }
            // (B) 包班 (鎖定班別，但此處不強制填滿，交由 solver 決定何時休假)
            else if (monthlyBatch === 'N') allowed = ['N', 'OFF'];
            else if (monthlyBatch === 'E') allowed = ['E', 'OFF'];
            else if (!monthlyBatch && staticFixed === 'N') allowed = ['N', 'OFF'];
            else if (!monthlyBatch && staticFixed === 'E') allowed = ['E', 'OFF'];
            // (C) 一般人員
            else {
                if (staticLane === 'DE') allowed = ['D', 'E', 'OFF'];
                else allowed = ['D', 'N', 'OFF']; 

                if (monthlyMix === '3') {
                    allowed = ['D', 'E', 'N', 'OFF'];
                } else {
                    const wishes = [pref.priority1, pref.priority2, pref.priority3];
                    if (wishes.includes('E') && !allowed.includes('E')) allowed.push('E');
                    if (wishes.includes('N') && !allowed.includes('N')) allowed.push('N');
                    if (wishes.includes('D') && !allowed.includes('D')) allowed.push('D');
                    // 預設全開，避免無班可排
                    if (allowed.length < 4) allowed = ['D', 'E', 'N', 'OFF'];
                }
            }
            
            whitelists[uid] = allowed;
            
            // 3. 填入預班 (User Wishes) - 這是使用者自己填的，予以保留
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

    // ⚠️ 移除 prefillFixedShifts 方法，避免邏輯干擾

    static async solveDay(day, context) {
        if (Date.now() - context.startTime > MAX_RUNTIME) return false;
        if (day > context.daysInMonth) return true;

        // 隨機排序，確保公平性
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
        
        // --- 關鍵修正：動態檢查連續上班天數 ---
        let consecutive = 0;
        // 往前追溯
        for (let d = day - 1; d >= 1; d--) {
            const s = context.assignments[uid][d];
            if (s && s !== 'OFF' && s !== 'M_OFF') consecutive++;
            else break;
        }
        if (consecutive === day - 1) {
            consecutive += context.lastMonthConsecutive[uid];
        }

        const maxCons = staff.constraints.calculatedMaxConsecutive;
        let candidates = [];

        // 🔥 紅線規則：若已連上 6 天，當天強制只能排 OFF
        if (consecutive >= maxCons) {
            candidates = [{ shift: 'OFF', score: 9999 }]; 
        } else {
            // 正常評分
            const currentCounts = {};
            context.staffList.forEach(s => {
                const sh = context.assignments[s.uid][day];
                if (sh && sh !== 'OFF') currentCounts[sh] = (currentCounts[sh]||0) + 1;
            });

            candidates = context.whitelists[uid].map(shift => ({
                shift,
                score: context.StrategyEngine.calculateScore(uid, shift, day, context, currentCounts, w)
            })).sort((a, b) => b.score - a.score);
        }

        // 嘗試填入
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
                context.lastMonthConsecutive[uid]
            );

            if (!valid.errors[day]) {
                if (await this.solveRecursive(day, list, idx + 1, context)) return true;
            }

            // 回溯
            context.stats[uid][shift]--;
            delete context.assignments[uid][day];
        }

        // 無解時填 OFF 防止當機 (但通常上面會有 OFF 選項)
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
