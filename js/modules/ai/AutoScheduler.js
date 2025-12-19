import { RuleEngine } from "./RuleEngine.js";

const MAX_RUNTIME = 60000;

export class AutoScheduler {

    static async run(currentSchedule, staffList, unitSettings, preScheduleData, strategyCode = 'A') {
        console.log(`🚀 AI 排班啟動 (v2.5 夜班類型限制版): 策略 ${strategyCode}`);
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
                
                // ✅ v2.5 強化版：多階段全月總平衡
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
                weekendShifts: 0,
                shiftTypes: new Set()  // ✅ v2.5 新增：追踪班别种类
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
        
        // 新增：日班次平衡 (超額轉缺額)
        this.balanceDailyShifts(context, day);
    }

    static checkPreSchedule(context, staff, day) {
        const wishes = context.wishes[staff.uid]?.wishes || {};
        const wish = wishes[day];

        if (!wish) return false; 

        if (wish === 'OFF' || wish === 'M_OFF') {
            this.assign(context, staff.uid, day, 'OFF');
            return true;
        }

        // 1. 檢查連續上班天數 (對應規則 1.2)
        const maxCons = staff.constraints?.maxConsecutive || context.rules.maxWorkDays || 6;
        const currentConsecutive = context.stats[staff.uid].consecutive;
        const willBeConsecutive = currentConsecutive + 1;

        if (willBeConsecutive > maxCons) {
            // 如果超過最大連續天數，則強制排 OFF，並忽略預班指定
            this.assign(context, staff.uid, day, 'OFF');
            context.logs.push(`⚠️ ${staff.name} Day ${day}: 預班 ${wish} 違反連班規則 (${willBeConsecutive}天)，強制 OFF`);
            return true;
        }

        // 2. 檢查間隔時間 (對應規則 1.3)
        const prevShift = this.getShift(context, staff.uid, day - 1);
        if (RuleEngine.checkShiftInterval(prevShift, wish, this.getShiftMap(context.settings), 660)) {
            this.assign(context, staff.uid, day, wish);
            return true;
        } else {
            // 間隔不足 11 小時，忽略預班指定，進入一般排班流程 (返回 false)
            context.logs.push(`⚠️ ${staff.name} Day ${day}: 預班 ${wish} 違反間隔規則 (前: ${prevShift})，進入一般排班`);
            return false; 
        }
    }

    // ✅ v2.5 核心改进：严格遵守夜班类型限制
    static generateWhitelist(context, staff) {
        let list = ['D', 'E', 'N', 'OFF'];
        const constraints = staff.constraints || {};
        const prefs = context.preferences[staff.uid] || {};

        // 孕哺限制 (規則 2.2)
        if (constraints.isPregnant || constraints.isPostpartum) {
            // 假設 E 班結束時間可能超過 22:00，因此移除 E 和 N
            list = list.filter(s => s !== 'N' && s !== 'E'); 
        }

        // 根據包班設定過濾 (規則 2.3)
        const p1 = prefs.priority1;
        const p2 = prefs.priority2;
        const p3 = prefs.priority3;
        
        // 檢查是否有包班設定 (E 或 N)
        let isEOnly = (p1 === 'E' || p2 === 'E' || p3 === 'E') && !(p1 === 'N' || p2 === 'N' || p3 === 'N');
        let isNOnly = (p1 === 'N' || p2 === 'N' || p3 === 'N') && !(p1 === 'E' || p2 === 'E' || p3 === 'E');

        if (isEOnly) {
            // 包小夜 (E)
            list = list.filter(s => s === 'E' || s === 'OFF');
            context.logs.push(`  ${staff.name} (${staff.uid}): 依偏好設定為包小夜，白名單: E, OFF`);
        } else if (isNOnly) {
            // 包大夜 (N)
            list = list.filter(s => s === 'N' || s === 'OFF');
            context.logs.push(`  ${staff.name} (${staff.uid}): 依偏好設定為包大夜，白名單: N, OFF`);
        } else if ((p1 === 'D' || p2 === 'D' || p3 === 'D') && (p1 === 'E' || p2 === 'E' || p3 === 'E')) {
            // 白班 + 小夜 (D, E) (規則 2.4)
            list = list.filter(s => s === 'D' || s === 'E' || s === 'OFF');
            context.logs.push(`  ${staff.name} (${staff.uid}): 依偏好設定為 D+E，白名單: D, E, OFF`);
        } else if ((p1 === 'D' || p2 === 'D' || p3 === 'D') && (p1 === 'N' || p2 === 'N' || p3 === 'N')) {
            // 白班 + 大夜 (D, N) (規則 2.4)
            list = list.filter(s => s === 'D' || s === 'N' || s === 'OFF');
            context.logs.push(`  ${staff.name} (${staff.uid}): 依偏好設定為 D+N，白名單: D, N, OFF`);
        } else {
            // 原始邏輯：檢查平衡度並調整白名單 (規則 2.4 的平衡度檢查)
            const preferred = ['OFF'];
            
            // 强偏好（priority1）始终保留
            if (p1 && list.includes(p1)) {
                preferred.push(p1);
            }
            
            // 弱偏好（priority2）也加入
            if (p2 && list.includes(p2) && !preferred.includes(p2)) {
                preferred.push(p2);
            }
            
            // 检查平衡度
            const currentOff = context.stats[staff.uid].OFF;
            const avgTarget = context.avgLeaveTarget;
            const daysPassed = Object.keys(context.assignments[staff.uid]).length;
            const expectedOff = Math.floor((avgTarget / context.daysInMonth) * daysPassed);
            
            // 檢查平衡度
            if (currentOff < expectedOff - 6) {
                // 非常严重落后（6天以上）：完全开放
                list = ['D', 'E', 'N', 'OFF'];
                if (constraints.isPregnant || constraints.isPostpartum) {
                    list = list.filter(s => s !== 'N' && s !== 'E');
                }
            } else if (currentOff < expectedOff - 4) {
                // 严重落后（4-6天）：保留强偏好，开放白班
                if (p1) {
                    preferred.push('D');
                    if (list.includes(p1)) preferred.push(p1);
                }
                list = preferred;
            } else if (currentOff < expectedOff - 2) {
                // 轻微落后（2-4天）：保留强偏好和弱偏好
                list = preferred;
            } else {
                // 正常或领先：严格遵守偏好
                list = preferred;
            }
        }

        return list;
    }

    static filterWhitelistRules(context, staff, day, whitelist) {
        const prevShift = this.getShift(context, staff.uid, day - 1);
        const nextShift = this.getShift(context, staff.uid, day + 1);
        const shiftMap = this.getShiftMap(context.settings);
        const maxCons = staff.constraints?.maxConsecutive || context.rules.maxWorkDays || 6;
        const currentConsecutive = context.stats[staff.uid].consecutive;
        
        return whitelist.filter(shift => {
            // 1. 檢查 11 小時間隔
            if (!RuleEngine.checkShiftInterval(prevShift, shift, shiftMap, 660)) {
                return false;
            }
            
            // 2. 檢查連續上班天數 (規則 3.2)
            if (['D', 'E', 'N'].includes(shift)) {
                const willBeConsecutive = currentConsecutive + 1;
                
                if (willBeConsecutive > maxCons) {
                    // 超過最大連班天數，除非是連 7 豁免
                    if (willBeConsecutive === maxCons + 1 && context.rules.allowConsecutive7) {
                        // 允許連 7，但必須是 OFF
                        return shift === 'OFF';
                    }
                    return false;
                }
            }
            
            // 3. 檢查大夜前置 (規則 3.3)
            if (shift === 'N' && prevShift !== 'OFF' && prevShift !== 'N' && context.rules.preNightOff) {
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
        const shifts = ['D', 'E', 'N'];
        
        // 1. 統計當日班次需求和已排人數
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
        
        // 2. 優先處理包班員工 (規則 2A-2.3)
        const sortedBlanks = [...blankList].sort((a, b) => {
            const aIsPackage = a.whitelist.includes('E') && !a.whitelist.includes('D') || a.whitelist.includes('N') && !a.whitelist.includes('D');
            const bIsPackage = b.whitelist.includes('E') && !b.whitelist.includes('D') || b.whitelist.includes('N') && !b.whitelist.includes('D');
            
            if (aIsPackage && !bIsPackage) return -1;
            if (!aIsPackage && bIsPackage) return 1;
            
            // 其次，休假少的優先
            return context.stats[a.staff.uid].OFF - context.stats[b.staff.uid].OFF;
        });
        
        for (const { staff, whitelist } of sortedBlanks) {
            let assigned = false;
            
            // 優先選擇需求赤字最大的班別 (規則 2A-2.4)
            const deficitShifts = shifts
                .filter(shift => whitelist.includes(shift) && currentCounts[shift] < required[shift])
                .sort((a, b) => (required[b] - currentCounts[b]) - (required[a] - currentCounts[a]));
            
            for (const shift of deficitShifts) {
                this.assign(context, staff.uid, day, shift);
                currentCounts[shift]++;
                assigned = true;
                break;
            }
            
            if (!assigned) {
                // 如果沒有赤字班別，則檢查是否可以排 OFF
                if (whitelist.includes('OFF')) {
                    this.assign(context, staff.uid, day, 'OFF');
                } else {
                    // 如果連 OFF 都不在白名單內 (極少見，除非是預排指定上班)，則排白名單中的第一個班次
                    // 為了避免無限循環或邏輯錯誤，這裡強制排 OFF
                    this.assign(context, staff.uid, day, 'OFF');
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
        
        // 1. 統計當日超額人數
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
        
        // 2. 確定可回溯標記 OFF 的配額
        const availableLeaveQuota = dailyLeaveQuotas[targetDay] - context.stats.totalOFF;
        const retroactiveOffQuota = Math.min(overstaffedCount, availableLeaveQuota);
        
        if (retroactiveOffQuota <= 0) return;
        
        // 3. 找出所有超額班次的員工
        let candidates = [];
        shifts.forEach(shift => {
            if (currentCounts[shift] > required[shift]) {
                const overCount = currentCounts[shift] - required[shift];
                const staffUids = staffList.map(s => s.uid).filter(uid => assignments[uid][targetDay] === shift);
                
                // 排除被鎖定的人
                const eligibleStaff = staffUids.filter(uid => !this.isLocked(context, uid, targetDay));
                
                // 優先選擇休假天數較少的員工進行回溯 (規則 2B.3)
                eligibleStaff.sort((a, b) => context.stats[a].OFF - context.stats[b].OFF);
                
                // 排除上1休1模式 (規則 2B.4)
                const finalCandidates = eligibleStaff.filter(uid => {
                    const prevShift = this.getShift(context, uid, targetDay - 1);
                    const nextShift = this.getShift(context, uid, targetDay + 1);
                    
                    // 如果前一天是 OFF 且後一天是 OFF，則排除 (避免 OFF-OFF-OFF)
                    if (prevShift === 'OFF' && nextShift === 'OFF') return false;
                    
                    // 如果前一天是上班且後一天是上班，則保留 (優先讓連班的人休息)
                    if (['D','E','N'].includes(prevShift) && ['D','E','N'].includes(nextShift)) return true;
                    
                    return true; // 其他情況保留
                });
                
                candidates.push(...finalCandidates.slice(0, overCount).map(uid => ({ uid, shift })));
            }
        });
        
        // 4. 執行回溯標記 OFF
        let count = retroactiveOffQuota;
        
        // 再次排序：休假少的優先
        candidates.sort((a, b) => context.stats[a.uid].OFF - context.stats[b.uid].OFF);
        
        for (const { uid, shift } of candidates) {
            if (count <= 0) break;
            
            // 檢查轉 OFF 後是否違反規則 (主要檢查前後班次間隔)
            const prevShift = this.getShift(context, uid, targetDay - 1);
            const nextShift = this.getShift(context, uid, targetDay + 1);
            const shiftMap = this.getShiftMap(context.settings);
            
            // 檢查前一個班次和 OFF 之間是否合法 (OFF 必然合法)
            // 檢查 OFF 和後一個班次之間是否合法 (OFF 必然合法)
            // 這裡不需要額外檢查，因為 OFF 必然合法，且不影響連續上班天數
            
            this.assign(context, uid, targetDay, 'OFF');
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
                    this.assign(context, staff.uid, d, 'OFF');
                }
            }
        });
    }

    // =========================================================================
    // ✅ v2.5 多階段全月總平衡
    // =========================================================================
    static enhancedGlobalBalance(context) {
        console.log("🔄 開始 v2.5 多階段全月平衡...");
        
        // 階段 1：平衡 OFF 總數
        this.balanceOFF(context);
        
        // 階段 2：分別平衡小夜班（E）- 只在偏好 E 的人之間
        this.balanceSpecificShiftWithPreference(context, 'E', '小夜');
        
        // 階段 3：分別平衡大夜班（N）- 只在偏好 N 的人之間
        this.balanceSpecificShiftWithPreference(context, 'N', '大夜');
        
        // 階段 4：平衡假日班次
        this.balanceWeekendShifts(context);
        
        // 階段 5：優化偏好滿足度
        this.optimizePreferences(context);
        
        console.log("✅ v2.5 全月平衡完成");
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
            const tooFewOff = sorted.slice(0, Math.ceil(sorted.length * 0.4)); // 休假太少 (Overworked)
            const tooManyOff = sorted.slice(-Math.ceil(sorted.length * 0.4)).reverse(); // 休假太多 (Underworked)
            
            // 策略：將休假太多者的 OFF 換給休假太少者的 上班班次
            for (const fewOffUser of tooFewOff) {
                let swappedThisUser = false;
                
                // 遍歷休假太少者的所有上班日
                for (let d = 1; d <= daysInMonth && !swappedThisUser; d++) {
                    const shift = assignments[fewOffUser.uid][d];
                    
                    // 必須是上班班次且未鎖定
                    if (!['D','E','N'].includes(shift) || this.isLocked(context, fewOffUser.uid, d)) {
                        continue;
                    }
                    
                    for (const manyOffUser of tooManyOff) {
                        if (fewOffUser.uid === manyOffUser.uid) continue;
                        
                        // 檢查休假太多者這天是否為 OFF 且未鎖定
                        if (assignments[manyOffUser.uid][d] !== 'OFF' || this.isLocked(context, manyOffUser.uid, d)) {
                            continue;
                        }
                        
                        // 檢查交換後的班表是否合法 (manyOffUser 換成 shift, fewOffUser 換成 OFF)
                        // 由於 fewOffUser 換成 OFF 必然合法，只需檢查 manyOffUser 換成 shift 是否合法
                        if (this.canSwap(context, manyOffUser.uid, fewOffUser.uid, d, shift)) {
                            // 執行交換
                            this.assign(context, fewOffUser.uid, d, 'OFF'); // 休假太少者換成 OFF
                            this.assign(context, manyOffUser.uid, d, shift); // 休假太多者換成 shift
                            swapCount++;
                            swappedThisUser = true;
                            break;
                        }
                    }
                }
                // 每次迭代只交換一次，以確保平衡度計算準確
                if (swappedThisUser) break; 
            }
            
            if (swapCount === 0) {
                console.log("    ⚠️ 無法進一步優化 OFF");
                break;
            }
        }
    }
    
    // ✅ v2.5 改进：只在偏好该班次的人之间平衡
    static balanceSpecificShiftWithPreference(context, shiftType, shiftName) {
        const { staffList, assignments, stats, daysInMonth, preferences } = context;
        
        console.log(`  📊 階段: 平衡${shiftName}班 (${shiftType}) - 只在偏好該班次的人之間`);
        
        // 筛选出偏好该班次的员工
        const eligibleStaff = staffList.filter(staff => {
            const prefs = preferences[staff.uid] || {};
            const p1 = prefs.priority1;
            const p2 = prefs.priority2;
            const p3 = prefs.priority3;
            return p1 === shiftType || p2 === shiftType || p3 === shiftType;
        });
        
        if (eligibleStaff.length === 0) {
            console.log(`    ⚠️ 没有员工偏好${shiftName}班，跳过`);
            return;
        }
        
        console.log(`    符合条件的员工数: ${eligibleStaff.length}`);
        
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
            
            // 策略：將 tooMany 的 shiftType 換給 tooFew 的其他班次
            for (const fewUser of tooFew) {
                let swappedThisUser = false;
                
                for (let d = 1; d <= daysInMonth && !swappedThisUser; d++) {
                    const shift = assignments[fewUser.uid][d];
                    
                    // fewUser 必須是其他班次
                    if (shift === shiftType || shift === 'OFF' || this.isLocked(context, fewUser.uid, d)) {
                        continue;
                    }
                    
                    for (const manyUser of tooMany) {
                        if (fewUser.uid === manyUser.uid) continue;
                        
                        // manyUser 必須是 shiftType 且未鎖定
                        if (assignments[manyUser.uid][d] !== shiftType || this.isLocked(context, manyUser.uid, d)) {
                            continue;
                        }
                        
                        // 檢查交換後的班表是否合法 (fewUser 換成 shiftType, manyUser 換成 shift)
                        if (this.canSwap(context, fewUser.uid, manyUser.uid, d, shiftType) &&
                            this.canSwap(context, manyUser.uid, fewUser.uid, d, shift)) {
                            
                            // 執行交換
                            this.assign(context, fewUser.uid, d, shiftType);
                            this.assign(context, manyUser.uid, d, shift);
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
    
    // 階段 4：平衡假日班次
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
            
            // 策略：將 tooMany 的假日班次換給 tooFew 的假日 OFF
            for (const fewUser of tooFew) {
                let swappedThisUser = false;
                
                for (let d = 1; d <= daysInMonth && !swappedThisUser; d++) {
                    const date = new Date(context.year, context.month - 1, d);
                    const dayOfWeek = date.getDay();
                    
                    // 必須是假日
                    if (dayOfWeek !== 0 && dayOfWeek !== 6) continue;
                    
                    const shift = assignments[fewUser.uid][d];
                    
                    // fewUser 必須是 OFF 且未鎖定
                    if (shift !== 'OFF' || this.isLocked(context, fewUser.uid, d)) {
                        continue;
                    }
                    
                    for (const manyUser of tooMany) {
                        if (fewUser.uid === manyUser.uid) continue;
                        
                        const manyShift = assignments[manyUser.uid][d];
                        
                        // manyUser 必須是上班班次且未鎖定
                        if (!['D','E','N'].includes(manyShift) || this.isLocked(context, manyUser.uid, d)) {
                            continue;
                        }
                        
                        // 檢查交換後的班表是否合法 (fewUser 換成 manyShift, manyUser 換成 OFF)
                        if (this.canSwap(context, fewUser.uid, manyUser.uid, d, manyShift)) {
                            
                            // 執行交換
                            this.assign(context, fewUser.uid, d, manyShift);
                            this.assign(context, manyUser.uid, d, 'OFF');
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
    
    // 階段 5：優化偏好滿足度
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
    
    // =========================================================================
    // 🔧 輔助函式
    // =========================================================================
    
    // 檢查是否可以交換班次
    static canSwap(context, uid1, uid2, day, shift) {
        const staff2 = context.staffList.find(s => s.uid === uid2);
        if (!staff2) return false;
        
        let whitelist = this.generateWhitelist(context, staff2);
        
        const prevShift = this.getShift(context, uid2, day - 1);
        const nextShift = this.getShift(context, uid2, day + 1);
        const shiftMap = this.getShiftMap(context.settings);
        
        // 1. 檢查 11 小時間隔 (前一天)
        if (!RuleEngine.checkShiftInterval(prevShift, shift, shiftMap, 660)) {
            return false;
        }
        
        // 2. 檢查 11 小時間隔 (後一天)
        if (nextShift && ['D','E','N'].includes(nextShift)) {
            if (!RuleEngine.checkShiftInterval(shift, nextShift, shiftMap, 660)) {
                return false;
            }
        }
        
        // 3. 檢查連續上班天數
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
        
        // 4. 檢查是否在白名單內
        return whitelist.includes(shift);
    }

    static assign(context, uid, day, shift) {
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
        
        // ✅ v2.5 验证：检查班别种类数
        if (context.stats[uid].shiftTypes.size > 2) {
            console.warn(`⚠️ ${uid} 班别种类超过 2 种: ${Array.from(context.stats[uid].shiftTypes).join(', ')}`);
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

    // =========================================================================
    // 🔄 新增：日班次平衡 (超額轉缺額)
    // =========================================================================
    static balanceDailyShifts(context, day) {
        const { assignments, staffReq } = context;
        const dayOfWeek = new Date(context.year, context.month - 1, day).getDay();
        const shifts = ['D', 'E', 'N'];
        
        // 1. 統計當日班次狀態
        const currentCounts = { D: 0, E: 0, N: 0 };
        const staffByShift = { D: [], E: [], N: [] };
        
        Object.keys(assignments).forEach(uid => {
            const shift = assignments[uid][day];
            if (shifts.includes(shift)) {
                currentCounts[shift]++;
                staffByShift[shift].push(uid);
            }
        });
        
        // 2. 識別超額班次 (Overstaffed) 和缺額班次 (Understaffed)
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
        
        // 3. 嘗試從超額班次轉移到缺額班次
        for (const over of overstaffed) {
            for (const under of understaffed) {
                if (over.diff <= 0 || under.diff <= 0) continue;
                
                // 找出超額班次中，可以轉到缺額班次的候選人
                const candidates = staffByShift[over.shift].filter(uid => {
                    // 排除被鎖定的人
                    if (this.isLocked(context, uid, day)) return false;
                    
                    // 檢查轉班後是否合法 (將 uid 從 over.shift 轉為 under.shift)
                    // 由於是同一天轉班，只需檢查 uid 轉為 under.shift 是否合法
                    return this.canSwap(context, uid, uid, day, under.shift);
                });
                
                // 優先選擇休假天數較少的員工進行轉班 (鼓勵多上班)
                candidates.sort((a, b) => context.stats[a].OFF - context.stats[b].OFF);
                
                const transfers = Math.min(over.diff, under.diff, candidates.length);
                
                for (let i = 0; i < transfers; i++) {
                    const uid = candidates[i];
                    
                    // 執行轉班
                    this.assign(context, uid, day, under.shift);
                    
                    // 更新統計
                    context.stats[uid][over.shift]--;
                    context.stats[uid][under.shift]++;
                    
                    over.diff--;
                    under.diff--;
                    balanceCount++;
                    
                    context.logs.push(`✅ Day ${day}: ${uid} 從 ${over.shift} 轉為 ${under.shift} (平衡)`);
                }
            }
        }
        
        if (balanceCount > 0) {
            context.logs.push(`✅ Day ${day}: 日班次平衡完成，共轉移 ${balanceCount} 人次`);
        } else {
            context.logs.push(`ℹ️ Day ${day}: 日班次平衡未發生轉移`);
        }
    }
}
