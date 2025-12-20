import { RuleEngine } from "./RuleEngine.js";

const MAX_RUNTIME = 60000;

export class AutoScheduler {

    static async run(currentSchedule, staffList, unitSettings, preScheduleData, previousMonthAssignments = {}, strategyCode = 'A') {
        console.log(`🚀 AI 排班啟動 (v3.0 邏輯優化版): 策略 ${strategyCode}`);
        const startTime = Date.now();

        try {
            const context = this.prepareContext(currentSchedule, staffList, unitSettings, preScheduleData, previousMonthAssignments);

            // 🎯 步驟 1: 準備工作
            this.step1_Preparation(context);

            // 📄 逐日排班
            for (let day = 1; day <= context.daysInMonth; day++) {
                if (Date.now() - startTime > MAX_RUNTIME) {
                    context.logs.push("⚠️ 運算超時,提前結束");
                    break;
                }

                // 執行三循環排班
                this.scheduleDayWithThreeCycles(context, day);
            }

            // 🎯 步驟 3: 月底收尾與最終平衡
            if (context.daysInMonth > 0) {
                this.step3_Finalize(context);
                this.enhancedGlobalBalance(context);
            }

            return {
                assignments: context.assignments,
                logs: context.logs,
                debugLogs: context.debugLogs
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
                shiftTypes: new Set()
            };
            
            allShifts.forEach(s => stats[uid][s] = 0);

            // 整合上個月月底 6 天的班次
            for (let d = -6; d < 0; d++) {
                if (previousMonthAssignments[uid] && previousMonthAssignments[uid][d]) {
                    assignments[uid][d] = previousMonthAssignments[uid][d];
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
            staffList,
            stats,
            preferences, 
            wishes: preSchedule?.submissions || {}, 
            staffReq: unitSettings.staffRequirements || {}, 
            settings: unitSettings.settings || {},
            rules: unitSettings.rules || {},
            logs: [],
            debugLogs: [],
            totalManDays: 0,
            avgLeaveTarget: 0,
            dailyLeaveQuotas: {}
        };
    }

    // =========================================================================
    // 📝 除錯日誌記錄器
    // =========================================================================
    
    static logDebug(context, day, stage, message, data = {}) {
        if (day > 7) return;
        
        const logEntry = {
            day,
            stage,
            message,
            timestamp: new Date().toISOString(),
            ...data
        };
        
        context.debugLogs.push(logEntry);
        console.log(`[Debug Day ${day}] ${stage}: ${message}`, data);
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
        
        if (daysInMonth >= 7) {
            this.logDebug(context, 1, '準備階段', '初始化統計', {
                staffCount,
                daysInMonth,
                totalManDays,
                totalReqDays,
                totalLeaveQuota,
                avgLeaveTarget: context.avgLeaveTarget
            });
        }
        
        context.logs.push(`📊 平均休假天數目標: ${context.avgLeaveTarget} 天`);
    }

    // =========================================================================
    // 🔄 三循環排班 (核心邏輯)
    // =========================================================================
    static scheduleDayWithThreeCycles(context, day) {
        this.logDebug(context, day, '開始排班', `=== Day ${day} 三循環排班開始 ===`);
        
        // 【第一循環】初始排班
        this.cycle1_InitialSchedule(context, day);
        
        // 【第二循環】平衡調整
        this.cycle2_BalanceAdjustment(context, day);
        
        // 【第三循環】超額消化
        this.cycle3_OverstaffResolution(context, day);
        
        this.logDebug(context, day, '排班完成', `=== Day ${day} 三循環排班結束 ===`);
    }

    // =========================================================================
    // 🔵 第一循環: 初始排班
    // =========================================================================
    static cycle1_InitialSchedule(context, day) {
        const { staffList } = context;
        
        this.logDebug(context, day, '第一循環開始', '初始排班');
        
        // 按休假天數排序 (休假少的優先)
        const sortedStaff = [...staffList].sort((a, b) => {
            return context.stats[a.uid].OFF - context.stats[b.uid].OFF;
        });

        for (const staff of sortedStaff) {
            const uid = staff.uid;
            
            // 步驟 1: 檢查預班 OFF
            if (this.checkPreScheduleOFF(context, staff, day)) {
                this.logDebug(context, day, '第一循環', `${staff.name} 預班OFF`);
                continue;
            }
            
            // 步驟 2: 檢查硬規則 (連續上班6天)
            if (this.checkHardRule(context, staff, day)) {
                this.logDebug(context, day, '第一循環', `${staff.name} 硬規則OFF`);
                continue;
            }
            
            // 步驟 3: 延續性排班
            const prevShift = this.getShift(context, uid, day - 1);
            
            if (prevShift === 'OFF') {
                // 前一天是OFF,從白名單選班
                this.assignFromWhitelist(context, staff, day);
            } else if (['D', 'E', 'N'].includes(prevShift)) {
                // 前一天有班,嘗試延續
                const whitelist = this.buildWhitelist(context, staff, day);
                
                if (whitelist.includes(prevShift)) {
                    // 可以延續
                    this.assign(context, uid, day, prevShift);
                    this.logDebug(context, day, '第一循環', `${staff.name} 延續 ${prevShift}`);
                } else {
                    // 無法延續,從白名單選班
                    this.assignFromWhitelist(context, staff, day);
                }
            }
        }
        
        // 步驟 4: 統計當日各班人數
        this.calculateDailyStats(context, day);
    }

    // =========================================================================
    // 🟢 第二循環: 平衡調整
    // =========================================================================
    static cycle2_BalanceAdjustment(context, day) {
        const { staffList } = context;
        
        this.logDebug(context, day, '第二循環開始', '平衡調整');
        
        for (const staff of staffList) {
            const uid = staff.uid;
            const currentShift = this.getShift(context, uid, day);
            
            if (this.isLocked(context, uid, day)) continue;
            
            // 步驟 1: OFF轉上班調整 (已放OFF較接近平均者)
            if (currentShift === 'OFF' && !this.isPreScheduled(context, uid, day)) {
                const currentOFF = context.stats[uid].OFF;
                const avgTarget = context.avgLeaveTarget;
                
                // 如果已放OFF接近或超過平均,考慮改上班
                if (currentOFF >= avgTarget - 1) {
                    const whitelist = this.buildWhitelist(context, staff, day);
                    const neededShift = this.findNeededShift(context, day, whitelist);
                    
                    if (neededShift) {
                        this.assign(context, uid, day, neededShift);
                        this.logDebug(context, day, '第二循環', `${staff.name} OFF→${neededShift} (OFF已足夠)`);
                        context.logs.push(`🔄 Day ${day}: ${staff.name} OFF調整為${neededShift}`);
                    }
                }
            }
            
            // 步驟 2: 連續同班調整 (連續3天同班且超額)
            if (['D', 'E', 'N'].includes(currentShift)) {
                const prev1 = this.getShift(context, uid, day - 1);
                const prev2 = this.getShift(context, uid, day - 2);
                
                if (prev1 === currentShift && prev2 === currentShift) {
                    // 連續3天同班
                    if (this.isShiftOverstaffed(context, day, currentShift)) {
                        // 且當日此班超額
                        const whitelist = this.buildWhitelist(context, staff, day);
                        const alternativeShift = this.findNeededShift(context, day, whitelist);
                        
                        if (alternativeShift && alternativeShift !== currentShift) {
                            this.assign(context, uid, day, alternativeShift);
                            this.logDebug(context, day, '第二循環', `${staff.name} ${currentShift}→${alternativeShift} (連3天調整)`);
                            context.logs.push(`🔄 Day ${day}: ${staff.name} 連續3天${currentShift}調整為${alternativeShift}`);
                        }
                    }
                }
            }
        }
        
        this.calculateDailyStats(context, day);
    }

    // =========================================================================
    // 🟡 第三循環: 超額消化
    // =========================================================================
    static cycle3_OverstaffResolution(context, day) {
        const { staffList, staffReq } = context;
        const dayOfWeek = new Date(context.year, context.month - 1, day).getDay();
        const shifts = ['D', 'E', 'N'];
        
        this.logDebug(context, day, '第三循環開始', '超額消化');
        
        // 找出超額班別
        const overstaffedShifts = [];
        shifts.forEach(shift => {
            const required = staffReq[shift]?.[dayOfWeek] || 0;
            let currentCount = 0;
            
            Object.keys(context.assignments).forEach(uid => {
                if (context.assignments[uid][day] === shift) {
                    currentCount++;
                }
            });
            
            if (currentCount > required) {
                overstaffedShifts.push({
                    shift,
                    excess: currentCount - required
                });
            }
        });
        
        if (overstaffedShifts.length === 0) {
            this.logDebug(context, day, '第三循環', '無超額,跳過');
            
            // 檢查是否所有需求都滿足
            if (this.checkAllRequirementsMet(context, day)) {
                this.logDebug(context, day, '第三循環完成', '✅ 所有班別需求已滿足,OFF分配合理');
                context.logs.push(`✅ Day ${day}: 排班完成,所有需求已滿足`);
            }
            return;
        }
        
        // 步驟 1: 超額轉OFF (優先選已放OFF較少者)
        for (const overstaffed of overstaffedShifts) {
            const { shift, excess } = overstaffed;
            
            // 找出排此班的員工
            const candidates = staffList
                .filter(staff => {
                    const uid = staff.uid;
                    return context.assignments[uid][day] === shift && 
                           !this.isLocked(context, uid, day);
                })
                .sort((a, b) => {
                    // 優先選已放OFF較少者
                    return context.stats[a.uid].OFF - context.stats[b.uid].OFF;
                });
            
            // 轉換為OFF
            let converted = 0;
            for (const staff of candidates) {
                if (converted >= excess) break;
                
                this.assign(context, staff.uid, day, 'OFF');
                this.logDebug(context, day, '第三循環', `${staff.name} ${shift}→OFF (超額消化)`);
                context.logs.push(`🔄 Day ${day}: ${staff.name} ${shift}調整為OFF (超額)`);
                converted++;
            }
        }
        
        // 步驟 2: 最終統計
        this.calculateDailyStats(context, day);
        
        // 步驟 3: 檢查完成條件
        if (this.checkAllRequirementsMet(context, day)) {
            this.logDebug(context, day, '第三循環完成', '✅ 排班完成');
        }
    }

    // =========================================================================
    // 🛠️ 白名單建立
    // =========================================================================
    static buildWhitelist(context, staff, day) {
        let list = ['D', 'E', 'N', 'OFF'];
        const constraints = staff.constraints || {};
        const prefs = context.preferences[staff.uid] || {};
        
        // 規則 1: 所有班都可以排
        
        // 規則 2: 排除孕哺不能排的班
        if (constraints.isPregnant || constraints.isPostpartum) {
            list = list.filter(s => s !== 'N' && s !== 'E');
        }
        
        // 規則 3: 排除非排班偏好的班
        const p1 = prefs.priority1;
        const p2 = prefs.priority2;
        const p3 = prefs.priority3;
        
        // 包班邏輯
        const isEOnly = (p1 === 'E' || p2 === 'E' || p3 === 'E') && 
                       !(p1 === 'N' || p2 === 'N' || p3 === 'N');
        const isNOnly = (p1 === 'N' || p2 === 'N' || p3 === 'N') && 
                       !(p1 === 'E' || p2 === 'E' || p3 === 'E');
        
        if (isEOnly) {
            list = list.filter(s => s === 'E' || s === 'OFF');
        } else if (isNOnly) {
            list = list.filter(s => s === 'N' || s === 'OFF');
        } else if ((p1 === 'D' || p2 === 'D' || p3 === 'D') && 
                   (p1 === 'E' || p2 === 'E' || p3 === 'E')) {
            list = list.filter(s => s === 'D' || s === 'E' || s === 'OFF');
        } else if ((p1 === 'D' || p2 === 'D' || p3 === 'D') && 
                   (p1 === 'N' || p2 === 'N' || p3 === 'N')) {
            list = list.filter(s => s === 'D' || s === 'N' || s === 'OFF');
        }
        
        // 規則 4: 排除與前一天間隔少於11小時的班
        const prevShift = this.getShift(context, staff.uid, day - 1);
        const shiftMap = this.getShiftMap(context.settings);
        
        list = list.filter(shift => {
            if (shift === 'OFF') return true;
            return RuleEngine.checkShiftInterval(prevShift, shift, shiftMap, 660);
        });
        
        return list;
    }

    // =========================================================================
    // 🔧 輔助函式
    // =========================================================================

    static checkPreScheduleOFF(context, staff, day) {
        const wishes = context.wishes[staff.uid]?.wishes || {};
        const wish = wishes[day];
        
        if (wish === 'OFF' || wish === 'M_OFF') {
            this.assign(context, staff.uid, day, 'OFF');
            return true;
        }
        return false;
    }

    static checkHardRule(context, staff, day) {
        const maxCons = staff.constraints?.maxConsecutive || context.rules.maxWorkDays || 6;
        const currentConsecutive = context.stats[staff.uid].consecutive;
        
        if (currentConsecutive >= maxCons) {
            this.assign(context, staff.uid, day, 'OFF');
            context.logs.push(`⚠️ ${staff.name} Day ${day}: 連續上班${currentConsecutive}天,硬規則強制OFF`);
            return true;
        }
        return false;
    }

    static assignFromWhitelist(context, staff, day) {
        const whitelist = this.buildWhitelist(context, staff, day);
        const neededShift = this.findNeededShift(context, day, whitelist);
        
        if (neededShift) {
            this.assign(context, staff.uid, day, neededShift);
        } else if (whitelist.includes('OFF')) {
            this.assign(context, staff.uid, day, 'OFF');
        } else {
            this.assign(context, staff.uid, day, 'OFF');
        }
    }

    static findNeededShift(context, day, whitelist) {
        const dayOfWeek = new Date(context.year, context.month - 1, day).getDay();
        const shifts = ['D', 'E', 'N'].filter(s => whitelist.includes(s));
        
        // 找出缺額最大的班別
        let maxDeficit = 0;
        let neededShift = null;
        
        for (const shift of shifts) {
            const required = context.staffReq[shift]?.[dayOfWeek] || 0;
            let currentCount = 0;
            
            Object.keys(context.assignments).forEach(uid => {
                if (context.assignments[uid][day] === shift) {
                    currentCount++;
                }
            });
            
            const deficit = required - currentCount;
            if (deficit > maxDeficit) {
                maxDeficit = deficit;
                neededShift = shift;
            }
        }
        
        return neededShift;
    }

    static isShiftOverstaffed(context, day, shift) {
        const dayOfWeek = new Date(context.year, context.month - 1, day).getDay();
        const required = context.staffReq[shift]?.[dayOfWeek] || 0;
        let currentCount = 0;
        
        Object.keys(context.assignments).forEach(uid => {
            if (context.assignments[uid][day] === shift) {
                currentCount++;
            }
        });
        
        return currentCount > required;
    }

    static calculateDailyStats(context, day) {
        const dayOfWeek = new Date(context.year, context.month - 1, day).getDay();
        const shifts = ['D', 'E', 'N'];
        const stats = {};
        
        shifts.forEach(shift => {
            const required = context.staffReq[shift]?.[dayOfWeek] || 0;
            let currentCount = 0;
            
            Object.keys(context.assignments).forEach(uid => {
                if (context.assignments[uid][day] === shift) {
                    currentCount++;
                }
            });
            
            stats[shift] = {
                required,
                current: currentCount,
                diff: currentCount - required
            };
        });
        
        this.logDebug(context, day, '每日統計', '班次統計', stats);
    }

    static checkAllRequirementsMet(context, day) {
        const dayOfWeek = new Date(context.year, context.month - 1, day).getDay();
        const shifts = ['D', 'E', 'N'];
        
        for (const shift of shifts) {
            const required = context.staffReq[shift]?.[dayOfWeek] || 0;
            let currentCount = 0;
            
            Object.keys(context.assignments).forEach(uid => {
                if (context.assignments[uid][day] === shift) {
                    currentCount++;
                }
            });
            
            if (currentCount < required) {
                return false;
            }
        }
        
        return true;
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
        
        const date = new Date(context.year, context.month - 1, day);
        const dayOfWeek = date.getDay();
        if ((dayOfWeek === 0 || dayOfWeek === 6) && ['D','E','N'].includes(shift)) {
            if (oldShift !== shift) {
                context.stats[uid].weekendShifts = (context.stats[uid].weekendShifts || 0) + 1;
            }
        }
    }

    static getShift(context, uid, day) {
        if (day < 1) return 'OFF';
        return context.assignments[uid]?.[day] || null;
    }

    static isLocked(context, uid, day) {
        return !!context.wishes[uid]?.wishes?.[day];
    }

    static isPreScheduled(context, uid, day) {
        const wish = context.wishes[uid]?.wishes?.[day];
        return wish === 'OFF' || wish === 'M_OFF';
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
    // ✅ 全月總平衡
    // =========================================================================
    static enhancedGlobalBalance(context) {
        console.log("🔄 開始全月平衡...");
        
        this.balanceOFF(context);
        this.balanceSpecificShiftWithPreference(context, 'E', '小夜');
        this.balanceSpecificShiftWithPreference(context, 'N', '大夜');
        this.balanceWeekendShifts(context);
        
        console.log("✅ 全月平衡完成");
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
                            this.assign(context, fewOffUser.uid, d, 'OFF');
                            this.assign(context, manyOffUser.uid, d, shift);
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
        
        console.log(`  📊 階段: 平衡${shiftName}班 (${shiftType})`);
        
        const eligibleStaff = staffList.filter(staff => {
            const prefs = preferences[staff.uid] || {};
            const p1 = prefs.priority1;
            const p2 = prefs.priority2;
            const p3 = prefs.priority3;
            return p1 === shiftType || p2 === shiftType || p3 === shiftType;
        });
        
        if (eligibleStaff.length === 0) {
            console.log(`    ⚠️ 沒有員工偏好${shiftName}班,跳過`);
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
    
    static balanceWeekendShifts(context) {
        const { staffList, assignments, stats, daysInMonth } = context;
        
        console.log("  📊 階段: 平衡假日班次");
        
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

    static canSwap(context, uid1, uid2, day, shift) {
        const staff2 = context.staffList.find(s => s.uid === uid2);
        if (!staff2) return false;
        
        let whitelist = this.buildWhitelist(context, staff2, day);
        
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
}
