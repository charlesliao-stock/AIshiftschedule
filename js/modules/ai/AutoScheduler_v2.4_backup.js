import { RuleEngine } from "./RuleEngine.js";

const MAX_RUNTIME = 60000;

export class AutoScheduler {

    static async run(currentSchedule, staffList, unitSettings, preScheduleData, strategyCode = 'A') {
        console.log(`🚀 AI 排班啟動 (v2.4 偏好與班次平衡版): 策略 ${strategyCode}`);
        const startTime = Date.now();

        try {
            const context = this.prepareContext(currentSchedule, staffList, unitSettings, preScheduleData);

            // 🎯 子步驟 1：準備工作
            this.step1_Preparation(context);

            // 🔄 逐日排班
            for (let day = 1; day <= context.daysInMonth; day++) {
                if (Date.now() - startTime > MAX_RUNTIME) {
                    context.logs.push("⚠️ 運算超時，提前結束");
                    break;
                }

                if (day > 1) {
                    this.step2B_RetroactiveOFF(context, day - 1);
                }

                this.step2A_ScheduleToday(context, day);
            }

            // 🎯 子步驟 3：月底收尾與最終平衡
            if (context.daysInMonth > 0) {
                this.step2B_RetroactiveOFF(context, context.daysInMonth);
                this.step3_Finalize(context);
                
                // ✅ v2.4 強化版：多階段全月總平衡
                this.enhancedGlobalBalance(context);
            }

            return {
                assignments: context.assignments,
                logs: context.logs
            };

        } catch (error) {
            console.error("AutoScheduler Error:", error);
            throw error;
        }
    }

    // =========================================================================
    // 🛠️ 初始化
    // =========================================================================

    static prepareContext(schedule, staffList, unitSettings, preSchedule) {
        const assignments = {};
        const stats = {};
        const preferences = {}; 
        
        const allShifts = unitSettings.settings?.shifts?.map(s => s.code) || ['D', 'E', 'N'];

        staffList.forEach(staff => {
            const uid = staff.uid;
            assignments[uid] = {};
            stats[uid] = { 
                OFF: 0, 
                consecutive: 0,
                lastShift: null,
                weekendShifts: 0  // 新增：假日班次統計
            };
            
            allShifts.forEach(s => stats[uid][s] = 0);

            const sub = preSchedule?.submissions?.[uid];
            preferences[uid] = sub?.preferences || {};
        });
        
        return {
            year: schedule.year,
            month: schedule.month,
            daysInMonth: new Date(schedule.year, schedule.month, 0).getDate(),
            assignments,
            staffList,
            stats,
            preferences, 
            wishes: preSchedule?.submissions || {}, 
            staffReq: unitSettings.staffRequirements || {}, 
            settings: unitSettings.settings || {},
            rules: unitSettings.rules || {},
            logs: [],
            totalManDays: 0,
            avgLeaveTarget: 0,
            dailyLeaveQuotas: {}
        };
    }

    // =========================================================================
    // 🎯 Step 1: 準備
    // =========================================================================
    static step1_Preparation(context) {
        const { staffList, staffReq, daysInMonth } = context;
        const staffCount = staffList.length;
        const totalManDays = staffCount * daysInMonth;
        let totalReqDays = 0;
        const dailyReq = {}; 

        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(context.year, context.month - 1, d);
            const dayOfWeek = date.getDay();
            let daySum = 0;
            ['D', 'E', 'N'].forEach(shift => {
                daySum += (staffReq[shift]?.[dayOfWeek] || 0);
            });
            dailyReq[d] = daySum;
            totalReqDays += daySum;
        }

        const totalLeaveQuota = totalManDays - totalReqDays;
        context.avgLeaveTarget = Math.floor(totalLeaveQuota / (staffCount || 1));
        
        for (let d = 1; d <= daysInMonth; d++) {
            context.dailyLeaveQuotas[d] = staffCount - dailyReq[d];
        }
    }

    // =========================================================================
    // 🔄 Step 2A: 排今天的班
    // =========================================================================
    static step2A_ScheduleToday(context, day) {
        const { staffList } = context;
        const blankList = []; 

        const sortedStaff = [...staffList].sort((a, b) => {
            const offA = context.stats[a.uid].OFF;
            const offB = context.stats[b.uid].OFF;
            return offA - offB;
        });

        for (const staff of sortedStaff) {
            if (this.checkPreSchedule(context, staff, day)) continue;

            let whitelist = this.generateWhitelist(context, staff);
            whitelist = this.filterWhitelistRules(context, staff, day, whitelist);

            if (this.tryContinuePreviousShift(context, staff, day, whitelist)) continue;

            blankList.push({ staff, whitelist });
        }

        this.fillBlanks(context, day, blankList);
    }

    static checkPreSchedule(context, staff, day) {
        const wishes = context.wishes[staff.uid]?.wishes || {};
        const wish = wishes[day];

        if (!wish) return false; 

        if (wish === 'OFF' || wish === 'M_OFF') {
            this.assign(context, staff.uid, day, 'OFF');
            return true;
        }

        const prevShift = this.getShift(context, staff.uid, day - 1);
        if (RuleEngine.checkShiftInterval(prevShift, wish, this.getShiftMap(context.settings), 660)) {
            this.assign(context, staff.uid, day, wish);
            return true;
        } else {
            return false; 
        }
    }

    static generateWhitelist(context, staff) {
        let list = ['D', 'E', 'N', 'OFF'];
        const constraints = staff.constraints || {};
        const prefs = context.preferences[staff.uid] || {};

        if (constraints.isPregnant || constraints.isPostpartum) {
            list = list.filter(s => s !== 'N');
        }

        // ✅ v2.4 改進：區分強弱偏好
        const p1 = prefs.priority1;  // 強偏好
        const p2 = prefs.priority2;  // 弱偏好

        if (p1 || p2) {
            const preferred = ['OFF'];
            
            // 強偏好（priority1）始終保留
            if (p1 && list.includes(p1)) {
                preferred.push(p1);
            }
            
            // 弱偏好（priority2）也加入
            if (p2 && list.includes(p2) && !preferred.includes(p2)) {
                preferred.push(p2);
            }
            
            // 檢查平衡度
            const currentOff = context.stats[staff.uid].OFF;
            const avgTarget = context.avgLeaveTarget;
            const daysPassed = Object.keys(context.assignments[staff.uid]).length;
            const expectedOff = Math.floor((avgTarget / context.daysInMonth) * daysPassed);
            
            // ✅ 放寬條件：只在嚴重落後（5天以上）時才完全開放
            // 輕微落後（3-5天）時，保留強偏好但開放其他選項
            if (currentOff < expectedOff - 5) {
                // 嚴重落後：完全開放
                list = ['D', 'E', 'N', 'OFF'];
                if (constraints.isPregnant || constraints.isPostpartum) {
                    list = list.filter(s => s !== 'N');
                }
            } else if (currentOff < expectedOff - 3) {
                // 輕微落後：保留強偏好，但開放其他班別
                if (p1) preferred.push(...['D', 'E', 'N'].filter(s => s !== p1 && list.includes(s)));
                list = preferred;
            } else {
                // 正常或領先：嚴格遵守偏好
                list = preferred;
            }
        }

        return list;
    }

    static filterWhitelistRules(context, staff, day, whitelist) {
        const prevShift = this.getShift(context, staff.uid, day - 1);
        const shiftMap = this.getShiftMap(context.settings);
        const currentConsecutive = context.stats[staff.uid].consecutive;
        
        const maxCons = staff.constraints?.maxConsecutive || context.rules.maxWorkDays || 6;

        if (currentConsecutive >= maxCons) {
            return ['OFF']; 
        }

        return whitelist.filter(shift => {
            if (shift === 'OFF') return true;

            if (!RuleEngine.checkShiftInterval(prevShift, shift, shiftMap, 660)) {
                return false;
            }
            return true;
        });
    }

    static tryContinuePreviousShift(context, staff, day, whitelist) {
        const prevShift = this.getShift(context, staff.uid, day - 1);
        if (['D', 'E', 'N'].includes(prevShift) && whitelist.includes(prevShift)) {
            this.assign(context, staff.uid, day, prevShift);
            return true;
        }
        return false;
    }

    static fillBlanks(context, day, blankList) {
        const { staffReq } = context;
        const dayOfWeek = new Date(context.year, context.month - 1, day).getDay();

        const currentCounts = { D: 0, E: 0, N: 0 };
        Object.values(context.assignments).forEach(shifts => {
            if (shifts[day] && currentCounts[shifts[day]] !== undefined) {
                currentCounts[shifts[day]]++;
            }
        });

        blankList.sort((a, b) => {
            const offA = context.stats[a.staff.uid].OFF;
            const offB = context.stats[b.staff.uid].OFF;
            return offA - offB;
        });

        for (const item of blankList) {
            const { staff, whitelist } = item;
            
            const deficits = ['D', 'E', 'N'].map(shift => ({
                shift, 
                deficit: (staffReq[shift]?.[dayOfWeek] || 0) - currentCounts[shift]
            }));
            deficits.sort((a, b) => b.deficit - a.deficit);

            let assigned = 'OFF'; 
            
            for (const d of deficits) {
                if (d.deficit > 0 && whitelist.includes(d.shift)) {
                    assigned = d.shift;
                    break;
                }
            }
            
            this.assign(context, staff.uid, day, assigned);
            if (assigned !== 'OFF') currentCounts[assigned]++;
        }
    }

    // =========================================================================
    // ⏪ Step 2B: 回溯標記 OFF
    // =========================================================================
    static step2B_RetroactiveOFF(context, targetDay) {
        const { assignments, staffReq, dailyLeaveQuotas, stats } = context;
        const dayOfWeek = new Date(context.year, context.month - 1, targetDay).getDay();

        const currentCounts = { D: 0, E: 0, N: 0 };
        const staffByShift = { D: [], E: [], N: [] };

        Object.keys(assignments).forEach(uid => {
            const shift = assignments[uid][targetDay];
            if (['D', 'E', 'N'].includes(shift)) {
                currentCounts[shift]++;
                staffByShift[shift].push(uid);
            }
        });

        const overstaffedShifts = [];
        ['D', 'E', 'N'].forEach(shift => {
            const req = staffReq[shift]?.[dayOfWeek] || 0;
            if (currentCounts[shift] > req) {
                overstaffedShifts.push({ shift, count: currentCounts[shift] - req });
            }
        });

        if (overstaffedShifts.length === 0) return;

        for (const item of overstaffedShifts) {
            let { shift, count } = item;
            let candidates = staffByShift[shift].map(uid => context.staffList.find(s => s.uid === uid));
            
            candidates = candidates.filter(s => !this.isLocked(context, s.uid, targetDay));

            candidates.sort((a, b) => stats[a.uid].OFF - stats[b.uid].OFF);

            const maxOff = dailyLeaveQuotas[targetDay] || 0;
            let currentOffCount = Object.values(assignments).filter(sch => sch[targetDay] === 'OFF' || sch[targetDay] === 'M_OFF').length;

            const toRemove = [];
            for (const staff of candidates) {
                if (count <= 0) break;
                if (currentOffCount >= maxOff) break;

                const d2Shift = this.getShift(context, staff.uid, targetDay - 1);
                const d3Shift = this.getShift(context, staff.uid, targetDay - 2);
                const isWork2 = ['D','E','N'].includes(d2Shift);
                const isOff3 = d3Shift === 'OFF';

                if (isWork2 && isOff3) continue; 

                toRemove.push(staff.uid);
                count--;
                currentOffCount++;
            }

            toRemove.forEach(uid => {
                this.assign(context, uid, targetDay, 'OFF');
            });
        }
    }

    // =========================================================================
    // ✅ v2.4 新增：多階段全月總平衡
    // =========================================================================
    static enhancedGlobalBalance(context) {
        console.log("🔄 開始 v2.4 多階段全月平衡...");
        
        // 階段 1：平衡 OFF 總數
        this.balanceOFF(context);
        
        // 階段 2：分別平衡小夜班（E）
        this.balanceSpecificShift(context, 'E', '小夜');
        
        // 階段 3：分別平衡大夜班（N）
        this.balanceSpecificShift(context, 'N', '大夜');
        
        // 階段 4：平衡假日班次
        this.balanceWeekendShifts(context);
        
        // 階段 5：優化偏好滿足度
        this.optimizePreferences(context);
        
        console.log("✅ v2.4 全月平衡完成");
    }
    
    // 階段 1：平衡 OFF 總數
    static balanceOFF(context) {
        const { staffList, assignments, stats, daysInMonth } = context;
        
        console.log("  📊 階段 1: 平衡 OFF 總數");
        
        const maxIterations = 5;
        for (let iteration = 0; iteration < maxIterations; iteration++) {
            let swapCount = 0;
            
            const offStats = staffList.map(staff => ({
                uid: staff.uid,
                staff: staff,
                off: stats[staff.uid].OFF
            }));
            
            const avgOff = offStats.reduce((sum, s) => sum + s.off, 0) / offStats.length;
            const stdOff = Math.sqrt(offStats.reduce((sum, s) => sum + Math.pow(s.off - avgOff, 2), 0) / offStats.length);
            
            console.log(`    第 ${iteration + 1} 輪: 平均 OFF=${avgOff.toFixed(1)}, 標準差=${stdOff.toFixed(2)}`);
            
            if (stdOff < 1.5) {
                console.log("    ✅ OFF 平衡度已達標");
                break;
            }
            
            const sorted = [...offStats].sort((a, b) => a.off - b.off);
            const overworked = sorted.slice(0, Math.ceil(sorted.length * 0.4));
            const underworked = sorted.slice(-Math.ceil(sorted.length * 0.4)).reverse();
            
            for (const busyUser of overworked) {
                let swappedThisUser = false;
                
                for (let d = 1; d <= daysInMonth && !swappedThisUser; d++) {
                    const shift = assignments[busyUser.uid][d];
                    
                    if (!['D','E','N'].includes(shift) || this.isLocked(context, busyUser.uid, d)) {
                        continue;
                    }
                    
                    for (const freeUser of underworked) {
                        if (busyUser.uid === freeUser.uid) continue;
                        
                        if (assignments[freeUser.uid][d] !== 'OFF' || this.isLocked(context, freeUser.uid, d)) {
                            continue;
                        }
                        
                        if (this.canSwap(context, busyUser.uid, freeUser.uid, d, shift)) {
                            this.assign(context, busyUser.uid, d, 'OFF');
                            this.assign(context, freeUser.uid, d, shift);
                            swapCount++;
                            swappedThisUser = true;
                            break;
                        }
                    }
                }
            }
            
            console.log(`    本輪交換次數: ${swapCount}`);
            
            if (swapCount === 0) {
                console.log("    ⚠️ 無法進一步優化 OFF");
                break;
            }
        }
    }
    
    // 階段 2&3：平衡特定班次（E 或 N）
    static balanceSpecificShift(context, shiftType, shiftName) {
        const { staffList, assignments, stats, daysInMonth } = context;
        
        console.log(`  📊 階段: 平衡${shiftName}班 (${shiftType})`);
        
        const maxIterations = 3;
        for (let iteration = 0; iteration < maxIterations; iteration++) {
            let swapCount = 0;
            
            const shiftStats = staffList.map(staff => ({
                uid: staff.uid,
                staff: staff,
                count: stats[staff.uid][shiftType] || 0
            }));
            
            const avgCount = shiftStats.reduce((sum, s) => sum + s.count, 0) / shiftStats.length;
            const stdCount = Math.sqrt(shiftStats.reduce((sum, s) => sum + Math.pow(s.count - avgCount, 2), 0) / shiftStats.length);
            
            console.log(`    第 ${iteration + 1} 輪: 平均${shiftName}=${avgCount.toFixed(1)}, 標準差=${stdCount.toFixed(2)}`);
            
            if (stdCount < 1.5) {
                console.log(`    ✅ ${shiftName}班平衡度已達標`);
                break;
            }
            
            const sorted = [...shiftStats].sort((a, b) => a.count - b.count);
            const tooFew = sorted.slice(0, Math.ceil(sorted.length * 0.4));
            const tooMany = sorted.slice(-Math.ceil(sorted.length * 0.4)).reverse();
            
            // 策略 1：將過多者的該班次轉給過少者
            for (const manyUser of tooMany) {
                for (let d = 1; d <= daysInMonth; d++) {
                    const shift = assignments[manyUser.uid][d];
                    
                    if (shift !== shiftType || this.isLocked(context, manyUser.uid, d)) {
                        continue;
                    }
                    
                    // 嘗試與過少者的其他工作日交換
                    for (const fewUser of tooFew) {
                        if (manyUser.uid === fewUser.uid) continue;
                        
                        const theirShift = assignments[fewUser.uid][d];
                        
                        // 情況 1：對方這天是 OFF，直接接手
                        if (theirShift === 'OFF' && !this.isLocked(context, fewUser.uid, d)) {
                            if (this.canSwap(context, manyUser.uid, fewUser.uid, d, shiftType)) {
                                this.assign(context, manyUser.uid, d, 'OFF');
                                this.assign(context, fewUser.uid, d, shiftType);
                                swapCount++;
                                break;
                            }
                        }
                        
                        // 情況 2：對方這天是其他班別，交換班次
                        if (['D','E','N'].includes(theirShift) && theirShift !== shiftType && !this.isLocked(context, fewUser.uid, d)) {
                            if (this.canSwap(context, manyUser.uid, fewUser.uid, d, theirShift) &&
                                this.canSwap(context, fewUser.uid, manyUser.uid, d, shiftType)) {
                                this.assign(context, manyUser.uid, d, theirShift);
                                this.assign(context, fewUser.uid, d, shiftType);
                                swapCount++;
                                break;
                            }
                        }
                    }
                }
            }
            
            console.log(`    本輪交換次數: ${swapCount}`);
            
            if (swapCount === 0) {
                console.log(`    ⚠️ 無法進一步優化${shiftName}班`);
                break;
            }
        }
    }
    
    // 階段 4：平衡假日班次
    static balanceWeekendShifts(context) {
        const { staffList, assignments, daysInMonth, year, month } = context;
        
        console.log("  📊 階段 4: 平衡假日班次");
        
        // 統計每個員工的假日工作天數
        const weekendStats = staffList.map(staff => {
            let weekendWorkDays = 0;
            for (let d = 1; d <= daysInMonth; d++) {
                const date = new Date(year, month - 1, d);
                const dayOfWeek = date.getDay();
                const shift = assignments[staff.uid][d];
                
                // 0 = 周日, 6 = 周六
                if ((dayOfWeek === 0 || dayOfWeek === 6) && ['D','E','N'].includes(shift)) {
                    weekendWorkDays++;
                }
            }
            
            return {
                uid: staff.uid,
                staff: staff,
                weekendWorkDays: weekendWorkDays
            };
        });
        
        const avgWeekend = weekendStats.reduce((sum, s) => sum + s.weekendWorkDays, 0) / weekendStats.length;
        const stdWeekend = Math.sqrt(weekendStats.reduce((sum, s) => sum + Math.pow(s.weekendWorkDays - avgWeekend, 2), 0) / weekendStats.length);
        
        console.log(`    平均假日工作=${avgWeekend.toFixed(1)}, 標準差=${stdWeekend.toFixed(2)}`);
        
        if (stdWeekend < 1.0) {
            console.log("    ✅ 假日班次已平衡");
            return;
        }
        
        const sorted = [...weekendStats].sort((a, b) => a.weekendWorkDays - b.weekendWorkDays);
        const tooFew = sorted.slice(0, Math.ceil(sorted.length * 0.3));
        const tooMany = sorted.slice(-Math.ceil(sorted.length * 0.3)).reverse();
        
        let swapCount = 0;
        
        // 嘗試將假日工作多的人的假日班次轉給少的人
        for (const manyUser of tooMany) {
            for (let d = 1; d <= daysInMonth; d++) {
                const date = new Date(year, month - 1, d);
                const dayOfWeek = date.getDay();
                
                if (dayOfWeek !== 0 && dayOfWeek !== 6) continue; // 只處理周末
                
                const shift = assignments[manyUser.uid][d];
                if (!['D','E','N'].includes(shift) || this.isLocked(context, manyUser.uid, d)) {
                    continue;
                }
                
                for (const fewUser of tooFew) {
                    if (manyUser.uid === fewUser.uid) continue;
                    
                    const theirShift = assignments[fewUser.uid][d];
                    
                    if (theirShift === 'OFF' && !this.isLocked(context, fewUser.uid, d)) {
                        if (this.canSwap(context, manyUser.uid, fewUser.uid, d, shift)) {
                            this.assign(context, manyUser.uid, d, 'OFF');
                            this.assign(context, fewUser.uid, d, shift);
                            swapCount++;
                            break;
                        }
                    }
                }
            }
        }
        
        console.log(`    假日班次交換次數: ${swapCount}`);
    }
    
    // 階段 5：優化偏好滿足度
    static optimizePreferences(context) {
        const { staffList, assignments, preferences, daysInMonth } = context;
        
        console.log("  📊 階段 5: 優化偏好滿足度");
        
        let optimizeCount = 0;
        
        for (const staff of staffList) {
            const prefs = preferences[staff.uid] || {};
            const p1 = prefs.priority1;
            
            if (!p1 || p1 === 'OFF') continue;
            
            // 統計該員工不符合偏好的班次
            const mismatchDays = [];
            for (let d = 1; d <= daysInMonth; d++) {
                const shift = assignments[staff.uid][d];
                
                if (['D','E','N'].includes(shift) && shift !== p1 && !this.isLocked(context, staff.uid, d)) {
                    mismatchDays.push({ day: d, shift: shift });
                }
            }
            
            // 嘗試將不符合偏好的班次交換為偏好班次
            for (const mismatch of mismatchDays) {
                // 找一個這天是偏好班次但不符合對方偏好的人來交換
                for (const other of staffList) {
                    if (staff.uid === other.uid) continue;
                    
                    const otherShift = assignments[other.uid][mismatch.day];
                    const otherPrefs = preferences[other.uid] || {};
                    const otherP1 = otherPrefs.priority1;
                    
                    // 對方這天是我的偏好班次，且這個班次不是對方的偏好
                    if (otherShift === p1 && otherP1 !== p1 && !this.isLocked(context, other.uid, mismatch.day)) {
                        // 檢查是否可以交換
                        if (this.canSwap(context, staff.uid, other.uid, mismatch.day, p1) &&
                            this.canSwap(context, other.uid, staff.uid, mismatch.day, mismatch.shift)) {
                            this.assign(context, staff.uid, mismatch.day, p1);
                            this.assign(context, other.uid, mismatch.day, mismatch.shift);
                            optimizeCount++;
                            break;
                        }
                    }
                }
            }
        }
        
        console.log(`    偏好優化次數: ${optimizeCount}`);
    }
    
    // 檢查是否可以交換班次
    static canSwap(context, uid1, uid2, day, shift) {
        const staff2 = context.staffList.find(s => s.uid === uid2);
        if (!staff2) return false;
        
        let whitelist = this.generateWhitelist(context, staff2);
        
        const prevShift = this.getShift(context, uid2, day - 1);
        const nextShift = this.getShift(context, uid2, day + 1);
        const shiftMap = this.getShiftMap(context.settings);
        
        if (!RuleEngine.checkShiftInterval(prevShift, shift, shiftMap, 660)) {
            return false;
        }
        
        if (nextShift && ['D','E','N'].includes(nextShift)) {
            if (!RuleEngine.checkShiftInterval(shift, nextShift, shiftMap, 660)) {
                return false;
            }
        }
        
        let consecutive = 0;
        for (let d = day - 1; d >= 1; d--) {
            const s = this.getShift(context, uid2, d);
            if (['D','E','N'].includes(s)) {
                consecutive++;
            } else {
                break;
            }
        }
        
        const maxCons = staff2.constraints?.maxConsecutive || context.rules.maxWorkDays || 6;
        if (consecutive >= maxCons) {
            return false;
        }
        
        return whitelist.includes(shift);
    }

    static step3_Finalize(context) {
        const { daysInMonth, assignments, staffList } = context;
        staffList.forEach(staff => {
            for (let d = 1; d <= daysInMonth; d++) {
                if (!assignments[staff.uid][d]) {
                    this.assign(context, staff.uid, d, 'OFF');
                }
            }
        });
    }

    // =========================================================================
    // 🔧 輔助函式
    // =========================================================================

    static assign(context, uid, day, shift) {
        const oldShift = context.assignments[uid][day];
        if (oldShift) {
            context.stats[uid][oldShift]--;
        }

        context.assignments[uid][day] = shift;
        
        if (!context.stats[uid][shift]) context.stats[uid][shift] = 0;
        context.stats[uid][shift]++;

        if (shift === 'OFF' || shift === 'M_OFF') {
            context.stats[uid].consecutive = 0;
        } else {
            context.stats[uid].consecutive++;
        }
    }

    static getShift(context, uid, day) {
        if (day < 1) return 'OFF'; 
        return context.assignments[uid]?.[day] || null;
    }

    static isLocked(context, uid, day) {
        return !!context.wishes[uid]?.wishes?.[day];
    }

    static canAssign(context, staff, day, shift) {
        const whitelist = this.generateWhitelist(context, staff);
        if (!whitelist.includes(shift)) return false;
        
        const prev = this.getShift(context, staff.uid, day - 1);
        if (!RuleEngine.checkShiftInterval(prev, shift, this.getShiftMap(context.settings), 660)) return false;
        
        return true;
    }

    static getShiftMap(settings) {
        const map = {};
        const shifts = settings.shifts || [];
        shifts.forEach(s => {
            const parse = (t) => {
                const [h, m] = t.split(':').map(Number);
                return h * 60 + m;
            };
            map[s.code] = { start: parse(s.startTime), end: parse(s.endTime) };
        });
        if (!map['D']) map['D'] = { start: 480, end: 960 };
        if (!map['E']) map['E'] = { start: 960, end: 1440 };
        if (!map['N']) map['N'] = { start: 0, end: 480 };
        return map;
    }
}
