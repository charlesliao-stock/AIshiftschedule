import { RuleEngine } from "./RuleEngine.js";
import { BalanceStrategy, PreferenceStrategy, PatternStrategy } from "./AIStrategies.js";
import { firebaseService } from "../../services/firebase/FirebaseService.js";

const MAX_RUNTIME = 30000;

export class AutoScheduler {

    static async run(currentSchedule, staffList, unitSettings, preScheduleData, strategyCode = 'A') {
        console.log(`🚀 AI 排班啟動: 策略 ${strategyCode}`);
        const startTime = Date.now();

        try {
            // 1. 選擇策略引擎
            let StrategyEngine = BalanceStrategy;
            if (strategyCode === 'B') StrategyEngine = PreferenceStrategy;
            if (strategyCode === 'C') StrategyEngine = PatternStrategy;

            // 2. 準備 Context (含歷史回溯與長假判斷)
            const context = this.prepareContext(currentSchedule, staffList, unitSettings, preScheduleData, strategyCode);
            context.StrategyEngine = StrategyEngine;

            // 3. 預填 (包班/預班)
            this.prefillFixedShifts(context);

            // 4. 運算
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
        const lastMonthConsecutive = {}; // 記錄每人上月底已連續上班天數 (決定1號能不能上)
        
        // 讀取全域設定
        const rules = unitSettings.settings?.rules || {};
        const globalMax = rules.maxConsecutiveWork || 6;
        const allowLongLeave = rules.constraints?.allowLongLeaveException || false;

        // 1. 解析歷史資料 (PreSchedule 提供的上月 assignments)
        // 格式預期: { "uid1": { "25": "D", "26": "N", ... "30": "N" } }
        const historyAssignments = preScheduleData.assignments || {};

        staffList.forEach(s => {
            const uid = s.uid || s.id;
            assignments[uid] = {};
            stats[uid] = { D:0, E:0, N:0, OFF:0 };
            
            // --- A. 歷史回溯邏輯 (Spec 1: 判斷 1號 是否為第 7 天) ---
            const userHistory = historyAssignments[uid] || {};
            // 取得所有日期並由大到小排序 (31, 30, 29...)
            const days = Object.keys(userHistory).map(Number).sort((a, b) => b - a);
            
            let lastDayShift = 'OFF';
            let cons = 0;

            if (days.length > 0) {
                const lastDayKey = days[0]; // 上月最後一天
                lastDayShift = userHistory[lastDayKey] || 'OFF';
                
                // 往回追溯，計算連續上班天數
                for (let d of days) {
                    const shift = userHistory[d];
                    if (shift && shift !== 'OFF' && shift !== 'M_OFF') {
                        cons++;
                    } else {
                        break; // 一旦遇到 OFF 就停止計數
                    }
                }
            }
            
            // 將計算結果存入
            lastMonthConsecutive[uid] = cons;
            // 將上月最後一天狀態寫入第 0 天 (供 RuleEngine 判斷銜接)
            assignments[uid][0] = lastDayShift;


            // --- B. 決定該員本月連續上班上限 (Spec 4: 長假例外) ---
            // 若全域開啟例外 且 該員是長假身分 -> 上限自動設為 7
            let myMaxConsecutive = globalMax;
            if (allowLongLeave && s.isLongLeave) {
                myMaxConsecutive = 7;
            }
            
            // 將計算後的上限注入 constraints (不汙染原始資料，僅本次運算有效)
            if (!s.constraints) s.constraints = {};
            s.constraints.calculatedMaxConsecutive = myMaxConsecutive;


            // --- C. 白名單預處理 ---
            const canFixed = s.constraints?.allowFixedShift; 
            const lane = s.constraints?.rotatingLane || 'DN'; 
            const sub = preScheduleData.submissions?.[uid] || {};
            const monthlyChoice = sub.preferences?.batch; 

            let allowed = ['D', 'N', 'OFF']; 

            if (s.constraints?.isPregnant) {
                allowed = ['D', 'OFF'];
            }
            else if (canFixed && monthlyChoice === 'N') {
                allowed = ['N', 'OFF'];
            }
            else if (canFixed && monthlyChoice === 'E') {
                allowed = ['E', 'OFF'];
            }
            else if (lane === 'DE') {
                allowed = ['D', 'E', 'OFF'];
            }
            else {
                allowed = ['D', 'N', 'OFF'];
            }
            whitelists[uid] = allowed;
            
            // 填入預班
            if (sub.wishes) {
                Object.entries(sub.wishes).forEach(([d, w]) => {
                    assignments[uid][d] = (w === 'M_OFF' ? 'OFF' : w);
                });
            }

            preferences[uid] = {
                p1: sub.preferences?.priority1,
                p2: sub.preferences?.priority2
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
            lastMonthConsecutive, // 傳入 Context 供遞迴使用
            shiftDefs: unitSettings.settings?.shifts || [],
            staffReq: unitSettings.staffRequirements || {},
            logs: [],
            startTime: Date.now(),
            maxReachedDay: 0
        };
    }

    static prefillFixedShifts(context) {
        Object.entries(context.whitelists).forEach(([uid, allowed]) => {
            const workingShift = allowed.find(s => s !== 'OFF');
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

        const pending = context.staffList.filter(s => !context.assignments[s.uid][day]);
        this.shuffleArray(pending);

        const success = await this.solveRecursive(day, pending, 0, context);
        return await this.solveDay(day + 1, context);
    }

    static async solveRecursive(day, list, idx, context) {
        if (idx >= list.length) return true;
        if (Date.now() - context.startTime > MAX_RUNTIME) return false;

        const staff = list[idx];
        const uid = staff.uid;
        const w = new Date(context.year, context.month - 1, day).getDay();
        
        const currentCounts = {};
        context.staffList.forEach(s => {
            const sh = context.assignments[s.uid][day];
            if (sh && sh !== 'OFF') currentCounts[sh] = (currentCounts[sh]||0) + 1;
        });

        let candidates = context.whitelists[uid].map(shift => ({
            shift,
            score: context.StrategyEngine.calculateScore(uid, shift, day, context, currentCounts, w)
        })).sort((a, b) => b.score - a.score);

        for (const item of candidates) {
            const shift = item.shift;
            
            context.assignments[uid][day] = shift;
            context.stats[uid][shift] = (context.stats[uid][shift]||0) + 1;

            // 驗證規則 (傳入 AutoScheduler 計算出的上月連續天數)
            const valid = RuleEngine.validateStaff(
                context.assignments[uid], 
                day, 
                context.shiftDefs, 
                { constraints: { minInterval11h: true } }, 
                staff.constraints,
                context.assignments[uid][0], // 上月最後一班
                context.lastMonthConsecutive[uid], // 上月連續天數
                day
            );

            if (!valid.errors[day]) {
                if (await this.solveRecursive(day, list, idx + 1, context)) return true;
            }

            context.stats[uid][shift]--;
            delete context.assignments[uid][day];
        }

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
