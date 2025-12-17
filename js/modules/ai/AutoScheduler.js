import { RuleEngine } from "./RuleEngine.js";
import { BalanceStrategy, PreferenceStrategy, PatternStrategy } from "../modules/ai/AIStrategies.js";

const MAX_RUNTIME = 60000;

export class AutoScheduler {

    static async run(currentSchedule, staffList, unitSettings, preScheduleData, strategyCode = 'A') {
        console.log(`🚀 改良版 AI 排班啟動: 策略 ${strategyCode}`);
        const startTime = Date.now();

        try {
            const context = this.prepareContext(currentSchedule, staffList, unitSettings, preScheduleData, strategyCode);
            
            // 逐日處理
            for (let day = 1; day <= context.daysInMonth; day++) {
                if (Date.now() - startTime > MAX_RUNTIME) {
                    context.logs.push("⏰ 運算超時，停止排班");
                    break;
                }
                await this.processDayCycle(day, context);
            }

            const duration = (Date.now() - startTime) / 1000;
            context.logs.push(`✅ 策略 ${strategyCode} 完成 (${duration.toFixed(1)}s)`);

            return { assignments: context.assignments, logs: context.logs };

        } catch (e) {
            console.error(e);
            return { assignments: {}, logs: [`❌ Error: ${e.message}`] };
        }
    }

    /**
     * 針對單一天執行完整循環 (Continuity -> Fill -> Trim -> Finalize)
     */
    static async processDayCycle(day, context) {
        // 1. 延續前一天 (優先滿足連續性)
        this.phase1_Continuation(day, context);
        
        // 2. 補缺班 (填補需求缺口)
        this.phase2_FillGaps(day, context);
        
        // 3. 削減多餘人力 (避免超編)
        this.phase3_Reduce(day, context);
        
        // 4. 收尾 (🔥 關鍵：清除所有空白，填入 OFF)
        this.phase4_Finalize(day, context);
    }

    // Phase 1: 延續前一天的班別
    static phase1_Continuation(day, context) {
        context.staffList.forEach(staff => {
            const uid = staff.uid;
            
            // 預班鎖定與已排班跳過
            if (this.isPreScheduleLocked(uid, day, context)) return;
            if (context.assignments[uid][day]) return;

            const prevShift = context.assignments[uid][day - 1] || 'OFF';
            const isWorking = prevShift !== 'OFF' && prevShift !== 'M_OFF';
            
            if (!isWorking) return; // 前天休假，跳過

            // 檢查連續天數
            const consecutive = this.countConsecutiveWork(uid, day - 1, context);
            const maxCons = staff.constraints?.calculatedMaxConsecutive || 6;

            if (consecutive >= maxCons) {
                // 必須休假，不排班 (留給 Phase 4 填 OFF)
                return;
            }

            // 嘗試延續
            if (context.whitelists[uid].includes(prevShift)) {
                if (this.validateShift(uid, day, prevShift, context, staff)) {
                    context.assignments[uid][day] = prevShift;
                    context.stats[uid][prevShift]++;
                }
            }
        });
    }

    // Phase 2: 補缺班 (從缺口最大的班別開始補)
    static phase2_FillGaps(day, context) {
        const w = new Date(context.year, context.month - 1, day).getDay();
        const currentCounts = this.getDailyShiftCounts(day, context);
        const shiftNeeds = this.calculateShortage(currentCounts, w, context);

        // 排序：缺最多的優先填
        shiftNeeds.sort((a, b) => b.gap - a.gap);

        // 隨機打亂員工，避免總是同一人
        const shuffledStaff = [...context.staffList];
        this.shuffleArray(shuffledStaff);

        for (const need of shiftNeeds) {
            let gap = need.gap;
            const shift = need.shift;

            for (const staff of shuffledStaff) {
                if (gap <= 0) break;
                const uid = staff.uid;

                // 跳過已排班、鎖定、白名單不符
                if (context.assignments[uid][day]) continue;
                if (this.isPreScheduleLocked(uid, day, context)) continue;
                if (!context.whitelists[uid].includes(shift)) continue;

                // 驗證規則
                if (this.validateShift(uid, day, shift, context, staff)) {
                    context.assignments[uid][day] = shift;
                    context.stats[uid][shift]++;
                    gap--;
                }
            }
        }
    }

    // Phase 3: 削減多餘人力 (若 Phase 1 延續太多人，這裡修剪)
    static phase3_Reduce(day, context) {
        const w = new Date(context.year, context.month - 1, day).getDay();
        const currentCounts = this.getDailyShiftCounts(day, context);
        const overStaffed = this.calculateOverStaffing(currentCounts, w, context);

        overStaffed.forEach(item => {
            let toRemove = item.excess;
            
            // 找出排該班別的人
            const candidates = context.staffList.filter(s => 
                context.assignments[s.uid][day] === item.shift && 
                !this.isPreScheduleLocked(s.uid, day, context)
            );

            // 排序：優先移除「最應該放假」的人 (例如目前休假少、或這班對他分數低)
            // 這裡簡化：隨機或依休假數
            candidates.sort((a, b) => {
                const offA = this.countOffDays(a.uid, day, context);
                const offB = this.countOffDays(b.uid, day, context);
                return offA - offB; // 休假少的排前面 -> 優先被移除變 OFF
            });

            for (const staff of candidates) {
                if (toRemove <= 0) break;
                
                const uid = staff.uid;
                // 改為 OFF
                context.assignments[uid][day] = 'OFF';
                context.stats[uid][item.shift]--;
                context.stats[uid].OFF++;
                toRemove--;
            }
        });
    }

    // Phase 4: 收尾 (🔥 解決空白問題)
    static phase4_Finalize(day, context) {
        context.staffList.forEach(staff => {
            const uid = staff.uid;
            
            // 如果這一格還是 undefined (沒被延續、沒被抓去補缺)，直接填 OFF
            if (!context.assignments[uid][day]) {
                context.assignments[uid][day] = 'OFF';
                context.stats[uid].OFF++;
            }
        });
    }

    // ========================================
    //  輔助函數
    // ========================================

    static prepareContext(currentSchedule, staffList, unitSettings, preScheduleData, strategyCode) {
        // ... (Context 準備邏輯與前版相同，為節省篇幅省略，請保留原有的 prepareContext) ...
        // 確保 stats 包含 { D:0, E:0, N:0, OFF:0 }
        // 確保預班資料正確載入 assignments
        
        // 這裡僅列出關鍵初始化
        const assignments = {};
        const stats = {};
        const staffReq = unitSettings.staffRequirements || { D: [], E: [], N: [] };
        
        // ... 歷史回溯與白名單生成 ...
        
        // 此處請使用上一版提供的完整 prepareContext 代碼
        return this._prepareContextFullLogic(currentSchedule, staffList, unitSettings, preScheduleData, strategyCode);
    }

    // 內部使用的完整 prepareContext (請將上一版的 prepareContext 內容貼於此)
    static _prepareContextFullLogic(currentSchedule, staffList, unitSettings, preScheduleData, strategyCode) {
        // (請複製上一版 AutoScheduler.js 的 prepareContext 完整內容)
        // 包含 idealOffDays 計算、whitelist 生成等
        
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

        const daysInMonth = new Date(currentSchedule.year, currentSchedule.month, 0).getDate();
        const staffCount = staffList.length;
        let totalWorkSlotsNeeded = 0;

        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(currentSchedule.year, currentSchedule.month - 1, d);
            const w = date.getDay();
            const dailyTotal = (parseInt(staffReq.D?.[w])||0) + (parseInt(staffReq.E?.[w])||0) + (parseInt(staffReq.N?.[w])||0);
            totalWorkSlotsNeeded += dailyTotal;
        }

        let idealOffDays = 0;
        if (staffCount > 0) {
            const totalCapacity = daysInMonth * staffCount;
            idealOffDays = (totalCapacity - totalWorkSlotsNeeded) / staffCount;
        }

        staffList.forEach(s => {
            const uid = s.uid || s.id;
            assignments[uid] = {};
            stats[uid] = { D:0, E:0, N:0, OFF:0 };
            
            const userHistory = historyAssignments[uid] || {};
            const days = Object.keys(userHistory).map(Number).sort((a, b) => b - a);
            
            assignments[uid][0] = days.length > 0 ? userHistory[days[0]] || 'OFF' : 'OFF';
            assignments[uid][-1] = days.length > 1 ? userHistory[days[1]] || 'OFF' : 'OFF';

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
                allowed = wishes.size > 0 ? Array.from(wishes) : ['D', 'E', 'N'];
            }
            if (!allowed.includes('OFF')) allowed.push('OFF');
            whitelists[uid] = allowed;

            if (sub.wishes) {
                Object.entries(sub.wishes).forEach(([d, w]) => {
                    assignments[uid][d] = (w === 'M_OFF' ? 'OFF' : w);
                });
            }

            preferences[uid] = { p1: pref.priority1, p2: pref.priority2, p3: pref.priority3 };
        });

        return {
            year: currentSchedule.year, month: currentSchedule.month, daysInMonth,
            staffList: staffList.map(s => ({ ...s, uid: s.uid || s.id })),
            assignments, preferences, whitelists, stats, lastMonthConsecutive,
            shiftDefs: unitSettings.settings?.shifts || [],
            staffReq, logs: [], startTime: Date.now(), idealOffDays,
            unitSettings, preScheduleData
        };
    }

    static isPreScheduleLocked(uid, day, context) {
        const rules = context.unitSettings?.settings?.rules || {};
        const isLocked = rules.constraints?.guaranteePreSchedule || false;
        if (!isLocked) return false;
        return !!context.preScheduleData?.submissions?.[uid]?.wishes?.[day];
    }

    static countConsecutiveWork(uid, fromDay, context) {
        let count = 0;
        for (let d = fromDay; d >= 1; d--) {
            const shift = context.assignments[uid][d];
            if (shift && shift !== 'OFF' && shift !== 'M_OFF') count++;
            else break;
        }
        if (count === fromDay) count += context.lastMonthConsecutive[uid] || 0;
        return count;
    }

    static countOffDays(uid, day, context) {
        let count = 0;
        for(let d=1; d<day; d++) {
            if(context.assignments[uid][d] === 'OFF' || context.assignments[uid][d] === 'M_OFF') count++;
        }
        return count;
    }

    static getDailyShiftCounts(day, context) {
        const counts = { D: 0, E: 0, N: 0, OFF: 0 };
        context.staffList.forEach(staff => {
            const shift = context.assignments[staff.uid][day];
            if (shift) {
                if (shift === 'M_OFF') counts.OFF++;
                else if (counts[shift] !== undefined) counts[shift]++;
            }
        });
        return counts;
    }

    static calculateShortage(currentCounts, dayOfWeek, context) {
        const needs = [];
        ['D', 'E', 'N'].forEach(shift => {
            const required = parseInt(context.staffReq[shift]?.[dayOfWeek] || 0);
            const current = currentCounts[shift] || 0;
            if (current < required) needs.push({ shift, gap: required - current });
        });
        return needs;
    }

    static calculateOverStaffing(currentCounts, dayOfWeek, context) {
        const excess = [];
        ['D', 'E', 'N'].forEach(shift => {
            const required = parseInt(context.staffReq[shift]?.[dayOfWeek] || 0);
            const current = currentCounts[shift] || 0;
            if (current > required) excess.push({ shift, excess: current - required });
        });
        return excess;
    }

    static validateShift(uid, day, shift, context, staff) {
        const tempAssign = { ...context.assignments[uid], [day]: shift };
        const result = RuleEngine.validateStaff(
            tempAssign, day, context.shiftDefs,
            { constraints: { minInterval11h: true } },
            staff.constraints, context.assignments[uid][0] || 'OFF', context.lastMonthConsecutive[uid] || 0
        );
        return !result.errors[day];
    }

    static shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }
}
