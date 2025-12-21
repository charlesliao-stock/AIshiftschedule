import { RuleEngine } from "./RuleEngine.js";

const MAX_RUNTIME = 60000;

export class AutoScheduler {

    static async run(currentSchedule, staffList, unitSettings, preScheduleData, strategyCode = 'A') {
        console.log(`🚀 AI 排班啟動 (v3.1 修正版): 策略 ${strategyCode}`);
        const startTime = Date.now();

        try {
            const prevMonthData = preScheduleData?.prevAssignments || {};
            const context = this.prepareContext(currentSchedule, staffList, unitSettings, preScheduleData, prevMonthData);

            // 🎯 子步驟 1：準備工作
            this.step1_Preparation(context);

            // 🔄 逐日排班
            for (let day = 1; day <= context.daysInMonth; day++) {
                if (Date.now() - startTime > MAX_RUNTIME) {
                    context.logs.push("⚠️ 運算超時，提前結束");
                    break;
                }

                if (day > 1) {
                    this.step2B_Cycle2_FillGapsWithConsecutive3(context, day - 1);
                    this.step2B_Cycle3_AdjustShiftToOFF(context, day - 1);
                }

                this.step2A_ScheduleToday(context, day);
            }

            // 🎯 子步驟 3：月底收尾與最終平衡
            if (context.daysInMonth > 0) {
                this.step2B_Cycle2_FillGapsWithConsecutive3(context, context.daysInMonth);
                this.step2B_Cycle3_AdjustShiftToOFF(context, context.daysInMonth);
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

    static prepareContext(schedule, staffList, unitSettings, preSchedule, prevMonthData = {}) {
        const assignments = {};
        const stats = {};
        const preferences = {}; 
        
        const allShifts = unitSettings.settings?.shifts?.map(s => s.code) || ['D', 'E', 'N'];

        staffList.forEach(staff => {
            const uid = staff.uid;
            assignments[uid] = {};
            
            // 計算上月結尾的連續上班天數
            let prevConsecutive = 0;
            let lastShift = 'OFF';
            
            if (prevMonthData[uid]) {
                const days = Object.keys(prevMonthData[uid]).map(Number).sort((a, b) => b - a);
                for (const d of days) {
                    const s = prevMonthData[uid][d];
                    if (['D', 'E', 'N'].includes(s)) {
                        prevConsecutive++;
                    } else {
                        break;
                    }
                }
                if (days.length > 0) lastShift = prevMonthData[uid][days[0]];
            }

            // 統計預班中的 OFF 天數
            let preOffCount = 0;
            const staffWishes = preSchedule?.submissions?.[uid]?.wishes || {};
            Object.values(staffWishes).forEach(w => {
                if (w === 'OFF' || w === 'M_OFF') preOffCount++;
            });

            stats[uid] = { 
                OFF: 0, 
                preOffCount: preOffCount,
                consecutive: prevConsecutive,
                lastShift: lastShift,
                weekendShifts: 0,
                shiftTypes: new Set()
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
            dailyLeaveQuotas: {},
            prevMonthData: prevMonthData // ✅ 保存上月資料供查詢
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
        const { staffList, staffReq } = context;
        const dayOfWeek = new Date(context.year, context.month - 1, day).getDay();
        const blankList = []; 

        // 1. 計算目標需求和當前人數
        const targetCounts = {
            D: staffReq['D']?.[dayOfWeek] || 0,
            E: staffReq['E']?.[dayOfWeek] || 0,
            N: staffReq['N']?.[dayOfWeek] || 0
        };

        const currentCounts = { D: 0, E: 0, N: 0 };
        Object.values(context.assignments).forEach(shifts => {
            if (shifts[day] && currentCounts[shifts[day]] !== undefined) {
                currentCounts[shifts[day]]++;
            }
        });

        const sortedStaff = [...staffList].sort((a, b) => {
            const statsA = context.stats[a.uid];
            const statsB = context.stats[b.uid];
            
            const totalPotentialOffA = statsA.OFF + statsA.preOffCount;
            const totalPotentialOffB = statsB.OFF + statsB.preOffCount;
            if (totalPotentialOffA !== totalPotentialOffB) {
                return totalPotentialOffA - totalPotentialOffB;
            }
            
            const date = new Date(context.year, context.month - 1, day);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            if (isWeekend) {
                if (statsA.weekendShifts !== statsB.weekendShifts) {
                    return statsA.weekendShifts - statsB.weekendShifts;
                }
            }
            
            return statsA.consecutive - statsB.consecutive;
        });

        for (const staff of sortedStaff) {
            // ✅ 規則 0：強制硬規則檢查 - 若已連上 6 天，直接給 OFF
            const currentConsecutive = context.stats[staff.uid].consecutive;
            const maxCons = staff.constraints?.maxConsecutive || context.rules.maxWorkDays || 6;
            
            if (currentConsecutive >= maxCons) {
                if (!this.isLocked(context, staff.uid, day)) {
                    this.assign(context, staff.uid, day, 'OFF');
                    continue;
                }
            }

            // 檢查預班
            if (this.checkPreSchedule(context, staff, day)) continue;

            // 生成白名單
            let whitelist = this.generateWhitelist(context, staff);
            whitelist = this.filterWhitelistRules(context, staff, day, whitelist);

            // ✅ 修正：若前一天是 OFF，立即分配當天需要的班別
            const prevShift = this.getShift(context, staff.uid, day - 1);
            if (prevShift === 'OFF') {
                let assigned = false;
                
                // 找出缺口最大的班別（優先填補）
                const gaps = ['D', 'E', 'N']
                    .map(s => ({ shift: s, gap: targetCounts[s] - currentCounts[s] }))
                    .filter(item => item.gap > 0 && whitelist.includes(item.shift))
                    .sort((a, b) => b.gap - a.gap);
                
                if (gaps.length > 0) {
                    this.assign(context, staff.uid, day, gaps[0].shift);
                    currentCounts[gaps[0].shift]++;
                    assigned = true;
                }
                
                if (assigned) continue;
            }

            // 嘗試延續前一天班別
            if (this.tryContinuePreviousShift(context, staff, day, whitelist)) {
                const shift = context.assignments[staff.uid][day];
                if (currentCounts[shift] !== undefined) {
                    currentCounts[shift]++;
                }
                continue;
            }

            blankList.push({ staff, whitelist });
        }

        this.fillBlanks(context, day, blankList, currentCounts, targetCounts);
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

    // ✅ v3.1 修正：移除「平衡落後開放班別」邏輯，嚴格遵守偏好過濾
    static generateWhitelist(context, staff) {
        let list = ['D', 'E', 'N', 'OFF'];
        const constraints = staff.constraints || {};
        const prefs = context.preferences[staff.uid] || {};

        // 孕哺限制
        if (constraints.isPregnant || constraints.isPostpartum) {
            list = list.filter(s => s !== 'N');
        }

        // ✅ 確定允許的夜班類型（E 或 N，不能兩者都有）
        const p1 = prefs.priority1;
        const p2 = prefs.priority2;
        const p3 = prefs.priority3;
        
        let allowedNightShift = null;
        if (p1 === 'E' || p2 === 'E' || p3 === 'E') {
            allowedNightShift = 'E';
        } else if (p1 === 'N' || p2 === 'N' || p3 === 'N') {
            allowedNightShift = 'N';
        }
        
        if (allowedNightShift === 'E') {
            list = list.filter(s => s !== 'N');
        } else if (allowedNightShift === 'N') {
            list = list.filter(s => s !== 'E');
        }

        // ✅ v3.1 修正：偏好過濾（不再因平衡落後而開放）
        if (p1 || p2) {
            const preferred = ['OFF'];
            
            if (p1 && list.includes(p1)) {
                preferred.push(p1);
            }
            
            if (p2 && list.includes(p2) && !preferred.includes(p2)) {
                preferred.push(p2);
            }
            
            list = preferred;
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

    static fillBlanks(context, day, blankList, currentCounts, targetCounts) {
        // 排序待分配名單 (休假少者優先)
        blankList.sort((a, b) => {
            const statsA = context.stats[a.staff.uid];
            const statsB = context.stats[b.staff.uid];
            const totalA = statsA.OFF + statsA.preOffCount;
            const totalB = statsB.OFF + statsB.preOffCount;
            return totalA - totalB;
        });

        for (const { staff, whitelist } of blankList) {
            let assigned = false;

            // 優先填補缺口
            const sortedShifts = ['D', 'E', 'N'].sort((a, b) => {
                const deficitA = targetCounts[a] - currentCounts[a];
                const deficitB = targetCounts[b] - currentCounts[b];
                return deficitB - deficitA;
            });

            for (const shift of sortedShifts) {
                if (currentCounts[shift] < targetCounts[shift] && whitelist.includes(shift)) {
                    this.assign(context, staff.uid, day, shift);
                    currentCounts[shift]++;
                    assigned = true;
                    break;
                }
            }

            // 保底分配
            if (!assigned) {
                const sortedShifts = ['D', 'E', 'N'].sort((a, b) => currentCounts[a] - currentCounts[b]);
                for (const shift of sortedShifts) {
                    if (whitelist.includes(shift)) {
                        this.assign(context, staff.uid, day, shift);
                        currentCounts[shift]++;
                        assigned = true;
                        break;
                    }
                }
            }

            if (!assigned) {
                this.assign(context, staff.uid, day, 'OFF');
            }
        }
    }

    // =========================================================================
    // ✅ v3.1 新增：計算從最近OFF後的連續同班天數
    // =========================================================================
    static getConsecutiveDaysFromOff(context, uid, targetDay, targetShift) {
        // 1. 從當天往前找最近的 OFF
        let lastOffDay = 0; // 0 代表找不到（月初前）
        
        for (let d = targetDay - 1; d >= 1; d--) {
            const shift = this.getShift(context, uid, d);
            if (shift === 'OFF' || shift === 'M_OFF') {
                lastOffDay = d;
                break;
            }
        }
        
        // 2. 如果當月沒找到 OFF，查上個月
        if (lastOffDay === 0 && context.prevMonthData[uid]) {
            const prevMonth = context.prevMonthData[uid];
            const prevDays = Object.keys(prevMonth).map(Number).sort((a, b) => b - a);
            
            for (const d of prevDays) {
                if (prevMonth[d] === 'OFF' || prevMonth[d] === 'M_OFF') {
                    // 找到上個月的OFF，記錄相對位置
                    lastOffDay = -1; // 標記為上個月
                    break;
                }
            }
        }
        
        // 3. 從 OFF 後一天開始計算連續天數
        let count = 0;
        let startDay = lastOffDay + 1;
        
        // 如果 OFF 在上個月，從本月第1天開始算
        if (lastOffDay === -1) {
            startDay = 1;
        } else if (lastOffDay === 0) {
            // 完全找不到 OFF（整個月+上個月都沒有），從第1天開始算
            startDay = 1;
        }
        
        for (let d = startDay; d <= targetDay; d++) {
            const shift = this.getShift(context, uid, d);
            if (shift === targetShift) {
                count++;
            } else if (shift === 'OFF' || shift === 'M_OFF') {
                // 中間有OFF，重新計算
                count = 0;
            } else if (['D', 'E', 'N'].includes(shift) && shift !== targetShift) {
                // 中間有其他班別，中斷連續
                count = 0;
            }
        }
        
        return count;
    }

    // =========================================================================
    // ✅ v3.1 修正：第二循環 - 利用連續3天同班者填補缺口
    // =========================================================================
    static step2B_Cycle2_FillGapsWithConsecutive3(context, targetDay) {
        const { assignments, staffReq, staffList } = context;
        const dayOfWeek = new Date(context.year, context.month - 1, targetDay).getDay();

        console.log(`  🔄 第二循環-規則1: 利用連續3天同班者填補缺口 (Day ${targetDay})`);

        // 1. 計算當日各班缺口
        const targetCounts = {
            D: staffReq['D']?.[dayOfWeek] || 0,
            E: staffReq['E']?.[dayOfWeek] || 0,
            N: staffReq['N']?.[dayOfWeek] || 0
        };

        const currentCounts = { D: 0, E: 0, N: 0 };
        Object.values(assignments).forEach(shifts => {
            if (shifts[targetDay] && currentCounts[shifts[targetDay]] !== undefined) {
                currentCounts[shifts[targetDay]]++;
            }
        });

        const gaps = ['D', 'E', 'N']
            .map(s => ({ shift: s, gap: targetCounts[s] - currentCounts[s] }))
            .filter(item => item.gap > 0);

        if (gaps.length === 0) {
            console.log(`    ✅ 無缺口，跳過`);
            return;
        }

        console.log(`    缺口: ${gaps.map(g => `${g.shift}=${g.gap}`).join(', ')}`);

        // 2. 找出所有「已連續3天同班」的員工
        const consecutive3Staff = [];
        
        staffList.forEach(staff => {
            if (this.isLocked(context, staff.uid, targetDay)) return;
            
            const currentShift = assignments[staff.uid][targetDay];
            if (!['D', 'E', 'N'].includes(currentShift)) return;
            
            const consCount = this.getConsecutiveDaysFromOff(context, staff.uid, targetDay, currentShift);
            
            if (consCount >= 3) {
                consecutive3Staff.push({
                    uid: staff.uid,
                    staff: staff,
                    currentShift: currentShift,
                    consCount: consCount
                });
            }
        });

        console.log(`    找到 ${consecutive3Staff.length} 位連續3天同班的員工`);

        // 3. 嘗試轉換這些員工去填補缺口
        let converted = 0;
        for (const item of consecutive3Staff) {
            // 找出符合條件的缺口班別（在白名單內 + 有缺口）
            let whitelist = this.generateWhitelist(context, item.staff);
            whitelist = this.filterWhitelistRules(context, item.staff, targetDay, whitelist);
            
            const eligibleGaps = gaps.filter(g => 
                g.gap > 0 && 
                whitelist.includes(g.shift) &&
                g.shift !== item.currentShift
            );
            
            if (eligibleGaps.length > 0) {
                // ✅ 隨機選一個符合條件的缺口班別
                const randomGap = eligibleGaps[Math.floor(Math.random() * eligibleGaps.length)];
                
                console.log(`    轉換: ${item.staff.name} Day${targetDay} ${item.currentShift}→${randomGap.shift} (已連${item.consCount}天)`);
                
                this.assign(context, item.uid, targetDay, randomGap.shift);
                currentCounts[item.currentShift]--;
                currentCounts[randomGap.shift]++;
                randomGap.gap--;
                converted++;
            }
        }

        console.log(`    ✅ 共轉換 ${converted} 人`);
    }

    // =========================================================================
    // ✅ v3.1 修正：第二循環規則2 - 超額班別調整
    // =========================================================================
    static step2B_Cycle3_AdjustShiftToOFF(context, targetDay) {
        const { assignments, staffReq, dailyLeaveQuotas, stats, staffList } = context;
        const dayOfWeek = new Date(context.year, context.month - 1, targetDay).getDay();

        console.log(`  🔄 第二循環-規則2: 超額班別調整 (Day ${targetDay})`);

        const currentCounts = { D: 0, E: 0, N: 0 };
        const staffByShift = { D: [], E: [], N: [] };

        Object.keys(assignments).forEach(uid => {
            const shift = assignments[uid][targetDay];
            if (['D', 'E', 'N'].includes(shift)) {
                currentCounts[shift]++;
                staffByShift[shift].push(uid);
            }
        });

        // 1. 找出超額的班別
        const overstaffedShifts = [];
        ['D', 'E', 'N'].forEach(shift => {
            const req = staffReq[shift]?.[dayOfWeek] || 0;
            if (currentCounts[shift] > req) {
                overstaffedShifts.push({ 
                    shift, 
                    surplus: currentCounts[shift] - req 
                });
            }
        });

        if (overstaffedShifts.length === 0) {
            console.log(`    ✅ 無超額班別`);
            return;
        }

        console.log(`    超額: ${overstaffedShifts.map(o => `${o.shift}=+${o.surplus}`).join(', ')}`);

        // 2. 計算當天其他班別缺口
        const targetCounts = {
            D: staffReq['D']?.[dayOfWeek] || 0,
            E: staffReq['E']?.[dayOfWeek] || 0,
            N: staffReq['N']?.[dayOfWeek] || 0
        };

        const gaps = ['D', 'E', 'N']
            .map(s => ({ shift: s, gap: targetCounts[s] - currentCounts[s] }))
            .filter(item => item.gap > 0);

        // 3. 處理每個超額班別
        for (const item of overstaffedShifts) {
            const { shift, surplus } = item;
            
            // 找出該超額班別中「已連續3天同班」的員工
            const consecutive3 = staffByShift[shift]
                .filter(uid => !this.isLocked(context, uid, targetDay))
                .map(uid => {
                    const consCount = this.getConsecutiveDaysFromOff(context, uid, targetDay, shift);
                    return { uid, consCount, staff: staffList.find(s => s.uid === uid) };
                })
                .filter(item => item.consCount >= 3);

            if (consecutive3.length === 0) {
                console.log(`    ${shift}班無連續3天者，跳過`);
                continue;
            }

            console.log(`    ${shift}班有 ${consecutive3.length} 位連續3天者`);

            // ✅ 隨機挑選連續3天的員工
            const shuffled = consecutive3.sort(() => Math.random() - 0.5);

            let converted = 0;
            for (const item3 of shuffled) {
                if (converted >= surplus) break; // 已處理完超額部分

                // 檢查是否有缺口可以轉換
                if (gaps.length > 0) {
                    // 生成白名單
                    let whitelist = this.generateWhitelist(context, item3.staff);
                    whitelist = this.filterWhitelistRules(context, item3.staff, targetDay, whitelist);
                    
                    // 找出符合條件的缺口（在白名單內）
                    const eligibleGaps = gaps.filter(g => 
                        g.gap > 0 && 
                        whitelist.includes(g.shift)
                    );
                    
                    if (eligibleGaps.length > 0) {
                        // ✅ 隨機選一個缺口班別
                        const randomGap = eligibleGaps[Math.floor(Math.random() * eligibleGaps.length)];
                        
                        console.log(`    轉換: ${item3.staff.name} Day${targetDay} ${shift}→${randomGap.shift} (已連${item3.consCount}天)`);
                        
                        this.assign(context, item3.uid, targetDay, randomGap.shift);
                        currentCounts[shift]--;
                        currentCounts[randomGap.shift]++;
                        randomGap.gap--;
                        converted++;
                        continue;
                    }
                }
                
                // 如果沒有缺口，或不符合白名單，改成OFF（但要檢查OFF配額）
                const maxOff = dailyLeaveQuotas[targetDay] || 0;
                let currentOffCount = Object.values(assignments).filter(sch => 
                    sch[targetDay] === 'OFF' || sch[targetDay] === 'M_OFF'
                ).length;
                
                if (currentOffCount < maxOff) {
                    console.log(`    轉換: ${item3.staff.name} Day${targetDay} ${shift}→OFF (已連${item3.consCount}天)`);
                    this.assign(context, item3.uid, targetDay, 'OFF');
                    currentCounts[shift]--;
                    currentOffCount++;
                    converted++;
                }
            }
            
            console.log(`    ${shift}班共轉換 ${converted} 人`);
        }
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
        
        // ✅ 最終防線：硬規則糾錯層
        this.enforceHardRules(context);
        
        console.log("✅ v3.0 全月平衡與硬規則糾錯完成");
    }

    /**
     * 最終防線：強制執行硬規則 (連六)
     * 掃描全月，若發現連七，強制將第七天改為 OFF (除非是預班鎖定)
     */
    static enforceHardRules(context) {
        const { staffList, assignments, daysInMonth } = context;
        console.log("  🛡️ 階段 6: 強制執行硬規則 (連六糾錯)");
        
        staffList.forEach(staff => {
            let consecutive = 0;
            
            // 包含上月結尾
            const prevMonthData = context.prevMonthData || {};
            if (prevMonthData[staff.uid]) {
                const days = Object.keys(prevMonthData[staff.uid]).map(Number).sort((a, b) => b - a);
                for (const d of days) {
                    if (['D', 'E', 'N'].includes(prevMonthData[staff.uid][d])) consecutive++;
                    else break;
                }
            }
            
            const maxCons = staff.constraints?.maxConsecutive || context.rules.maxWorkDays || 6;
            
            for (let d = 1; d <= daysInMonth; d++) {
                const s = assignments[staff.uid][d];
                if (['D', 'E', 'N'].includes(s)) {
                    consecutive++;
                    if (consecutive > maxCons) {
                        // 違反連六！強制改為 OFF
                        if (!this.isLocked(context, staff.uid, d)) {
                            console.log(`    [糾錯] ${staff.name} 第 ${d} 天連 ${consecutive}，強制改 OFF`);
                            this.assign(context, staff.uid, d, 'OFF');
                            consecutive = 0;
                        } else {
                            // 如果當天鎖定，往前找一天沒鎖定的改 OFF
                            for (let prevD = d - 1; prevD >= 1; prevD--) {
                                if (!this.isLocked(context, staff.uid, prevD) && ['D', 'E', 'N'].includes(assignments[staff.uid][prevD])) {
                                    console.log(`    [糾錯] ${staff.name} 第 ${d} 天連 ${consecutive}，回溯第 ${prevD} 天強制改 OFF`);
                                    this.assign(context, staff.uid, prevD, 'OFF');
                                    // 重新掃描該員工
                                    d = 0; 
                                    consecutive = 0;
                                    break;
                                }
                            }
                        }
                    }
                } else {
                    consecutive = 0;
                }
            }
        });
    }
    
    // 階段 1：平衡 OFF 總數
    static balanceOFF(context) {
        const { staffList, assignments, stats, daysInMonth } = context;
        
        console.log("  📊 階段 1: 平衡 OFF 總數");
        
        const maxIterations = 10;
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
            
            if (stdOff < 0.8) {
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
    
    // ✅ v2.5 改進：只在偏好該班次的人之間平衡
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
                staff: staff,
                count: stats[staff.uid][shiftType] || 0
            }));
            
            const avgCount = shiftStats.reduce((sum, s) => sum + s.count, 0) / shiftStats.length;
            const stdCount = Math.sqrt(shiftStats.reduce((sum, s) => sum + Math.pow(s.count - avgCount, 2), 0) / shiftStats.length);
            
            console.log(`    第 ${iteration + 1} 輪: 平均${shiftName}=${avgCount.toFixed(1)}, 標準差=${stdCount.toFixed(2)}`);
            
            if (stdCount < 2.0) {
                console.log(`    ✅ ${shiftName}班平衡度已達標`);
                break;
            }
            
            const sorted = [...shiftStats].sort((a, b) => a.count - b.count);
            const tooFew = sorted.slice(0, Math.ceil(sorted.length * 0.4));
            const tooMany = sorted.slice(-Math.ceil(sorted.length * 0.4)).reverse();
            
            for (const manyUser of tooMany) {
                for (let d = 1; d <= daysInMonth; d++) {
                    const shift = assignments[manyUser.uid][d];
                    
                    if (shift !== shiftType || this.isLocked(context, manyUser.uid, d)) {
                        continue;
                    }
                    
                    for (const fewUser of tooFew) {
                        if (manyUser.uid === fewUser.uid) continue;
                        
                        const theirShift = assignments[fewUser.uid][d];
                        
                        if (theirShift === 'OFF' && !this.isLocked(context, fewUser.uid, d)) {
                            if (this.canSwap(context, manyUser.uid, fewUser.uid, d, shiftType)) {
                                this.assign(context, manyUser.uid, d, 'OFF');
                                this.assign(context, fewUser.uid, d, shiftType);
                                swapCount++;
                                break;
                            }
                        }
                        
                        if (theirShift === 'D' && !this.isLocked(context, fewUser.uid, d)) {
                            if (this.canSwap(context, manyUser.uid, fewUser.uid, d, 'D') &&
                                this.canSwap(context, fewUser.uid, manyUser.uid, d, shiftType)) {
                                this.assign(context, manyUser.uid, d, 'D');
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
        
        const weekendStats = staffList.map(staff => {
            let weekendWorkDays = 0;
            for (let d = 1; d <= daysInMonth; d++) {
                const date = new Date(year, month - 1, d);
                const dayOfWeek = date.getDay();
                const shift = assignments[staff.uid][d];
                
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
        
        for (const manyUser of tooMany) {
            for (let d = 1; d <= daysInMonth; d++) {
                const date = new Date(year, month - 1, d);
                const dayOfWeek = date.getDay();
                
                if (dayOfWeek !== 0 && dayOfWeek !== 6) continue;
                
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
        
        // ✅ 強化檢查：模擬交換後，掃描全月是否會違反連六規則
        const originalShift = context.assignments[uid2][day];
        context.assignments[uid2][day] = shift; // 暫時模擬
        
        let isValid = true;
        let consecutive = 0;
        
        const prevMonthData = context.prevMonthData || {};
        if (prevMonthData[uid2]) {
            const days = Object.keys(prevMonthData[uid2]).map(Number).sort((a, b) => b - a);
            for (const d of days) {
                if (['D', 'E', 'N'].includes(prevMonthData[uid2][d])) consecutive++;
                else break;
            }
        }
        
        const maxCons = staff2.constraints?.maxConsecutive || context.rules.maxWorkDays || 6;
        
        for (let d = 1; d <= context.daysInMonth; d++) {
            const s = context.assignments[uid2][d];
            if (['D', 'E', 'N'].includes(s)) {
                consecutive++;
                if (consecutive > maxCons) {
                    isValid = false;
                    break;
                }
            } else {
                consecutive = 0;
            }
        }
        
        context.assignments[uid2][day] = originalShift; // 還原
        if (!isValid) return false;
        
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

        // ✅ 核心修正：重新計算該員工的全月統計數據，確保連續上班天數與班別種類永遠正確
        this.recalculateStaffStats(context, uid);
    }

    /**
     * 重新計算單一員工的全月統計數據
     */
    static recalculateStaffStats(context, uid) {
        const stats = context.stats[uid];
        const assignments = context.assignments[uid];
        const daysInMonth = context.daysInMonth;
        
        // 重置部分統計
        stats.OFF = 0;
        stats.weekendShifts = 0;
        stats.shiftTypes = new Set();
        ['D', 'E', 'N'].forEach(s => stats[s] = 0);
        
        // 獲取上月結尾的連續上班天數作為起點
        let currentConsecutive = 0;
        const prevMonthData = context.prevMonthData || {};
        if (prevMonthData[uid]) {
            const days = Object.keys(prevMonthData[uid]).map(Number).sort((a, b) => b - a);
            for (const d of days) {
                if (['D', 'E', 'N'].includes(prevMonthData[uid][d])) currentConsecutive++;
                else break;
            }
        }
        
        // 逐日掃描當月
        for (let d = 1; d <= daysInMonth; d++) {
            const s = assignments[d];
            if (!s) continue;
            
            if (s === 'OFF' || s === 'M_OFF') {
                stats.OFF++;
                currentConsecutive = 0;
            } else if (['D', 'E', 'N'].includes(s)) {
                stats[s]++;
                stats.shiftTypes.add(s);
                currentConsecutive++;
                
                // ✅ 統計假日工作天數
                const date = new Date(context.year, context.month - 1, d);
                if (date.getDay() === 0 || date.getDay() === 6) {
                    stats.weekendShifts++;
                }
            }
            
            if (d === Object.keys(assignments).length) {
                stats.consecutive = currentConsecutive;
            }
        }
        
        stats.consecutive = currentConsecutive;
    }

    static getShift(context, uid, day) {
        if (day < 1) {
            const prevMonthData = context.prevMonthData || {};
            if (prevMonthData[uid]) {
                const daysInPrevMonth = new Date(context.year, context.month - 1, 0).getDate();
                const targetDay = daysInPrevMonth + day;
                return prevMonthData[uid][targetDay] || 'OFF';
            }
            return 'OFF';
        }
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
