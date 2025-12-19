import { RuleEngine } from "./RuleEngine.js";

const MAX_RUNTIME = 60000;

export class AutoScheduler {

    static async run(currentSchedule, staffList, unitSettings, preScheduleData, strategyCode = 'A') {
        console.log(`🚀 AI 排班啟動 (v2.3 強化平衡版): 策略 ${strategyCode}`);
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
                
                // ✅ 強化版：多輪全月總平衡
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
                lastShift: null 
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

        // ✅ 修正：反轉排序邏輯
        // OFF 越少（過勞）的人排前面 -> 優先被考慮放假
        // OFF 越多（欠班）的人排後面 -> 優先被分配工作
        const sortedStaff = [...staffList].sort((a, b) => {
            const offA = context.stats[a.uid].OFF;
            const offB = context.stats[b.uid].OFF;
            return offA - offB; // 小到大（OFF 少的先處理）
        });

        // ── 階段 1: 逐人處理 ──
        for (const staff of sortedStaff) {
            if (this.checkPreSchedule(context, staff, day)) continue;

            let whitelist = this.generateWhitelist(context, staff);
            whitelist = this.filterWhitelistRules(context, staff, day, whitelist);

            if (this.tryContinuePreviousShift(context, staff, day, whitelist)) continue;

            blankList.push({ staff, whitelist });
        }

        // ── 階段 2: 填補空白 ──
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

        // ✅ 改進：放寬偏好限制
        // 只在偏好班別可用時優先考慮，但不完全排除其他選項
        const p1 = prefs.priority1;
        const p2 = prefs.priority2;
        if (p1 || p2) {
            const preferred = ['OFF'];
            if (p1 && list.includes(p1)) preferred.push(p1);
            if (p2 && list.includes(p2)) preferred.push(p2);
            
            // 如果當前 OFF 數量遠低於平均值，允許接受非偏好班別
            const currentOff = context.stats[staff.uid].OFF;
            const avgTarget = context.avgLeaveTarget;
            const daysPassed = Object.keys(context.assignments[staff.uid]).length;
            const expectedOff = Math.floor((avgTarget / context.daysInMonth) * daysPassed);
            
            // 如果落後平均值 3 天以上，開放所有班別選項
            if (currentOff < expectedOff - 3) {
                list = ['D', 'E', 'N', 'OFF'];
                if (constraints.isPregnant || constraints.isPostpartum) {
                    list = list.filter(s => s !== 'N');
                }
            } else {
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

        // ✅ 修正：反轉排序
        // OFF 少的人排前面 -> 優先被分配 OFF（如果沒有缺額）
        // OFF 多的人排後面 -> 優先被分配工作（填補缺額）
        blankList.sort((a, b) => {
            const offA = context.stats[a.staff.uid].OFF;
            const offB = context.stats[b.staff.uid].OFF;
            return offA - offB; // 小到大
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

            // ✅ 維持原邏輯：休假最少的人優先放假
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
    // ✅ 新增：強化版全月總平衡
    // =========================================================================
    static enhancedGlobalBalance(context) {
        const { staffList, assignments, stats, daysInMonth } = context;
        
        console.log("🔄 開始強化版全月平衡...");
        
        // 多輪迭代，每輪嘗試縮小差距
        const maxIterations = 5;
        for (let iteration = 0; iteration < maxIterations; iteration++) {
            let swapCount = 0;
            
            // 1. 計算當前統計
            const offStats = staffList.map(staff => ({
                uid: staff.uid,
                staff: staff,
                off: stats[staff.uid].OFF,
                d: stats[staff.uid].D || 0,
                e: stats[staff.uid].E || 0,
                n: stats[staff.uid].N || 0
            }));
            
            // 計算平均值和標準差
            const avgOff = offStats.reduce((sum, s) => sum + s.off, 0) / offStats.length;
            const stdOff = Math.sqrt(offStats.reduce((sum, s) => sum + Math.pow(s.off - avgOff, 2), 0) / offStats.length);
            
            console.log(`  第 ${iteration + 1} 輪: 平均 OFF=${avgOff.toFixed(1)}, 標準差=${stdOff.toFixed(2)}`);
            
            // 如果標準差已經很小，提前結束
            if (stdOff < 1.5) {
                console.log("  ✅ 平衡度已達標，提前結束");
                break;
            }
            
            // 2. 找出極端值（擴大範圍到 40%）
            const sorted = [...offStats].sort((a, b) => a.off - b.off);
            const overworked = sorted.slice(0, Math.ceil(sorted.length * 0.4)); // 休太少
            const underworked = sorted.slice(-Math.ceil(sorted.length * 0.4)).reverse(); // 休太多
            
            // 3. 嘗試交換班次
            for (const busyUser of overworked) {
                let swappedThisUser = false;
                
                // 掃描該使用者的所有工作日
                for (let d = 1; d <= daysInMonth && !swappedThisUser; d++) {
                    const shift = assignments[busyUser.uid][d];
                    
                    if (!['D','E','N'].includes(shift) || this.isLocked(context, busyUser.uid, d)) {
                        continue;
                    }
                    
                    // 找一個這天放假的閒人來接班
                    for (const freeUser of underworked) {
                        // 避免自己跟自己交換
                        if (busyUser.uid === freeUser.uid) continue;
                        
                        // 檢查對方這天是否放假且未鎖定
                        if (assignments[freeUser.uid][d] !== 'OFF' || this.isLocked(context, freeUser.uid, d)) {
                            continue;
                        }
                        
                        // 檢查交換後是否符合規則
                        if (this.canSwap(context, busyUser.uid, freeUser.uid, d, shift)) {
                            // 執行交換
                            this.assign(context, busyUser.uid, d, 'OFF');
                            this.assign(context, freeUser.uid, d, shift);
                            swapCount++;
                            swappedThisUser = true;
                            break;
                        }
                    }
                }
            }
            
            console.log(`  本輪交換次數: ${swapCount}`);
            
            // 如果本輪沒有任何交換，提前結束
            if (swapCount === 0) {
                console.log("  ⚠️ 無法進一步優化，結束平衡");
                break;
            }
        }
        
        // 4. 平衡班次類型（D/E/N）
        this.balanceShiftTypes(context);
        
        console.log("✅ 全月平衡完成");
    }
    
    // 檢查是否可以交換班次
    static canSwap(context, uid1, uid2, day, shift) {
        // 檢查 uid2 是否可以接這個班
        const staff2 = context.staffList.find(s => s.uid === uid2);
        if (!staff2) return false;
        
        // 生成白名單並檢查
        let whitelist = this.generateWhitelist(context, staff2);
        
        // 暫時模擬分配，檢查規則
        const prevShift = this.getShift(context, uid2, day - 1);
        const nextShift = this.getShift(context, uid2, day + 1);
        const shiftMap = this.getShiftMap(context.settings);
        
        // 檢查間隔
        if (!RuleEngine.checkShiftInterval(prevShift, shift, shiftMap, 660)) {
            return false;
        }
        
        if (nextShift && ['D','E','N'].includes(nextShift)) {
            if (!RuleEngine.checkShiftInterval(shift, nextShift, shiftMap, 660)) {
                return false;
            }
        }
        
        // 檢查連續工作天數
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
    
    // 平衡班次類型
    static balanceShiftTypes(context) {
        const { staffList, stats } = context;
        
        ['D', 'E', 'N'].forEach(shiftType => {
            const shiftStats = staffList.map(staff => ({
                uid: staff.uid,
                staff: staff,
                count: stats[staff.uid][shiftType] || 0
            }));
            
            const avgCount = shiftStats.reduce((sum, s) => sum + s.count, 0) / shiftStats.length;
            const sorted = [...shiftStats].sort((a, b) => a.count - b.count);
            
            const tooFew = sorted.slice(0, Math.ceil(sorted.length * 0.3));
            const tooMany = sorted.slice(-Math.ceil(sorted.length * 0.3)).reverse();
            
            // 嘗試將 tooMany 的該班次轉給 tooFew
            for (const manyUser of tooMany) {
                for (let d = 1; d <= context.daysInMonth; d++) {
                    const shift = context.assignments[manyUser.uid][d];
                    
                    if (shift !== shiftType || this.isLocked(context, manyUser.uid, d)) {
                        continue;
                    }
                    
                    for (const fewUser of tooFew) {
                        const theirShift = context.assignments[fewUser.uid][d];
                        
                        // 只交換工作日，不涉及 OFF
                        if (!['D','E','N'].includes(theirShift) || this.isLocked(context, fewUser.uid, d)) {
                            continue;
                        }
                        
                        // 檢查雙向交換是否可行
                        if (this.canSwap(context, manyUser.uid, fewUser.uid, d, theirShift) &&
                            this.canSwap(context, fewUser.uid, manyUser.uid, d, shift)) {
                            // 執行交換
                            this.assign(context, manyUser.uid, d, theirShift);
                            this.assign(context, fewUser.uid, d, shift);
                            break;
                        }
                    }
                }
            }
        });
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
