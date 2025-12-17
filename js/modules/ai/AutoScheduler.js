import { RuleEngine } from "./RuleEngine.js";
import { BalanceStrategy, PreferenceStrategy, PatternStrategy } from "./AIStrategies.js";

const MAX_RUNTIME = 60000;

export class AutoScheduler {

    static async run(currentSchedule, staffList, unitSettings, preScheduleData, strategyCode = 'A') {
        console.log(`🚀 AI 排班啟動: 策略 ${strategyCode} (三階段啟發式)`);
        const startTime = Date.now();

        try {
            // 1. 策略選擇
            let StrategyEngine = BalanceStrategy;
            if (strategyCode === 'B') StrategyEngine = PreferenceStrategy;
            if (strategyCode === 'C') StrategyEngine = PatternStrategy;

            // 2. 準備環境
            const context = this.prepareContext(currentSchedule, staffList, unitSettings, preScheduleData, strategyCode);
            context.StrategyEngine = StrategyEngine;

            // 3. 逐日排班 (Day 1 -> End)
            for (let d = 1; d <= context.daysInMonth; d++) {
                if (Date.now() - startTime > MAX_RUNTIME) throw new Error("運算超時");
                await this.solveDayProcedure(d, context);
            }

            const duration = (Date.now() - startTime) / 1000;
            context.logs.push(`策略 ${strategyCode} 完成 (${duration}s)`);

            return { assignments: context.assignments, logs: context.logs };

        } catch (e) {
            console.error(e);
            return { assignments: {}, logs: [`Error: ${e.message}`] };
        }
    }

    // 準備上下文資料 (包含計算總量標準、初始化統計)
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

        // 計算全月標準
        const daysInMonth = new Date(currentSchedule.year, currentSchedule.month, 0).getDate();
        const staffCount = staffList.length;
        let totalWorkSlotsNeeded = 0;
        
        // 每日需求快取
        const dailyReq = {};

        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(currentSchedule.year, currentSchedule.month - 1, d);
            const w = date.getDay(); 
            const reqD = parseInt(staffReq.D?.[w] || 0);
            const reqE = parseInt(staffReq.E?.[w] || 0);
            const reqN = parseInt(staffReq.N?.[w] || 0);
            dailyReq[d] = { D: reqD, E: reqE, N: reqN };
            totalWorkSlotsNeeded += (reqD + reqE + reqN);
        }

        // 計算平均應放假天數
        let idealOffDays = 0;
        if (staffCount > 0) {
            const totalCapacity = daysInMonth * staffCount;
            idealOffDays = (totalCapacity - totalWorkSlotsNeeded) / staffCount;
        }
        if (idealOffDays < 0) idealOffDays = 0;

        staffList.forEach(s => {
            const uid = s.uid || s.id;
            assignments[uid] = {};
            // currentOff 用於即時追蹤放假數
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

            // 連續上班上限
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
            
            // 預班填入 (直接視為已排定)
            if (sub.wishes) {
                Object.entries(sub.wishes).forEach(([d, w]) => {
                    const val = (w === 'M_OFF' ? 'OFF' : w);
                    assignments[uid][d] = val;
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
            dailyReq, // 每日需求表
            logs: [],
            idealOffDays
        };
    }

    // 🔥 核心：單日排班程序 (取代遞迴)
    static async solveDayProcedure(day, context) {
        // Step 0: 鎖定預班 (預班已經在 prepareContext 填入，這裡只需確認不被覆蓋)
        // 我們將針對「尚未排班 (undefined)」的人進行操作

        // Step 1: 延續性優先 (Continuity)
        // 由上往下，先找前一天有上班者，填入與前一天一樣的班
        this.applyContinuityPhase(day, context);

        // Step 2: 填補缺口 (Fill Gaps)
        // 檢查缺班，從白名單中找人填入
        this.fillUnderstaffedPhase(day, context);

        // Step 3: 修剪多餘 (Trim Excess)
        // 檢查多排的班，加入 OFF 公平性策略，調整為 OFF
        this.trimOverstaffedPhase(day, context);

        // Step 4: 收尾 (Finalize)
        // 剩下沒排到的人，全部填 OFF
        this.finalizeDayPhase(day, context);
    }

    // 階段 1: 延續性排班
    static applyContinuityPhase(day, context) {
        const w = new Date(context.year, context.month - 1, day).getDay();

        context.staffList.forEach(staff => {
            const uid = staff.uid;
            // 若已有預班，跳過
            if (context.assignments[uid][day]) return;

            // 檢查前一天
            let prevShift = context.assignments[uid][day - 1];
            if (!prevShift) prevShift = 'OFF'; // 防呆

            // 條件：前一天是上班 (D/E/N)，且非 M_OFF
            const isPrevWorking = prevShift !== 'OFF' && prevShift !== 'M_OFF';
            
            if (isPrevWorking) {
                // 嘗試排入「相同班別」
                const targetShift = prevShift;

                // 檢查 1: 白名單是否允許
                if (!context.whitelists[uid].includes(targetShift)) return;

                // 檢查 2: 合法性 (連7檢查、間隔檢查)
                // 這裡暫時填入，讓 RuleEngine 檢查
                context.assignments[uid][day] = targetShift; 
                
                const valid = RuleEngine.validateStaff(
                    context.assignments[uid], day, context.shiftDefs, 
                    { constraints: { minInterval11h: true } }, 
                    staff.constraints, context.assignments[uid][0], context.lastMonthConsecutive[uid]
                );

                if (valid.errors[day]) {
                    // 若違規 (例如連7)，則撤銷，留給後面處理 (通常會變成 OFF)
                    delete context.assignments[uid][day];
                } else {
                    // 若合法，保留此排班，並更新暫時統計
                    context.stats[uid][targetShift] = (context.stats[uid][targetShift] || 0) + 1;
                }
            }
            // 若前一天是 OFF，跳過 (留給 Step 2 填補)
        });
    }

    // 階段 2: 填補缺口
    static fillUnderstaffedPhase(day, context) {
        const req = context.dailyReq[day]; // { D:4, E:3, N:2 }
        const w = new Date(context.year, context.month - 1, day).getDay();

        ['N', 'E', 'D'].forEach(shiftType => { // 順序可調整，通常 N/E 較難排優先處理
            let currentCount = 0;
            // 計算目前已排人數
            context.staffList.forEach(s => {
                if (context.assignments[s.uid][day] === shiftType) currentCount++;
            });

            // 若缺人
            while (currentCount < req[shiftType]) {
                // 找出所有「尚未排班」且「白名單有此班」的候選人
                let candidates = context.staffList
                    .filter(s => !context.assignments[s.uid][day]) // 尚未排班
                    .filter(s => context.whitelists[s.uid].includes(shiftType)) // 白名單有
                    .map(s => {
                        // 計算分數 (主要看公平性 & 偏好)
                        const score = context.StrategyEngine.calculateScore(s.uid, shiftType, day, context, {}, w);
                        return { staff: s, score };
                    })
                    .sort((a, b) => b.score - a.score); // 分數高者優先

                // 嘗試填入
                let filled = false;
                for (let cand of candidates) {
                    const uid = cand.staff.uid;
                    
                    // 試填
                    context.assignments[uid][day] = shiftType;
                    
                    // 驗證規則
                    const valid = RuleEngine.validateStaff(
                        context.assignments[uid], day, context.shiftDefs, 
                        { constraints: { minInterval11h: true } }, 
                        cand.staff.constraints, context.assignments[uid][0], context.lastMonthConsecutive[uid]
                    );

                    if (!valid.errors[day]) {
                        // 合法，確認填入
                        context.stats[uid][shiftType] = (context.stats[uid][shiftType] || 0) + 1;
                        currentCount++;
                        filled = true;
                        break; // 換下一個缺額
                    } else {
                        // 違規，撤銷
                        delete context.assignments[uid][day];
                    }
                }

                // 若完全找不到人填補 (所有人都有困難)，則跳出 (保留缺額)
                if (!filled) break;
            }
        });
    }

    // 階段 3: 修剪多餘 (加入 OFF 公平性)
    static trimOverstaffedPhase(day, context) {
        const req = context.dailyReq[day];
        const w = new Date(context.year, context.month - 1, day).getDay();

        ['D', 'E', 'N'].forEach(shiftType => {
            // 找出當天排該班別的人
            let assignedStaff = context.staffList.filter(s => context.assignments[s.uid][day] === shiftType);
            let currentCount = assignedStaff.length;

            // 若多排了
            if (currentCount > req[shiftType]) {
                // 排序：找出「最應該放假」的人
                // 使用 calculateScore 算 'OFF' 的分數，分數高代表他很缺假
                // 或者是算 '上班' 的分數，分數低代表他不該上班
                
                let candidates = assignedStaff.map(s => {
                    // 這裡我們計算「改排 OFF」的效益分數
                    // 預班鎖定者不能動
                    const isLocked = preScheduleData.submissions?.[s.uid]?.wishes?.[day];
                    if (isLocked) return { staff: s, score: -99999 }; // 鎖定者不參與修剪

                    const score = context.StrategyEngine.calculateScore(s.uid, 'OFF', day, context, {}, w);
                    return { staff: s, score };
                }).sort((a, b) => b.score - a.score); // 分數高 (最需要OFF) 者排前面

                // 開始修剪
                for (let cand of candidates) {
                    if (currentCount <= req[shiftType]) break; // 修剪完畢
                    if (cand.score === -99999) continue; // 鎖定者跳過

                    const uid = cand.staff.uid;
                    // 將其改為 OFF
                    // 需先扣掉原本的統計
                    context.stats[uid][shiftType]--;
                    
                    context.assignments[uid][day] = 'OFF';
                    context.stats[uid].currentOff++; // 增加休假計數
                    
                    currentCount--;
                }
            }
        });
    }

    // 階段 4: 收尾
    static finalizeDayPhase(day, context) {
        context.staffList.forEach(s => {
            if (!context.assignments[s.uid][day]) {
                context.assignments[s.uid][day] = 'OFF';
                context.stats[s.uid].currentOff++;
            } else {
                // 確保 stats 同步 (如果是 Step 1 填入的，currentOff 還沒加)
                const val = context.assignments[s.uid][day];
                if (val === 'OFF' || val === 'M_OFF') {
                    // 避免重複加 (Step 3 可能加過了) - 簡單解法是重算 stats，或這裡不動作
                    // 因為 Step 1 不會填 OFF，Step 2 填上班，Step 3 填 OFF 有加
                    // 只有「完全沒排到」的人在這裡填 OFF，需要加
                }
            }
        });
        
        // 為了確保 stats 正確，重新掃描一次當天 (防呆)
        context.staffList.forEach(s => {
            const val = context.assignments[s.uid][day];
            if (val === 'OFF' || val === 'M_OFF') {
                // 這裡不需動作，stats 在賦值時維護較好
            }
        });
    }
}
