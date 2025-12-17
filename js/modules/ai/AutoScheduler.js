import { RuleEngine } from "./RuleEngine.js";
import { BalanceStrategy, PreferenceStrategy, PatternStrategy } from "./AIStrategies.js";

const MAX_RUNTIME = 60000; // 延長至 60秒 以容納回溯

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

            // 開始排班 (從 Day 1, 第一個人開始)
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

        // 1. 計算每日放假上限 & 全月標準
        const daysInMonth = new Date(currentSchedule.year, currentSchedule.month, 0).getDate();
        const staffCount = staffList.length;
        let totalWorkSlotsNeeded = 0;
        const dailyMaxOff = {}; 

        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(currentSchedule.year, currentSchedule.month - 1, d);
            const w = date.getDay(); 
            const reqD = parseInt(staffReq.D?.[w] || 0);
            const reqE = parseInt(staffReq.E?.[w] || 0);
            const reqN = parseInt(staffReq.N?.[w] || 0);
            const dailyTotalReq = reqD + reqE + reqN;
            totalWorkSlotsNeeded += dailyTotalReq;
            
            // 🔥 每日放假上限 = 總人數 - 需上班人數
            let maxOff = staffCount - dailyTotalReq;
            if (maxOff < 0) maxOff = 0;
            dailyMaxOff[d] = maxOff;
        }

        let idealOffDays = 0;
        if (staffCount > 0) {
            const totalCapacity = daysInMonth * staffCount;
            idealOffDays = (totalCapacity - totalWorkSlotsNeeded) / staffCount;
        }
        if (idealOffDays < 0) idealOffDays = 0;

        // 初始化人員資料
        staffList.forEach(s => {
            const uid = s.uid || s.id;
            assignments[uid] = {};
            
            // ✅ 新增 currentOff 用於即時追蹤
            stats[uid] = { D:0, E:0, N:0, OFF:0, currentOff: 0 };
            
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

            // 設定連續上限
            let myMaxConsecutive = globalMax;
            if (allowLongLeave && s.isLongLeave) myMaxConsecutive = 7;
            if (!s.constraints) s.constraints = {};
            s.constraints.calculatedMaxConsecutive = myMaxConsecutive;

            // 白名單邏輯
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
            
            // 填入預班 (保留 Wish)
            if (sub.wishes) {
                Object.entries(sub.wishes).forEach(([d, w]) => {
                    const val = (w === 'M_OFF' ? 'OFF' : w);
                    assignments[uid][d] = val;
                    // 若是預班休假，預先計入 currentOff (注意：solveRecursive 會再檢查一次，這裡僅做初始化)
                    // 但因為 assignments 是全域的，solveRecursive 會讀到它
                });
            }

            preferences[uid] = { p1: pref.priority1, p2: pref.priority2, p3: pref.priority3 };
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
            dailyMaxOff
        };
    }

    static async solveDay(day, context) {
        if (Date.now() - context.startTime > MAX_RUNTIME) return false;
        if (day > context.daysInMonth) return true;

        // 找出「還沒排班」的人 (預班已經填在 context.assignments 了)
        // 但為了支援回溯，我們需要對所有人都跑一次檢查（若是預班則跳過）
        const pending = context.staffList; // 所有人都進入遞迴鏈
        
        // 每日隨機排序，確保公平性
        // 注意：這裡不能 filter 掉已排班的人，因為需要對照順序
        // 但為了效率，我們可以把「已鎖定預班」的人放到隊列最後面或最前面處理
        // 這裡簡單起見，隨機打亂即可，solveRecursive 內部會檢查鎖定
        this.shuffleArray(pending);

        const success = await this.solveRecursive(day, pending, 0, context);
        
        // 無論當天結果如何，推進到下一天 (因為有 backtracking，這裡 return true 代表這一天解完)
        if (success) {
            return await this.solveDay(day + 1, context);
        } else {
            // 這一整天都無解 (極少發生，除非總人力 < 總需求)
            console.warn(`Day ${day} 無法完全滿足需求，保留部分空缺`);
            return await this.solveDay(day + 1, context);
        }
    }

    // ✅ 增加 backtracks 參數限制回溯次數
    static async solveRecursive(day, list, idx, context, backtracks = { count: 0 }) {
        // 1. 終止條件：當天所有人都排完了
        if (idx >= list.length) return true;
        
        const MAX_BACKTRACKS = 2000; // 限制回溯次數
        if (backtracks.count > MAX_BACKTRACKS) return false; // 放棄治療，接受當前解

        const staff = list[idx];
        const uid = staff.uid;

        // ✅ 4. 預班鎖定檢查 (Guarantee Pre-schedule)
        // 如果這個格子已經有值 (來自預班)，且我們設定要保障它
        // 注意：這裡假設 assignments 在 prepareContext 已經填入了預班
        if (context.assignments[uid][day]) {
            // 檢查是否違反硬性規則 (例如連7)，如果違反，這裡可能需要報錯或強制覆蓋
            // 但依據需求 "保障預班"，我們假設預班是老大，直接跳過
            
            // 需同步更新 stats (因為 prepareContext 只初始化了 0)
            const preShift = context.assignments[uid][day];
            if (preShift === 'OFF' || preShift === 'M_OFF') context.stats[uid].currentOff++;
            else context.stats[uid][preShift] = (context.stats[uid][preShift] || 0) + 1;

            if (await this.solveRecursive(day, list, idx + 1, context, backtracks)) return true;
            
            // 回溯時復原
            if (preShift === 'OFF' || preShift === 'M_OFF') context.stats[uid].currentOff--;
            else context.stats[uid][preShift]--;
            
            return false; // 預班這條路不通，回退
        }

        // --- 動態檢查與候選生成 ---
        
        // 連續上班檢查
        let consecutive = 0;
        for (let d = day - 1; d >= 1; d--) {
            const s = context.assignments[uid][d];
            if (s && s !== 'OFF' && s !== 'M_OFF') consecutive++;
            else break;
        }
        if (consecutive === day - 1) consecutive += context.lastMonthConsecutive[uid];
        const maxCons = staff.constraints.calculatedMaxConsecutive;

        // 統計當天目前狀況
        const w = new Date(context.year, context.month - 1, day).getDay();
        const currentCounts = { D:0, E:0, N:0, OFF:0 };
        context.staffList.forEach(s => {
            const sh = context.assignments[s.uid][day];
            if (sh) {
                if (sh === 'M_OFF') currentCounts['OFF']++;
                else currentCounts[sh] = (currentCounts[sh]||0) + 1;
            }
        });

        // 🔥 1. 每日放假上限檢查 (Hard Cap)
        const maxOffAllowed = context.dailyMaxOff[day];
        const currentOffCount = currentCounts['OFF'];
        const isOffFull = currentOffCount >= maxOffAllowed;

        let candidates = [];

        // 情境 A: 必須休假 (連6)
        if (consecutive >= maxCons) {
            // 即使 OFF 滿了，法規最大，還是得休
            candidates = [{ shift: 'OFF', score: 99999 }];
        } 
        // 情境 B: 正常排班
        else {
            candidates = context.whitelists[uid].map(shift => {
                // ✅ 硬性禁止：若 OFF 滿了，且不是必須休假，直接踢除 OFF 選項
                if (shift === 'OFF' && isOffFull) {
                    return null; // 標記刪除
                }
                return {
                    shift,
                    score: context.StrategyEngine.calculateScore(uid, shift, day, context, currentCounts, w)
                };
            })
            .filter(item => item !== null) // 過濾掉被踢除的 OFF
            .sort((a, b) => b.score - a.score);
        }

        // --- 嘗試填入 ---
        for (const item of candidates) {
            const shift = item.shift;
            
            // 執行填入
            context.assignments[uid][day] = shift;
            
            // ✅ 即時更新 stats (包含 currentOff)
            if (shift === 'OFF') context.stats[uid].currentOff++;
            else context.stats[uid][shift] = (context.stats[uid][shift]||0) + 1;

            const valid = RuleEngine.validateStaff(
                context.assignments[uid], day, context.shiftDefs, 
                { constraints: { minInterval11h: true } }, 
                staff.constraints, context.assignments[uid][0], context.lastMonthConsecutive[uid]
            );

            if (!valid.errors[day]) {
                if (await this.solveRecursive(day, list, idx + 1, context, backtracks)) return true;
            }

            // ❌ 回溯 (Backtrack)
            backtracks.count++;
            if (shift === 'OFF') context.stats[uid].currentOff--;
            else context.stats[uid][shift]--;
            
            delete context.assignments[uid][day];
        }

        // ✅ 3. 若所有選項都失敗 (死路) -> 回傳 false 觸發上一層回溯
        // 不再強制填 OFF，除非是遞迴頂層 (solveDay 會處理殘局)
        return false;
    }

    static shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }
}
