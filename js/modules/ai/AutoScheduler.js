import { RuleEngine } from "./RuleEngine.js";
import { BalanceStrategy, PreferenceStrategy, PatternStrategy } from "./AIStrategies.js";
import { firebaseService } from "../../services/firebase/FirebaseService.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const MAX_RUNTIME = 30000;

export class AutoScheduler {

    static async run(currentSchedule, staffList, unitSettings, preScheduleData, strategyCode = 'A') {
        console.log(`🚀 AI 排班啟動: 策略 ${strategyCode}`);
        const startTime = Date.now();

        try {
            const db = firebaseService.getDb();
            // 讀取系統設定 (用於週起始日等)
            let systemSettings = { weekStartDay: 1 }; 
            // 實務上可 await getDoc...

            // 1. 選擇策略引擎
            let StrategyEngine = BalanceStrategy;
            if (strategyCode === 'B') StrategyEngine = PreferenceStrategy;
            if (strategyCode === 'C') StrategyEngine = PatternStrategy;

            // 2. 準備 Context
            const context = this.prepareContext(currentSchedule, staffList, unitSettings, preScheduleData, strategyCode);
            context.StrategyEngine = StrategyEngine; // 注入策略

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
        const stats = {}; // 追蹤每人各班別累計數

        staffList.forEach(s => {
            const uid = s.uid || s.id;
            assignments[uid] = {};
            stats[uid] = { D:0, E:0, N:0, OFF:0 };
            
            // --- 核心邏輯 I: 白名單預處理 ---
            // 讀取靜態權限
            const canFixed = s.constraints?.allowFixedShift; 
            const lane = s.constraints?.rotatingLane || 'DN'; // DN(白大) 或 DE(白小)

            // 讀取當月動態選擇 (從 PreSchedule 來的 preferences)
            const sub = preScheduleData.submissions?.[uid] || {};
            const monthlyChoice = sub.preferences?.batch; // 'N', 'E', or null

            let allowed = ['D', 'N', 'OFF']; // 預設 C組 (白+大)

            // 1. 特殊身分
            if (s.constraints?.isPregnant) {
                allowed = ['D', 'OFF'];
            }
            // 2. 包班 (需有權限 + 當月有選)
            else if (canFixed && monthlyChoice === 'N') {
                allowed = ['N', 'OFF'];
            }
            else if (canFixed && monthlyChoice === 'E') {
                allowed = ['E', 'OFF'];
            }
            // 3. 輪班組別
            else if (lane === 'DE') {
                allowed = ['D', 'E', 'OFF'];
            }
            // 預設 DN
            else {
                allowed = ['D', 'N', 'OFF'];
            }

            whitelists[uid] = allowed;
            
            // 填入預班 (鎖定)
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

        // 載入上個月最後一天
        const history = preScheduleData.assignments || {};
        staffList.forEach(s => {
            const uid = s.uid || s.id;
            assignments[uid][0] = 'OFF'; // 簡化，應從 history 讀取
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
            shiftDefs: unitSettings.settings?.shifts || [{code:'D', startTime:'08:00', endTime:'16:00'}, {code:'E', startTime:'16:00', endTime:'00:00'}, {code:'N', startTime:'00:00', endTime:'08:00'}],
            staffReq: unitSettings.staffRequirements || {},
            logs: [],
            startTime: Date.now(),
            maxReachedDay: 0
        };
    }

    static prefillFixedShifts(context) {
        // 對於白名單只有 2 種 (Ex: N + OFF) 的人，若沒填 OFF，就填 N
        Object.entries(context.whitelists).forEach(([uid, allowed]) => {
            const workingShift = allowed.find(s => s !== 'OFF');
            // 若白名單只有 [Working, OFF] 兩項，且當天沒被預班鎖定，則填入
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
        
        // 簡單的超時保護
        if (Date.now() - context.startTime > MAX_RUNTIME) return false;

        const staff = list[idx];
        const uid = staff.uid;
        
        // 根據白名單 + 策略評分
        const w = new Date(context.year, context.month - 1, day).getDay();
        
        // 統計目前當天各班人數
        const currentCounts = {};
        context.staffList.forEach(s => {
            const sh = context.assignments[s.uid][day];
            if (sh && sh !== 'OFF') currentCounts[sh] = (currentCounts[sh]||0) + 1;
        });

        // 評分
        let candidates = context.whitelists[uid].map(shift => ({
            shift,
            score: context.StrategyEngine.calculateScore(uid, shift, day, context, currentCounts, w)
        })).sort((a, b) => b.score - a.score);

        for (const item of candidates) {
            const shift = item.shift;
            
            // 嘗試填入
            context.assignments[uid][day] = shift;
            context.stats[uid][shift] = (context.stats[uid][shift]||0) + 1;

            // 驗證規則
            const valid = RuleEngine.validateStaff(
                context.assignments[uid], 
                day, 
                context.shiftDefs, 
                { constraints: { minInterval11h: true } }, // 強制啟用間隔檢查
                staff.constraints,
                context.assignments[uid][0], 0, day
            );

            if (!valid.errors[day]) {
                if (await this.solveRecursive(day, list, idx + 1, context)) return true;
            }

            // 回溯
            context.stats[uid][shift]--;
            delete context.assignments[uid][day];
        }

        // 若無解，暫填 OFF 以推進 (避免完全卡死)
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
