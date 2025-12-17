/**
 * 改良版自動排班演算法
 * 策略：先連續 → 補缺 → 削減 → 公平調整
 */
import { RuleEngine } from "./RuleEngine.js";
import { BalanceStrategy, PreferenceStrategy, PatternStrategy } from "./AIStrategies.js";

const MAX_RUNTIME = 30000;

export class ImprovedAutoScheduler {

    static async run(currentSchedule, staffList, unitSettings, preScheduleData, strategyCode = 'A') {
        console.log(`🚀 改良版 AI 排班啟動: 策略 ${strategyCode}`);
        const startTime = Date.now();

        try {
            const context = this.prepareContext(currentSchedule, staffList, unitSettings, preScheduleData, strategyCode);
            
            // 逐日處理：Phase 1-4
            for (let day = 1; day <= context.daysInMonth; day++) {
                if (Date.now() - startTime > MAX_RUNTIME) {
                    console.warn("⏰ 超時，停止排班");
                    break;
                }
                
                await this.processDayCycle(day, context);
                
                // 每 7 天做一次公平性全域調整
                if (day % 7 === 0) {
                    this.globalFairnessAdjust(context, day);
                }
            }

            const duration = (Date.now() - startTime) / 1000;
            context.logs.push(`✅ 完成 (${duration.toFixed(1)}s)`);

            return { assignments: context.assignments, logs: context.logs };

        } catch (e) {
            console.error(e);
            return { assignments: {}, logs: [`❌ Error: ${e.message}`] };
        }
    }

    /**
     * 針對單一天執行完整循環
     */
    static async processDayCycle(day, context) {
        // Phase 1: 延續前一天（連續性優先）
        this.phase1_Continuation(day, context);
        
        // Phase 2: 補缺班（填補需求缺口）
        this.phase2_FillGaps(day, context);
        
        // Phase 3: 削減多餘人力（避免超編）
        this.phase3_Reduce(day, context);
        
        // Phase 4: 公平性微調（OFF 分配均衡）
        this.phase4_FairnessAdjust(day, context);
    }

    // ========================================
    //  Phase 1: 延續前一天的班別
    // ========================================
    static phase1_Continuation(day, context) {
        context.staffList.forEach(staff => {
            const uid = staff.uid;
            
            // 🔒 跳過預班鎖定
            if (this.isPreScheduleLocked(uid, day, context)) return;
            
            // 🔒 跳過已排班
            if (context.assignments[uid][day]) return;

            const prevShift = context.assignments[uid][day - 1] || 'OFF';
            const isWorking = prevShift !== 'OFF' && prevShift !== 'M_OFF';
            
            // 前一天休假 → 跳過（Phase 2 處理）
            if (!isWorking) return;

            // 檢查連續天數
            const consecutive = this.countConsecutiveWork(uid, day - 1, context);
            const maxCons = staff.constraints?.calculatedMaxConsecutive || 6;

            // 🔥 規則：第 7 天必須休息（除非長假例外）
            if (consecutive >= maxCons) {
                context.assignments[uid][day] = 'OFF';
                context.stats[uid].OFF++;
                context.logs.push(`Day ${day}: ${staff.name} 連${consecutive}天 → 強制休假`);
                return;
            }

            // 🎯 延續同班別（白名單檢查）
            if (context.whitelists[uid].includes(prevShift)) {
                // 驗證間隔 11 小時
                const valid = this.validateShift(uid, day, prevShift, context, staff);
                
                if (valid) {
                    context.assignments[uid][day] = prevShift;
                    context.stats[uid][prevShift]++;
                    return;
                }
            }
            
            // 無法延續 → 暫時跳過，Phase 2 處理
        });
    }

    // ========================================
    //  Phase 2: 補缺班（從上到下填補）
    // ========================================
    static phase2_FillGaps(day, context) {
        const w = new Date(context.year, context.month - 1, day).getDay();
        const currentCounts = this.getDailyShiftCounts(day, context);
        const shiftNeeds = this.calculateShortage(currentCounts, w, context);

        // 依缺口大小排序（缺最多的優先填）
        shiftNeeds.sort((a, b) => b.gap - a.gap);

        context.staffList.forEach(staff => {
            const uid = staff.uid;
            
            // 跳過已排班 & 鎖定
            if (context.assignments[uid][day]) return;
            if (this.isPreScheduleLocked(uid, day, context)) return;

            // 依序嘗試缺班
            for (const need of shiftNeeds) {
                if (need.gap <= 0) continue; // 已滿
                
                const shift = need.shift;
                
                // 白名單檢查
                if (!context.whitelists[uid].includes(shift)) continue;
                
                // 規則驗證
                if (!this.validateShift(uid, day, shift, context, staff)) continue;

                // ✅ 成功排班
                context.assignments[uid][day] = shift;
                context.stats[uid][shift]++;
                need.gap--;
                
                context.logs.push(`Day ${day}: ${staff.name} 補缺 ${shift} (剩餘缺 ${need.gap})`);
                break;
            }
        });
    }

    // ========================================
    //  Phase 3: 削減多餘人力
    // ========================================
    static phase3_Reduce(day, context) {
        const w = new Date(context.year, context.month - 1, day).getDay();
        const currentCounts = this.getDailyShiftCounts(day, context);
        const overStaffed = this.calculateOverStaffing(currentCounts, w, context);

        // 由上到下檢查，移除多餘的人
        overStaffed.forEach(item => {
            let toRemove = item.excess;
            
            for (const staff of context.staffList) {
                if (toRemove <= 0) break;
                
                const uid = staff.uid;
                const currentShift = context.assignments[uid][day];
                
                if (currentShift !== item.shift) continue;
                
                // 🔒 不移除預班鎖定
                if (this.isPreScheduleLocked(uid, day, context)) continue;

                // 🎯 公平性評估：優先移除「休假較少」的人
                const offCount = this.countOffDays(uid, day, context);
                const expectedOff = this.calculateExpectedOff(day, context);
                
                // 若此人休假天數 < 應休天數 → 優先改為 OFF
                if (offCount < expectedOff) {
                    context.assignments[uid][day] = 'OFF';
                    context.stats[uid][currentShift]--;
                    context.stats[uid].OFF++;
                    toRemove--;
                    
                    context.logs.push(`Day ${day}: ${staff.name} ${item.shift}→OFF (削減超編，公平調整)`);
                }
            }
        });
    }

    // ========================================
    //  Phase 4: 公平性微調（當日內部調整）
    // ========================================
    static phase4_FairnessAdjust(day, context) {
        const expectedOff = this.calculateExpectedOff(day, context);
        const adjustments = [];

        // 找出「休假不足」的人員
        context.staffList.forEach(staff => {
            const uid = staff.uid;
            const currentShift = context.assignments[uid][day];
            
            if (!currentShift || currentShift === 'OFF' || currentShift === 'M_OFF') return;
            if (this.isPreScheduleLocked(uid, day, context)) return;

            const offCount = this.countOffDays(uid, day, context);
            const diff = expectedOff - offCount;
            
            // 差距 > 1 天 → 列入調整候選
            if (diff > 1) {
                adjustments.push({ uid, staff, diff, currentShift });
            }
        });

        // 依差距排序（差最多優先）
        adjustments.sort((a, b) => b.diff - a.diff);

        // 🎯 每天最多調整 2 人（避免過度干預）
        const maxAdjust = Math.min(2, adjustments.length);
        
        for (let i = 0; i < maxAdjust; i++) {
            const item = adjustments[i];
            const w = new Date(context.year, context.month - 1, day).getDay();
            const req = context.staffReq[item.currentShift]?.[w] || 0;
            const current = this.getDailyShiftCounts(day, context)[item.currentShift] || 0;
            
            // ✅ 只有在「不會造成缺班」時才調整
            if (current > req) {
                context.assignments[item.uid][day] = 'OFF';
                context.stats[item.uid][item.currentShift]--;
                context.stats[item.uid].OFF++;
                
                context.logs.push(`Day ${day}: ${item.staff.name} 公平調整 ${item.currentShift}→OFF (差${item.diff.toFixed(1)}天)`);
            }
        }
    }

    // ========================================
    //  全域公平性調整（每週一次）
    // ========================================
    static globalFairnessAdjust(context, upToDay) {
        const staffOffStats = [];
        const expectedOff = this.calculateExpectedOff(upToDay, context);

        context.staffList.forEach(staff => {
            const uid = staff.uid;
            const actualOff = this.countOffDays(uid, upToDay + 1, context); // +1 因為已排到當天
            const diff = expectedOff - actualOff;
            
            staffOffStats.push({ uid, staff, actualOff, diff });
        });

        // 找出休假過多和過少的人
        const tooMany = staffOffStats.filter(s => s.diff < -1).sort((a, b) => a.diff - b.diff);
        const tooFew = staffOffStats.filter(s => s.diff > 1).sort((a, b) => b.diff - a.diff);

        context.logs.push(`📊 Week ${Math.ceil(upToDay / 7)} 公平性檢查: 休過多 ${tooMany.length}人, 休過少 ${tooFew.length}人`);

        // 🔄 嘗試在後續 3 天內進行補償（不回溯已排班）
        for (let d = upToDay + 1; d <= Math.min(upToDay + 3, context.daysInMonth); d++) {
            // 給予休假不足者更高的 OFF 優先級（在 Phase 3/4 會用到）
            // 此處僅記錄，實際調整在各 Phase 中進行
        }
    }

    // ========================================
    //  輔助函數
    // ========================================

    static isPreScheduleLocked(uid, day, context) {
        const rules = context.unitSettings?.settings?.rules || {};
        const isLocked = rules.constraints?.guaranteePreSchedule || false;
        
        if (!isLocked) return false;
        
        const preWish = context.preScheduleData?.submissions?.[uid]?.wishes?.[day];
        return !!preWish;
    }

    static countConsecutiveWork(uid, fromDay, context) {
        let count = 0;
        for (let d = fromDay; d >= 1; d--) {
            const shift = context.assignments[uid][d];
            if (shift && shift !== 'OFF' && shift !== 'M_OFF') {
                count++;
            } else {
                break;
            }
        }
        
        // 加上上個月的連續
        if (count === fromDay) {
            count += context.lastMonthConsecutive[uid] || 0;
        }
        
        return count;
    }

    static countOffDays(uid, upToDay, context) {
        let count = 0;
        for (let d = 1; d < upToDay; d++) {
            const shift = context.assignments[uid][d];
            if (shift === 'OFF' || shift === 'M_OFF') count++;
        }
        return count;
    }

    static calculateExpectedOff(currentDay, context) {
        const progress = currentDay / context.daysInMonth;
        return (context.idealOffDays || 8) * progress;
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
            const required = context.staffReq[shift]?.[dayOfWeek] || 0;
            const current = currentCounts[shift] || 0;
            const gap = required - current;
            
            if (gap > 0) {
                needs.push({ shift, required, current, gap });
            }
        });
        return needs;
    }

    static calculateOverStaffing(currentCounts, dayOfWeek, context) {
        const excess = [];
        ['D', 'E', 'N'].forEach(shift => {
            const required = context.staffReq[shift]?.[dayOfWeek] || 0;
            const current = currentCounts[shift] || 0;
            const over = current - required;
            
            if (over > 0) {
                excess.push({ shift, required, current, excess: over });
            }
        });
        return excess;
    }

    static validateShift(uid, day, shift, context, staff) {
        const tempAssign = { ...context.assignments[uid], [day]: shift };
        
        const result = RuleEngine.validateStaff(
            tempAssign,
            day,
            context.shiftDefs,
            { constraints: { minInterval11h: true } },
            staff.constraints,
            context.assignments[uid][0] || 'OFF',
            context.lastMonthConsecutive[uid] || 0
        );
        
        return !result.errors[day];
    }

    // ========================================
    //  Context 準備（與原版相同）
    // ========================================
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
        const staffReq = unitSettings.staffRequirements || { D: [], E: [], N: [] };

        const daysInMonth = new Date(currentSchedule.year, currentSchedule.month, 0).getDate();
        const staffCount = staffList.length;
        let totalWorkSlotsNeeded = 0;

        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(currentSchedule.year, currentSchedule.month - 1, d);
            const w = date.getDay();
            const dailyTotal = (staffReq.D?.[w] || 0) + (staffReq.E?.[w] || 0) + (staffReq.N?.[w] || 0);
            totalWorkSlotsNeeded += dailyTotal;
        }

        let idealOffDays = 0;
        if (staffCount > 0) {
            const totalCapacity = daysInMonth * staffCount;
            const totalOffNeeded = totalCapacity - totalWorkSlotsNeeded;
            idealOffDays = totalOffNeeded / staffCount;
        }

        console.log(`📊 統計：總需求 ${totalWorkSlotsNeeded}，平均每人月休 ${idealOffDays.toFixed(1)} 天`);

        staffList.forEach(s => {
            const uid = s.uid || s.id;
            assignments[uid] = {};
            stats[uid] = { D: 0, E: 0, N: 0, OFF: 0 };

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
            unitSettings,
            preScheduleData
        };
    }
}
