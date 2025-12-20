import { RuleEngine } from "./RuleEngine.js";

const MAX_RUNTIME = 60000;

export class AutoScheduler {

    static async run(currentSchedule, staffList, unitSettings, preScheduleData, previousMonthAssignments = {}, strategyCode = 'A') {
        console.log(`🚀 AI 排班啟動 (v2.6 決策紀錄版): 策略 ${strategyCode}`);
        const startTime = Date.now();

        try {
            const context = this.prepareContext(currentSchedule, staffList, unitSettings, preScheduleData, previousMonthAssignments);

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
                    this.step2C_RetroactiveDeficit(context, day - 1);
                }

                this.step2A_ScheduleToday(context, day);
            }

            // 🎯 子步驟 3：月底收尾與最終平衡
            if (context.daysInMonth > 0) {
                this.step2B_RetroactiveOFF(context, context.daysInMonth);
                this.step3_Finalize(context);
                
                // ✅ v2.5 強化版：多階段全月總平衡
                this.enhancedGlobalBalance(context);
            }

            return {
                assignments: context.assignments,
                logs: context.logs,
                decisions: context.decisions // ✨ 回傳決策地圖
            };

        } catch (error) {
            console.error("AutoScheduler Error:", error);
            throw error;
        }
    }

    // =========================================================================
    // 🛠️ 初始化
    // =========================================================================

    static prepareContext(schedule, staffList, unitSettings, preSchedule, previousMonthAssignments) {
        const assignments = {};
        const decisions = {}; // ✨ 新增：決策紀錄容器
        const stats = {};
        const preferences = {}; 
        
        const allShifts = unitSettings.settings?.shifts?.map(s => s.code) || ['D', 'E', 'N'];

        staffList.forEach(staff => {
            const uid = staff.uid;
            assignments[uid] = {};
            decisions[uid] = {}; // ✨ 初始化每個人的決策紀錄
            stats[uid] = { 
                OFF: 0, 
                consecutive: 0,
                lastShift: null,
                weekendShifts: 0,
                shiftTypes: new Set(),
                earlyMonthOffTaken: false
            };
            
            allShifts.forEach(s => stats[uid][s] = 0);

            // 整合上個月月底 6 天的班次
            for (let d = -6; d < 0; d++) {
                if (previousMonthAssignments[uid] && previousMonthAssignments[uid][d]) {
                    assignments[uid][d] = previousMonthAssignments[uid][d];
                    decisions[uid][d] = "上月延續"; // 標記上個月的班
                }
            }

            const sub = preSchedule?.submissions?.[uid];
            preferences[uid] = sub?.preferences || {};
        });
        
        return {
            year: schedule.year,
            month: schedule.month,
            daysInMonth: new Date(schedule.year, schedule.month, 0).getDate(),
            assignments,
            decisions, // ✨ 放入 context
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

            let whitelist = this.generateWhitelist(context, staff, day);
            whitelist = this.filterWhitelistRules(context, staff, day, whitelist);

            if (this.tryContinuePreviousShift(context, staff, day, whitelist)) continue;

            blankList.push({ staff, whitelist });
        }

        this.fillBlanks(context, day, blankList);
        
        // 檢查並更新 earlyMonthOffTaken 狀態
        if (day <= 6) {
            staffList.forEach(staff => {
                if (this.getShift(context, staff.uid, day) === 'OFF') {
                    context.stats[staff.uid].earlyMonthOffTaken = true;
                }
            });
        }
        
        // 日班次平衡 (超額轉缺額)
        this.balanceDailyShifts(context, day);
    }

    static checkPreSchedule(context, staff, day) {
        const wishes = context.wishes[staff.uid]?.wishes || {};
        const wish = wishes[day];

        if (!wish) return false; 

        if (wish === 'OFF' || wish === 'M_OFF') {
            this.assign(context, staff.uid, day, 'OFF', `預班指定 (${wish})`);
            if (day <= 6) {
                context.stats[staff.uid].earlyMonthOffTaken = true;
            }
            return true;
        }

        // 檢查連續上班天數
        const maxCons = staff.constraints?.maxConsecutive || context.rules.maxWorkDays || 6;
        const currentConsecutive = context.stats[staff.uid].consecutive;
        const willBeConsecutive = currentConsecutive + 1;

        if (willBeConsecutive > maxCons) {
            this.assign(context, staff.uid, day, 'OFF', `預班 ${wish} 違反連班規則 (${willBeConsecutive}天)，強制 OFF`);
            if (day <= 6) {
                context.stats[staff.uid].earlyMonthOffTaken = true;
            }
            context.logs.push(`⚠️ ${staff.name} Day ${day}: 預班 ${wish} 違反連班規則 (${willBeConsecutive}天)，強制 OFF`);
            return true;
        }

        // 檢查間隔時間
        const prevShift = this.getShift(context, staff.uid, day - 1);
        if (RuleEngine.checkShiftInterval(prevShift, wish, this.getShiftMap(context.settings), 660)) {
            this.assign(context, staff.uid, day, wish, `預班指定 (${wish})`);
            return true;
        } else {
            context.logs.push(`⚠️ ${staff.name} Day ${day}: 預班 ${wish} 違反間隔規則 (前: ${prevShift})，進入一般排班`);
            return false; 
        }
    }

    static generateWhitelist(context, staff, day) {
        let list = ['D', 'E', 'N', 'OFF'];
        const constraints = staff.constraints || {};
        const prefs = context.preferences[staff.uid] || {};
        
        const isEarlyMonth = day <= 6;
        const prevShift = this.getShift(context, staff.uid, day - 1);
        const hasTakenEarlyMonthOff = context.stats[staff.uid].earlyMonthOffTaken;

        // 規則 2.2.1: 月初 6 天內，且尚未休息過，則優先順接前班
        if (isEarlyMonth && !hasTakenEarlyMonthOff) {
            if (['D', 'E', 'N'].includes(prevShift)) {
                list = list.filter(s => s === prevShift || s === 'OFF');
                context.logs.push(`  ${staff.name} Day ${day}: 月初順接前班 (${prevShift}) 模式，白名單: ${list.join(', ')}`);
                return list;
            }
        }
        
        // 孕哺限制
        if (constraints.isPregnant || constraints.isPostpartum) {
            list = list.filter(s => s !== 'N' && s !== 'E'); 
        }

        // 根據包班設定過濾
        const p1 = prefs.priority1;
        const p2 = prefs.priority2;
        const p3 = prefs.priority3;
        
        let isEOnly = (p1 === 'E' || p2 === 'E' || p3 === 'E') && !(p1 === 'N' || p2 === 'N' || p3 === 'N');
        let isNOnly = (p1 === 'N' || p2 === 'N' || p3 === 'N') && !(p1 === 'E' || p2 === 'E' || p3 === 'E');

        if (isEOnly) {
            list = list.filter(s => s === 'E' || s === 'OFF');
            context.logs.push(`  ${staff.name}: 依偏好設定為包小夜，白名單: E, OFF`);
        } else if (isNOnly) {
            list = list.filter(s => s === 'N' || s === 'OFF');
            context.logs.push(`  ${staff.name}: 依偏好設定為包大夜，白名單: N, OFF`);
        } else if ((p1 === 'D' || p2 === 'D' || p3 === 'D') && (p1 === 'E' || p2 === 'E' || p3 === 'E')) {
            list = list.filter(s => s === 'D' || s === 'E' || s === 'OFF');
            context.logs.push(`  ${staff.name}: 依偏好設定為 D+E，白名單: D, E, OFF`);
        } else if ((p1 === 'D' || p2 === 'D' || p3 === 'D') && (p1 === 'N' || p2 === 'N' || p3 === 'N')) {
            list = list.filter(s => s === 'D' || s === 'N' || s === 'OFF');
            context.logs.push(`  ${staff.name}: 依偏好設定為 D+N，白名單: D, N, OFF`);
        } else {
            // 一般情況：平衡度檢查
            const preferred = ['OFF'];
            
            if (p1 && list.includes(p1)) {
                preferred.push(p1);
            }
            
            if (p2 && list.includes(p2) && !preferred.includes(p2)) {
                preferred.push(p2);
            }
            
            const currentOff = context.stats[staff.uid].OFF;
            const avgTarget = context.avgLeaveTarget;
            const daysPassed = Object.keys(context.assignments[staff.uid]).length;
            const expectedOff = Math.floor((avgTarget / context.daysInMonth) * daysPassed);
            
            if (currentOff < expectedOff - 6) {
                list = ['D', 'E', 'N', 'OFF'];
                if (constraints.isPregnant || constraints.isPostpartum) {
                    list = list.filter(s => s !== 'N' && s !== 'E');
                }
            } else if (currentOff < expectedOff - 4) {
                if (p1) {
                    preferred.push('D');
                    if (list.includes(p1)) preferred.push(p1);
                }
                list = preferred;
            } else if (currentOff < expectedOff - 2) {
                list = preferred;
            } else {
                list = preferred;
            }
        }

        return list;
    }

    static filterWhitelistRules(context, staff, day, whitelist) {
        const prevShift = this.getShift(context, staff.uid, day - 1);
        const shiftMap = this.getShiftMap(context.settings);
        const maxCons = staff.constraints?.maxConsecutive || context.rules.maxWorkDays || 6;
        const currentConsecutive = context.stats[staff.uid].consecutive;
        
        return whitelist.filter(shift => {
            // 檢查 11 小時間隔
            if (!RuleEngine.checkShiftInterval(prevShift, shift, shiftMap, 660)) {
                return false;
            }
            
            // 檢查連續上班天數
            if (['D', 'E', 'N'].includes(shift)) {
                const willBeConsecutive = currentConsecutive + 1;
                
                if (willBeConsecutive > maxCons) {
                    if (willBeConsecutive === maxCons + 1 && context.rules.allowConsecutive7) {
                        return shift === 'OFF';
                    }
                    return false;
                }
            }
            
            // 檢查大夜前置
            if (shift === 'N' && prevShift !== 'OFF' && prevShift !== 'N' && context.rules.preNightOff) {
                return false;
            }
            
            return true;
        });
    }

    static tryContinuePreviousShift(context, staff, day, whitelist) {
        const prevShift = this.getShift(context, staff.uid, day - 1);
        
        if (['D', 'E', 'N'].includes(prevShift) && whitelist.includes(prevShift)) {
            this.assign(context, staff.uid, day, prevShift, `延續前日班別 (${prevShift})`);
            return true;
        }
        return false;
    }

    static fillBlanks(context, day, blankList) {
        const { staffReq } = context;
        const dayOfWeek = new Date(context.year, context.month - 1, day).getDay();
        const shifts = ['D', 'E', 'N'];
        
        // 統計當日班次需求和已排人數
        const currentCounts = { D: 0, E: 0, N: 0 };
        const required = {};
        
        shifts.forEach(shift => {
            required[shift] = staffReq[shift]?.[dayOfWeek] || 0;
            Object.keys(context.assignments).forEach(uid => {
                if (context.assignments[uid][day] === shift) {
                    currentCounts[shift]++;
                }
            });
        });
        
        // 優先處理包班員工，其次休假多的優先
        const sortedBlanks = [...blankList].sort((a, b) => {
            const aIsPackage = a.whitelist.includes('E') && !a.whitelist.includes('D') || 
                               a.whitelist.includes('N') && !a.whitelist.includes('D');
            const bIsPackage = b.whitelist.includes('E') && !b.whitelist.includes('D') || 
                               b.whitelist.includes('N') && !b.whitelist.includes('D');
            
            if (aIsPackage && !bIsPackage) return -1;
            if (!aIsPackage && bIsPackage) return 1;
            
            // 休假多的優先
            return context.stats[b.staff.uid].OFF - context.stats[a.staff.uid].OFF;
        });
        
        for (const { staff, whitelist } of sortedBlanks) {
            let assigned = false;
            
            // 優先選擇需求赤字最大的班別
            const deficitShifts = shifts
                .filter(shift => whitelist.includes(shift) && currentCounts[shift] < required[shift])
                .sort((a, b) => (required[b] - currentCounts[b]) - (required[a] - currentCounts[a]));
            
            for (const shift of deficitShifts) {
                this.assign(context, staff.uid, day, shift, `填補缺額 (優先順序高)`);
                currentCounts[shift]++;
                assigned = true;
                break;
            }
            
            if (!assigned) {
                if (whitelist.includes('OFF')) {
                    this.assign(context, staff.uid, day, 'OFF', `無合適缺額/輪空自動 OFF`);
                } else {
                    this.assign(context, staff.uid, day, 'OFF', `無缺額且無法排班 強制 OFF`);
                }
            }
        }
    }

    // =========================================================================
    // 🔄 Step 2B: 回溯標記 OFF
    // =========================================================================
    static step2B_RetroactiveOFF(context, targetDay) {
        const { staffList, assignments, dailyLeaveQuotas } = context;
        const dayOfWeek = new Date(context.year, context.month - 1, targetDay).getDay();
        const shifts = ['D', 'E', 'N'];
        
        // 統計當日超額人數
        const currentCounts = { D: 0, E: 0, N: 0 };
        const required = {};
        
        shifts.forEach(shift => {
            required[shift] = context.staffReq[shift]?.[dayOfWeek] || 0;
            Object.keys(assignments).forEach(uid => {
                if (assignments[uid][targetDay] === shift) {
                    currentCounts[shift]++;
                }
            });
        });
        
        let overstaffedCount = 0;
        shifts.forEach(shift => {
            overstaffedCount += Math.max(0, currentCounts[shift] - required[shift]);
        });
        
        if (overstaffedCount === 0) return;
        
        // 確定可回溯標記 OFF 的配額
        const availableLeaveQuota = dailyLeaveQuotas[targetDay] - context.stats.totalOFF; // 注意：stats.totalOFF 需維護或忽略
        // 這裡假設 dailyLeaveQuotas 夠用，簡化處理
        const retroactiveOffQuota = Math.min(overstaffedCount, dailyLeaveQuotas[targetDay] || 0); 
        
        if (retroactiveOffQuota <= 0) return;
        
        // 找出所有超額班次的員工
        let candidates = [];
        shifts.forEach(shift => {
            if (currentCounts[shift] > required[shift]) {
                const staffUids = staffList.map(s => s.uid).filter(uid => assignments[uid][targetDay] === shift);
                
                const eligibleStaff = staffUids.filter(uid => !this.isLocked(context, uid, targetDay));
                
                // 優先選擇休假天數較少的員工
                eligibleStaff.sort((a, b) => context.stats[a].OFF - context.stats[b].OFF);
                
                // 排除上1休1模式
                const finalCandidates = eligibleStaff.filter(uid => {
                    const prevShift = this.getShift(context, uid, targetDay - 1);
                    const nextShift = this.getShift(context, uid, targetDay + 1);
                    
                    if (prevShift === 'OFF' && nextShift === 'OFF') return false;
                    if (['D','E','N'].includes(prevShift) && ['D','E','N'].includes(nextShift)) return true;
                    
                    return true;
                });
                
                candidates.push(...finalCandidates.map(uid => ({ uid, shift })));
            }
        });
        
        // 執行回溯標記 OFF
        let count = retroactiveOffQuota;
        
        // 再次排序：休假少的優先
        candidates.sort((a, b) => context.stats[a.uid].OFF - context.stats[b.uid].OFF);
        
        for (const { uid, shift } of candidates) {
            if (count <= 0) break;
            
            this.assign(context, uid, targetDay, 'OFF', `回溯修正: 人力過剩轉 OFF`);
            context.logs.push(`✅ Day ${targetDay}: ${uid} (${shift}) 標記為 OFF (回溯)`);
            count--;
        }
    }

    // =========================================================================
    // 🎯 Step 3: 最終化
    // =========================================================================
    static step3_Finalize(context) {
        const { daysInMonth, assignments, staffList } = context;
        staffList.forEach(staff => {
            for (let d = 1; d <= daysInMonth; d++) {
                if (!assignments[staff.uid][d]) {
                    this.assign(context, staff.uid, d, 'OFF', `月底收尾補齊 OFF`);
                }
            }
        });
    }

    // =========================================================================
    // ✅ v2.5 多階段全月總平衡
    // =========================================================================
    static enhancedGlobalBalance(context) {
        console.log("🔄 開始 v2.5 多階段全月平衡...");
        
        this.balanceOFF(context);
        this.balanceSpecificShiftWithPreference(context, 'E', '小夜');
        this.balanceSpecificShiftWithPreference(context, 'N', '大夜');
        this.balanceWeekendShifts(context);
        this.optimizePreferences(context);
        
        console.log("✅ v2.5 全月平衡完成");
    }
    
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
            const tooFewOff = sorted.slice(0, Math.ceil(sorted.length * 0.4));
            const tooManyOff = sorted.slice(-Math.ceil(sorted.length * 0.4)).reverse();
            
            for (const fewOffUser of tooFewOff) {
                let swappedThisUser = false;
                
                for (let d = 1; d <= daysInMonth && !swappedThisUser; d++) {
                    const shift = assignments[fewOffUser.uid][d];
                    
                    if (!['D','E','N'].includes(shift) || this.isLocked(context, fewOffUser.uid, d)) {
                        continue;
                    }
                    
                    for (const manyOffUser of tooManyOff) {
                        if (fewOffUser.uid === manyOffUser.uid) continue;
                        
                        if (assignments[manyOffUser.uid][d] !== 'OFF' || this.isLocked(context, manyOffUser.uid, d)) {
                            continue;
                        }
                        
                        if (this.canSwap(context, manyOffUser.uid, fewOffUser.uid, d, shift)) {
                            this.assign(context, fewOffUser.uid, d, 'OFF', `全月優化: 增加休假 (與 ${manyOffUser.uid} 交換)`);
                            this.assign(context, manyOffUser.uid, d, shift, `全月優化: 減少休假 (與 ${fewOffUser.uid} 交換)`);
                            swapCount++;
                            swappedThisUser = true;
                            break;
                        }
                    }
                }
                if (swappedThisUser) break; 
            }
            
            if (swapCount === 0) {
                console.log("    ⚠️ 無法進一步優化 OFF");
                break;
            }
        }
    }
    
    static balanceSpecificShiftWithPreference(context, shiftType, shiftName) {
        const { staffList, assignments, stats, daysInMonth, preferences } = context;
        
        console.log(`  📊 階段: 平衡${shiftName}班 (${shiftType}) - 只在偏好該班次的人之間`);
        
        const eligibleStaff = staffList.filter(staff => {
            const prefs = preferences[staff.uid] || {};
            const p1 = prefs.priority1;
            const p2 = prefs.priority2;
            const p3 = prefs.priority3;
            return p1 === shiftType || p2 === shiftType || p3 === shiftType;
        });
        
        if (eligibleStaff.length === 0) {
            console.log(`    ⚠️ 沒有員工偏好${shiftName}班，跳過`);
            return;
        }
        
        console.log(`    符合條件的員工數: ${eligibleStaff.length}`);
        
        const maxIterations = 3;
        for (let iteration = 0; iteration < maxIterations; iteration++) {
            let swapCount = 0;
            
            const shiftStats = eligibleStaff.map(staff => ({
                uid: staff.uid,
                shiftCount: stats[staff.uid][shiftType]
            }));
            
            const avgShift = shiftStats.reduce((sum, s) => sum + s.shiftCount, 0) / shiftStats.length;
            const stdShift = Math.sqrt(shiftStats.reduce((sum, s) => sum + Math.pow(s.shiftCount - avgShift, 2), 0) / shiftStats.length);
            
            console.log(`    第 ${iteration + 1} 輪: 平均 ${shiftType}=${avgShift.toFixed(1)}, 標準差=${stdShift.toFixed(2)}`);
            
            if (stdShift < 1.0) {
                console.log(`    ✅ ${shiftName}班平衡度已達標`);
                break;
            }
            
            const sorted = [...shiftStats].sort((a, b) => a.shiftCount - b.shiftCount);
            const tooFew = sorted.slice(0, Math.ceil(sorted.length * 0.4));
            const tooMany = sorted.slice(-Math.ceil(sorted.length * 0.4)).reverse();
            
            for (const fewUser of tooFew) {
                let swappedThisUser = false;
                
                for (let d = 1; d <= daysInMonth && !swappedThisUser; d++) {
                    const shift = assignments[fewUser.uid][d];
                    
                    if (shift === shiftType || shift === 'OFF' || this.isLocked(context, fewUser.uid, d)) {
                        continue;
                    }
                    
                    for (const manyUser of tooMany) {
                        if (fewUser.uid === manyUser.uid) continue;
                        
                        if (assignments[manyUser.uid][d] !== shiftType || this.isLocked(context, manyUser.uid, d)) {
                            continue;
                        }
                        
                        if (this.canSwap(context, fewUser.uid, manyUser.uid, d, shiftType) &&
                            this.canSwap(context, manyUser.uid, fewUser.uid, d, shift)) {
                            
                            this.assign(context, fewUser.uid, d, shiftType, `全月優化: 平衡${shiftName} (增加)`);
                            this.assign(context, manyUser.uid, d, shift, `全月優化: 平衡${shiftName} (減少)`);
                            swapCount++;
                            swappedThisUser = true;
                            break;
                        }
                    }
                }
                if (swappedThisUser) break; 
            }
            
            if (swapCount === 0) {
                console.log(`    ⚠️ 無法進一步優化 ${shiftName}班`);
                break;
            }
        }
    }
    
    static balanceWeekendShifts(context) {
        const { staffList, assignments, stats, daysInMonth } = context;
        
        console.log("  📊 階段 4: 平衡假日班次");
        
        const maxIterations = 3;
        for (let iteration = 0; iteration < maxIterations; iteration++) {
            let swapCount = 0;
            
            const weekendStats = staffList.map(staff => ({
                uid: staff.uid,
                weekendCount: stats[staff.uid].weekendShifts
            }));
            
            const avgWeekend = weekendStats.reduce((sum, s) => sum + s.weekendCount, 0) / weekendStats.length;
            const stdWeekend = Math.sqrt(weekendStats.reduce((sum, s) => sum + Math.pow(s.weekendCount - avgWeekend, 2), 0) / weekendStats.length);
            
            console.log(`    第 ${iteration + 1} 輪: 平均假日=${avgWeekend.toFixed(1)}, 標準差=${stdWeekend.toFixed(2)}`);
            
            if (stdWeekend < 1.0) {
                console.log("    ✅ 假日班次平衡度已達標");
                break;
            }
            
            const sorted = [...weekendStats].sort((a, b) => a.weekendCount - b.weekendCount);
            const tooFew = sorted.slice(0, Math.ceil(sorted.length * 0.4));
            const tooMany = sorted.slice(-Math.ceil(sorted.length * 0.4)).reverse();
            
            for (const fewUser of tooFew) {
                let swappedThisUser = false;
                
                for (let d = 1; d <= daysInMonth && !swappedThisUser; d++) {
                    const date = new Date(context.year, context.month - 1, d);
                    const dayOfWeek = date.getDay();
                    
                    if (dayOfWeek !== 0 && dayOfWeek !== 6) continue;
                    
                    const shift = assignments[fewUser.uid][d];
                    
                    if (shift !== 'OFF' || this.isLocked(context, fewUser.uid, d)) {
                        continue;
                    }
                    
                    for (const manyUser of tooMany) {
                        if (fewUser.uid === manyUser.uid) continue;
                        
                        const manyShift = assignments[manyUser.uid][d];
                        
                        if (!['D','E','N'].includes(manyShift) || this.isLocked(context, manyUser.uid, d)) {
                            continue;
                        }
                        
                        if (this.canSwap(context, fewUser.uid, manyUser.uid, d, manyShift)) {
                            this.assign(context, fewUser.uid, d, manyShift, `全月優化: 增加假日班`);
                            this.assign(context, manyUser.uid, d, 'OFF', `全月優化: 減少假日班`);
                            swapCount++;
                            swappedThisUser = true;
                            break;
                        }
                    }
                }
                if (swappedThisUser) break; 
            }
            
            if (swapCount === 0) {
                console.log("    ⚠️ 無法進一步優化假日班次");
                break;
            }
        }
    }

    static optimizePreferences(context) {
        const { staffList, assignments, preferences, daysInMonth } = context;
        
        console.log("  📊 階段 5: 優化偏好滿足度");
        
        let optimizeCount = 0;
        
        for (const staff of staffList) {
            const prefs = preferences[staff.uid] || {};
            const p1 = prefs.priority1;
            
            if (!p1 || p1 === 'OFF') continue;
            
            const mismatchDays = [];
            for (let d = 1; d <= daysInMonth; d++) {
                const shift = assignments[staff.uid][d];
                
                if (['D','E','N'].includes(shift) && shift !== p1 && !this.isLocked(context, staff.uid, d)) {
                    mismatchDays.push({ day: d, shift: shift });
                }
            }
            
            for (const mismatch of mismatchDays) {
                for (const other of staffList) {
                    if (staff.uid === other.uid) continue;
                    
                    const otherShift = assignments[other.uid][mismatch.day];
                    const otherPrefs = preferences[other.uid] || {};
                    const otherP1 = otherPrefs.priority1;
                    
                    if (otherShift === p1 && otherP1 !== p1 && !this.isLocked(context, other.uid, mismatch.day)) {
                        if (this.canSwap(context, staff.uid, other.uid, mismatch.day, p1) &&
                            this.canSwap(context, other.uid, staff.uid, mismatch.day, mismatch.shift)) {
                            this.assign(context, staff.uid, mismatch.day, p1, `全月優化: 滿足偏好 (${p1})`);
                            this.assign(context, other.uid, mismatch.day, mismatch.shift, `全月優化: 交換以滿足他人偏好`);
                            optimizeCount++;
                            break;
                        }
                    }
                }
            }
        }
        
        console.log(`    偏好優化次數: ${optimizeCount}`);
    }

    // =========================================================================
    // 🔧 輔助函式
    // =========================================================================

    static canSwap(context, uid1, uid2, day, shift) {
        const staff2 = context.staffList.find(s => s.uid === uid2);
        if (!staff2) return false;
        
        let whitelist = this.generateWhitelist(context, staff2, day);
        
        const prevShift = this.getShift(context, uid2, day - 1);
        const nextShift = this.getShift(context, uid2, day + 1);
        const shiftMap = this.getShiftMap(context.settings);
        
        // 檢查 11 小時間隔 (前一天)
        if (!RuleEngine.checkShiftInterval(prevShift, shift, shiftMap, 660)) {
            return false;
        }
        
        // 檢查 11 小時間隔 (後一天)
        if (nextShift && ['D','E','N'].includes(nextShift)) {
            if (!RuleEngine.checkShiftInterval(shift, nextShift, shiftMap, 660)) {
                return false;
            }
        }
        
        // 檢查連續上班天數
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

    static assign(context, uid, day, shift, reason = null) {
        const oldShift = context.assignments[uid][day];
        if (oldShift) {
            context.stats[uid][oldShift]--;
            if (['D','E','N'].includes(oldShift)) {
                context.stats[uid].shiftTypes.delete(oldShift);
            }
        }

        context.assignments[uid][day] = shift;
        
        if (!context.stats[uid][shift]) context.stats[uid][shift] = 0;
        context.stats[uid][shift]++;

        if (shift === 'OFF' || shift === 'M_OFF') {
            context.stats[uid].consecutive = 0;
        } else {
            context.stats[uid].consecutive++;
            if (['D','E','N'].includes(shift)) {
                context.stats[uid].shiftTypes.add(shift);
            }
        }
        
        // 週末班次統計
        const date = new Date(context.year, context.month - 1, day);
        const dayOfWeek = date.getDay();
        if ((dayOfWeek === 0 || dayOfWeek === 6) && ['D','E','N'].includes(shift)) {
            if (oldShift !== shift) {
                context.stats[uid].weekendShifts = (context.stats[uid].weekendShifts || 0) + 1;
            }
        }
        
        if (context.stats[uid].shiftTypes.size > 2) {
            console.warn(`⚠️ ${uid} 班別種類超過 2 種: ${Array.from(context.stats[uid].shiftTypes).join(', ')}`);
        }

        // ✨ 決策紀錄：如果有提供理由，則寫入
        if (reason) {
            if (!context.decisions[uid]) context.decisions[uid] = {};
            context.decisions[uid][day] = reason;
        }
    }

    static getShift(context, uid, day) {
        if (day < 1) return 'OFF'; 
        return context.assignments[uid]?.[day] || null;
    }

    static isLocked(context, uid, day) {
        return !!context.wishes[uid]?.wishes?.[day];
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
            if (map[s.code].end <= map[s.code].start) {
                map[s.code].end += 1440;
            }
        });
        return map;
    }

    // =========================================================================
    // 🔄 日班次平衡 (超額轉缺額)
    // =========================================================================
    static balanceDailyShifts(context, day) {
        const { assignments, staffReq } = context;
        const dayOfWeek = new Date(context.year, context.month - 1, day).getDay();
        const shifts = ['D', 'E', 'N'];
        
        const currentCounts = { D: 0, E: 0, N: 0 };
        const staffByShift = { D: [], E: [], N: [] };
        
        Object.keys(assignments).forEach(uid => {
            const shift = assignments[uid][day];
            if (shifts.includes(shift)) {
                currentCounts[shift]++;
                staffByShift[shift].push(uid);
            }
        });
        
        const overstaffed = [];
        const understaffed = [];
        
        shifts.forEach(shift => {
            const req = staffReq[shift]?.[dayOfWeek] || 0;
            const diff = currentCounts[shift] - req;
            
            if (diff > 0) {
                overstaffed.push({ shift, diff });
            } else if (diff < 0) {
                understaffed.push({ shift, diff: -diff });
            }
        });
        
        if (overstaffed.length === 0 || understaffed.length === 0) return;
        
        context.logs.push(`🔄 Day ${day}: 啟動日班次平衡。超額: ${overstaffed.map(o => `${o.shift}(+${o.diff})`).join(', ')}，缺額: ${understaffed.map(u => `${u.shift}(-${u.diff})`).join(', ')}`);
        
        let balanceCount = 0;
        
        for (const over of overstaffed) {
            for (const under of understaffed) {
                if (over.diff <= 0 || under.diff <= 0) continue;
                
                const candidates = staffByShift[over.shift].filter(uid => {
                    if (this.isLocked(context, uid, day)) return false;
                    return this.canSwap(context, uid, uid, day, under.shift);
                });
                
                // 優先選擇休假天數較多的員工
                candidates.sort((a, b) => context.stats[b].OFF - context.stats[a].OFF);
                
                const transfers = Math.min(over.diff, under.diff, candidates.length);
                
                for (let i = 0; i < transfers; i++) {
                    const uid = candidates[i];
                    
                    this.assign(context, uid, day, under.shift, `當日平衡: ${over.shift} 轉 ${under.shift}`);
                    
                    over.diff--;
                    under.diff--;
                    balanceCount++;
                    
                    context.logs.push(`✅ Day ${day}: ${uid} 從 ${over.shift} 轉為 ${under.shift} (平衡)`);
                }
            }
        }
        
        if (balanceCount > 0) {
            context.logs.push(`✅ Day ${day}: 日班次平衡完成，共轉移 ${balanceCount} 人次`);
        }
    }

    // =========================================================================
    // 🔄 Step 2C: 回溯性填補赤字
    // =========================================================================
    static step2C_RetroactiveDeficit(context, targetDay) {
        const { staffList, assignments, staffReq } = context;
        const dayOfWeek = new Date(context.year, context.month - 1, targetDay).getDay();
        const shifts = ['D', 'E', 'N'];
        
        const deficitShifts = [];
        let totalDeficit = 0;
        
        shifts.forEach(shift => {
            const req = staffReq[shift]?.[dayOfWeek] || 0;
            let currentCount = 0;
            Object.keys(assignments).forEach(uid => {
                if (assignments[uid][targetDay] === shift) {
                    currentCount++;
                }
            });
            
            const deficit = req - currentCount;
            if (deficit > 0) {
                deficitShifts.push({ shift, deficit });
                totalDeficit += deficit;
            }
        });
        
        if (totalDeficit === 0) return;
        
        context.logs.push(`🔄 Day ${targetDay}: 啟動回溯性填補赤字。赤字: ${deficitShifts.map(d => `${d.shift}(-${d.deficit})`).join(', ')}`);
        
        let candidates = staffList.filter(staff => {
            const uid = staff.uid;
            const shift = assignments[uid][targetDay];
            
            if (shift !== 'OFF') return false;
            if (this.isLocked(context, uid, targetDay)) return false;
            
            return true;
        });
        
        // 優先選擇休假天數較多的員工
        candidates.sort((a, b) => context.stats[b.uid].OFF - context.stats[a.uid].OFF);
        
        let fillCount = 0;
        
        for (const staff of candidates) {
            if (totalDeficit <= 0) break;
            
            const uid = staff.uid;
            let assigned = false;
            
            deficitShifts.sort((a, b) => b.deficit - a.deficit);
            
            for (const deficit of deficitShifts) {
                if (deficit.deficit <= 0) continue;
                
                const targetShift = deficit.shift;
                
                let whitelist = this.generateWhitelist(context, staff, targetDay);
                if (!whitelist.includes(targetShift)) continue;
                
                if (this.canSwap(context, uid, uid, targetDay, targetShift)) {
                    this.assign(context, uid, targetDay, targetShift, `回溯修正: 填補赤字 (${targetShift})`);
                    
                    deficit.deficit--;
                    totalDeficit--;
                    fillCount++;
                    assigned = true;
                    
                    context.logs.push(`✅ Day ${targetDay}: ${staff.name} (OFF) 回溯填補為 ${targetShift} (赤字)`);
                    break;
                }
            }
        }
        
        if (fillCount > 0) {
            context.logs.push(`✅ Day ${targetDay}: 回溯性填補赤字完成，共填補 ${fillCount} 人次`);
        }
    }
}
