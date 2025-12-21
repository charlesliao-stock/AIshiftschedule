import { RuleEngine } from "./RuleEngine.js";

const MAX_RUNTIME = 60000;

export class AutoScheduler {

    static async run(currentSchedule, staffList, unitSettings, preScheduleData, strategyCode = 'A') {
        console.log(`🚀 AI 排班啟動 (v4.2 最佳解評分版): 策略 ${strategyCode}`);
        const startTime = Date.now();

        try {
            const prevMonthData = preScheduleData?.prevAssignments || {};
            const context = this.prepareContext(currentSchedule, staffList, unitSettings, preScheduleData, prevMonthData);

            this.step1_Preparation(context);

            // 🔄 逐日排班
            for (let day = 1; day <= context.daysInMonth; day++) {
                if (Date.now() - startTime > MAX_RUNTIME) {
                    context.logs.push("⚠️ 運算超時，提前結束");
                    break;
                }

                // 1. 基礎排班
                this.cycle1_BasicAssignment(context, day);

                // 2. 智慧填補缺口 (核心修正)
                this.cycle2_SmartFill(context, day);

                // 3. 修剪超額
                this.cycle3_TrimExcess(context, day);
            }

            this.step3_Finalize(context);

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
    // 🔄 Cycle 1: 基礎分配與延續
    // =========================================================================
    static cycle1_BasicAssignment(context, day) {
        const { staffList, staffReq } = context;
        const dayOfWeek = new Date(context.year, context.month - 1, day).getDay();
        
        const targetCounts = {
            D: staffReq['D']?.[dayOfWeek] || 0,
            E: staffReq['E']?.[dayOfWeek] || 0,
            N: staffReq['N']?.[dayOfWeek] || 0
        };

        const sortedStaff = [...staffList].sort(() => Math.random() - 0.5);

        for (const staff of sortedStaff) {
            const uid = staff.uid;
            if (this.isLocked(context, uid, day)) continue;

            // 連六檢查
            const currentConsecutive = this.calculateConsecutiveDays(context, uid, day - 1);
            const maxCons = staff.constraints?.maxConsecutive || context.rules.maxWorkDays || 6;

            if (currentConsecutive >= maxCons) {
                this.assign(context, uid, day, 'OFF');
                continue;
            }

            let whitelist = this.generateWhitelist(context, staff);
            whitelist = this.filterWhitelistRules(context, staff, day, whitelist);

            const prevShift = this.getShift(context, uid, day - 1);

            if (prevShift === 'OFF' || prevShift === 'M_OFF') {
                // 前一天 OFF，優先填缺口
                const currentCounts = this.getCurrentCounts(context, day);
                const gaps = ['D', 'E', 'N']
                    .map(s => ({ shift: s, gap: targetCounts[s] - currentCounts[s] }))
                    .filter(item => item.gap > 0 && whitelist.includes(item.shift))
                    .sort((a, b) => b.gap - a.gap);

                if (gaps.length > 0) {
                    this.assign(context, uid, day, gaps[0].shift);
                } else {
                    this.assign(context, uid, day, 'OFF');
                }
            } else {
                // 前一天上班，優先延續
                if (whitelist.includes(prevShift)) {
                    this.assign(context, uid, day, prevShift);
                } else {
                    const currentCounts = this.getCurrentCounts(context, day);
                    const gaps = ['D', 'E', 'N']
                        .map(s => ({ shift: s, gap: targetCounts[s] - currentCounts[s] }))
                        .filter(item => item.gap > 0 && whitelist.includes(item.shift))
                        .sort((a, b) => b.gap - a.gap);

                    if (gaps.length > 0) {
                        this.assign(context, uid, day, gaps[0].shift);
                    } else {
                        this.assign(context, uid, day, 'OFF');
                    }
                }
            }
        }
    }

    // =========================================================================
    // 🧠 Cycle 2: 智慧填補缺口 (Smart Fill) - v4.2 核心
    // =========================================================================
    static cycle2_SmartFill(context, day) {
        const { staffList, staffReq } = context;
        const dayOfWeek = new Date(context.year, context.month - 1, day).getDay();
        const targetCounts = {
            D: staffReq['D']?.[dayOfWeek] || 0,
            E: staffReq['E']?.[dayOfWeek] || 0,
            N: staffReq['N']?.[dayOfWeek] || 0
        };

        // 限制最大迭代次數，防止無窮迴圈 (例如設為人數的 1.5 倍)
        const maxIterations = staffList.length + 10; 
        
        for (let iter = 0; iter < maxIterations; iter++) {
            // 1. 掃描當前狀態
            const currentCounts = this.getCurrentCounts(context, day);
            const gaps = ['D', 'E', 'N'].filter(s => targetCounts[s] > currentCounts[s]);
            const surpluses = ['D', 'E', 'N'].filter(s => currentCounts[s] > targetCounts[s]);

            // 如果沒有缺口，直接收工
            if (gaps.length === 0) break;

            // 2. 收集所有候選移動方案 (Candidate Moves)
            const candidates = [];

            // --- 策略 A: 從 OFF 直接補 (Direct Fill) ---
            const offStaff = staffList.filter(s => 
                !this.isLocked(context, s.uid, day) && 
                context.assignments[s.uid][day] === 'OFF'
            );

            for (const staff of offStaff) {
                let whitelist = this.generateWhitelist(context, staff);
                whitelist = this.filterWhitelistRules(context, staff, day, whitelist);

                for (const targetShift of gaps) {
                    if (whitelist.includes(targetShift)) {
                        candidates.push({
                            type: 'DIRECT',
                            staff: staff,
                            targetShift: targetShift,
                            // 分數公式：基礎分 100 + 該員工 Total OFF (假越多越優先)
                            score: 100 + context.stats[staff.uid].totalOff
                        });
                    }
                }
            }

            // --- 策略 B: 從超額班別調度 (Win-Win Swap) ---
            // 優先度最高，因為同時解決 Gap 和 Surplus
            for (const sourceShift of surpluses) {
                const sourceStaff = staffList.filter(s => 
                    !this.isLocked(context, s.uid, day) && 
                    context.assignments[s.uid][day] === sourceShift
                );

                for (const staff of sourceStaff) {
                    let whitelist = this.generateWhitelist(context, staff);
                    whitelist = this.filterWhitelistRules(context, staff, day, whitelist);

                    for (const targetShift of gaps) {
                        if (whitelist.includes(targetShift)) {
                            candidates.push({
                                type: 'SWAP_SURPLUS',
                                staff: staff,
                                targetShift: targetShift,
                                sourceShift: sourceShift,
                                // 分數公式：基礎分 200 (比 Direct 高) + Total OFF
                                score: 200 + context.stats[staff.uid].totalOff
                            });
                        }
                    }
                }
            }

            // --- 策略 C: 連鎖補位 (Chain Reaction) ---
            // A去B(填缺口)，C(OFF)去A(補空位)
            // 只有當無法直接填補時才使用，且來源班別必須「不缺人」
            for (const targetShift of gaps) {
                const validSourceShifts = ['D', 'E', 'N'].filter(s => 
                    s !== targetShift && 
                    currentCounts[s] >= targetCounts[s] // 來源至少要滿員
                );

                for (const sourceShift of validSourceShifts) {
                    // 找出中間人 (Switcher): Source -> Target
                    const potentialSwitchers = staffList.filter(s => 
                        !this.isLocked(context, s.uid, day) &&
                        context.assignments[s.uid][day] === sourceShift
                    );

                    // 找出救援者 (Reliever): OFF -> Source
                    const potentialRelievers = offStaff; 

                    for (const switcher of potentialSwitchers) {
                        let wSwitcher = this.generateWhitelist(context, switcher);
                        wSwitcher = this.filterWhitelistRules(context, switcher, day, wSwitcher);
                        
                        if (!wSwitcher.includes(targetShift)) continue;

                        for (const reliever of potentialRelievers) {
                            let wReliever = this.generateWhitelist(context, reliever);
                            wReliever = this.filterWhitelistRules(context, reliever, day, wReliever);

                            if (!wReliever.includes(sourceShift)) continue;

                            candidates.push({
                                type: 'CHAIN',
                                switcher: switcher,
                                reliever: reliever,
                                targetShift: targetShift,
                                sourceShift: sourceShift,
                                // 分數公式：基礎分 50 (最低) + 兩人 Total OFF 的平均
                                score: 50 + (context.stats[switcher.uid].totalOff + context.stats[reliever.uid].totalOff) / 2
                            });
                        }
                    }
                }
            }

            // 3. 決策：選擇最佳方案執行
            if (candidates.length === 0) {
                // 如果沒有任何方案，嘗試最後一招：找連上3天的人硬調 (Consecutive Swap)
                // 這是在沒有 OFF 人員可用時的下下策
                const panicMove = this.getConsecutivePanicMove(context, day, gaps, surpluses);
                if (panicMove) {
                    this.assign(context, panicMove.staff.uid, day, panicMove.targetShift);
                    // console.log(`  🔥 [Panic] 強制調動 ${panicMove.staff.name}`);
                    continue;
                } else {
                    break; // 真的沒招了，結束
                }
            }

            // 依分數高到低排序
            candidates.sort((a, b) => b.score - a.score);
            const bestMove = candidates[0]; // 取第一名

            // 4. 執行最佳方案
            if (bestMove.type === 'DIRECT') {
                this.assign(context, bestMove.staff.uid, day, bestMove.targetShift);
                // console.log(`  ✅ [Direct] ${bestMove.staff.name} OFF -> ${bestMove.targetShift}`);
            } 
            else if (bestMove.type === 'SWAP_SURPLUS') {
                this.assign(context, bestMove.staff.uid, day, bestMove.targetShift);
                // console.log(`  ♻️ [Swap] ${bestMove.staff.name} ${bestMove.sourceShift} -> ${bestMove.targetShift}`);
            } 
            else if (bestMove.type === 'CHAIN') {
                this.assign(context, bestMove.switcher.uid, day, bestMove.targetShift);
                this.assign(context, bestMove.reliever.uid, day, bestMove.sourceShift);
                // console.log(`  🔗 [Chain] ${bestMove.switcher.name}轉${bestMove.targetShift}, ${bestMove.reliever.name}補${bestMove.sourceShift}`);
            }

            // 執行完一次後，迴圈會回到開頭 (iter++)
            // 重新計算 counts, gaps, surpluses，根據新局勢找下一個最佳解
        }
    }

    // 輔助：當正常招數都無效時，找連上3天的人 (Panic Mode)
    static getConsecutivePanicMove(context, day, gaps, surpluses) {
        // 如果連 Surplus 都沒有，就不能調了
        if (surpluses.length === 0) return null;

        const { staffList } = context;
        
        for (const sourceShift of surpluses) {
            const candidates = staffList.filter(s => {
                if (this.isLocked(context, s.uid, day)) return false;
                if (context.assignments[s.uid][day] !== sourceShift) return false;
                const cons = this.getConsecutiveDaysFromOff(context, s.uid, day, sourceShift);
                return cons >= 3;
            });
            
            // 隨機選一個
            if (candidates.length > 0) {
                const staff = candidates[Math.floor(Math.random() * candidates.length)];
                let whitelist = this.generateWhitelist(context, staff);
                whitelist = this.filterWhitelistRules(context, staff, day, whitelist);
                
                // 找一個他能去的 Gap
                const validGaps = gaps.filter(g => whitelist.includes(g));
                if (validGaps.length > 0) {
                    return {
                        staff: staff,
                        targetShift: validGaps[0]
                    };
                }
            }
        }
        return null;
    }

    // =========================================================================
    // 🔄 Cycle 3: 修剪超額 (找假少的人去休假)
    // =========================================================================
    static cycle3_TrimExcess(context, day) {
        const { staffList, staffReq } = context;
        const dayOfWeek = new Date(context.year, context.month - 1, day).getDay();
        const targetCounts = {
            D: staffReq['D']?.[dayOfWeek] || 0,
            E: staffReq['E']?.[dayOfWeek] || 0,
            N: staffReq['N']?.[dayOfWeek] || 0
        };

        const currentCounts = this.getCurrentCounts(context, day);
        const overstaffed = ['D', 'E', 'N'].filter(s => currentCounts[s] > targetCounts[s]);

        for (const shift of overstaffed) {
            let surplus = currentCounts[shift] - targetCounts[shift];
            if (surplus <= 0) continue;

            const staffInShift = staffList.filter(s => 
                !this.isLocked(context, s.uid, day) && 
                context.assignments[s.uid][day] === shift
            );

            // 排序：Total OFF 由少到多 (假少的人優先去休假)
            staffInShift.sort((a, b) => context.stats[a.uid].totalOff - context.stats[b.uid].totalOff);

            for (const staff of staffInShift) {
                if (surplus <= 0) break;
                this.assign(context, staff.uid, day, 'OFF');
                surplus--;
            }
        }
    }

    // =========================================================================
    // 🛠️ 輔助函式
    // =========================================================================
    static prepareContext(schedule, staffList, unitSettings, preSchedule, prevMonthData = {}) {
        const assignments = {};
        const stats = {};
        const preferences = {};

        staffList.forEach(staff => {
            const uid = staff.uid;
            assignments[uid] = {};

            let preOffCount = 0;
            const staffWishes = preSchedule?.submissions?.[uid]?.wishes || {};
            Object.values(staffWishes).forEach(w => {
                if (w === 'OFF' || w === 'M_OFF') preOffCount++;
            });

            stats[uid] = {
                D: 0, E: 0, N: 0,
                OFF: 0,
                preOffCount: preOffCount,
                totalOff: preOffCount, // Init with pre-schedule OFFs
            };

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
            prevMonthData: prevMonthData
        };
    }

    static step1_Preparation(context) {}

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

    static assign(context, uid, day, shift) {
        const oldShift = context.assignments[uid][day];
        if (oldShift) {
            if (['D', 'E', 'N'].includes(oldShift)) context.stats[uid][oldShift]--;
            if (oldShift === 'OFF') context.stats[uid].OFF--;
        }
        context.assignments[uid][day] = shift;
        if (['D', 'E', 'N'].includes(shift)) context.stats[uid][shift]++;
        if (shift === 'OFF') context.stats[uid].OFF++;
        
        // 即時更新 Total OFF
        context.stats[uid].totalOff = context.stats[uid].OFF + context.stats[uid].preOffCount;
    }

    static getCurrentCounts(context, day) {
        const counts = { D: 0, E: 0, N: 0 };
        Object.values(context.assignments).forEach(shifts => {
            const s = shifts[day];
            if (counts[s] !== undefined) counts[s]++;
        });
        return counts;
    }

    static calculateConsecutiveDays(context, uid, endDay) {
        let count = 0;
        for (let d = endDay; d >= 1; d--) {
            const s = context.assignments[uid][d];
            if (['D', 'E', 'N'].includes(s)) count++;
            else return count;
        }
        const prevMonthData = context.prevMonthData?.[uid] || {};
        const days = Object.keys(prevMonthData).map(Number).sort((a, b) => b - a);
        for (const d of days) {
            const s = prevMonthData[d];
            if (['D', 'E', 'N'].includes(s)) count++;
            else return count;
        }
        return count;
    }

    static getConsecutiveDaysFromOff(context, uid, targetDay, targetShift) {
        let count = 0;
        for (let d = targetDay; d >= 1; d--) {
            const s = context.assignments[uid][d];
            if (s === targetShift) count++;
            else return count;
        }
        const prevMonthData = context.prevMonthData?.[uid] || {};
        const days = Object.keys(prevMonthData).map(Number).sort((a, b) => b - a);
        for (const d of days) {
            const s = prevMonthData[d];
            if (s === targetShift) count++;
            else return count;
        }
        return count;
    }

    static generateWhitelist(context, staff) {
        let list = ['D', 'E', 'N', 'OFF'];
        const constraints = staff.constraints || {};
        const prefs = context.preferences[staff.uid] || {};

        if (constraints.isPregnant || constraints.isPostpartum) {
            list = list.filter(s => s !== 'N');
        }

        const p1 = prefs.priority1;
        const p2 = prefs.priority2;
        const p3 = prefs.priority3;
        
        let allowedNightShift = null;
        if ([p1, p2, p3].includes('E')) allowedNightShift = 'E';
        else if ([p1, p2, p3].includes('N')) allowedNightShift = 'N';
        
        if (allowedNightShift === 'E') list = list.filter(s => s !== 'N');
        else if (allowedNightShift === 'N') list = list.filter(s => s !== 'E');

        if (p1 || p2) {
            const preferred = ['OFF'];
            if (p1 && list.includes(p1)) preferred.push(p1);
            if (p2 && list.includes(p2) && !preferred.includes(p2)) preferred.push(p2);
            list = preferred;
        }
        return list;
    }

    static filterWhitelistRules(context, staff, day, whitelist) {
        const prevShift = this.getShift(context, staff.uid, day - 1);
        const shiftMap = this.getShiftMap(context.settings);
        const currentConsecutive = this.calculateConsecutiveDays(context, staff.uid, day - 1);
        const maxCons = staff.constraints?.maxConsecutive || context.rules.maxWorkDays || 6;

        if (currentConsecutive >= maxCons) return ['OFF'];

        return whitelist.filter(shift => {
            if (shift === 'OFF') return true;
            if (!RuleEngine.checkShiftInterval(prevShift, shift, shiftMap, 660)) return false;
            return true;
        });
    }

    static getShift(context, uid, day) {
        if (day < 1) {
            const prevMonthData = context.prevMonthData || {};
            if (prevMonthData[uid]) {
                const daysInPrev = new Date(context.year, context.month - 1, 0).getDate();
                const target = daysInPrev + day;
                return prevMonthData[uid][target] || 'OFF';
            }
            return 'OFF';
        }
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
        });
        if (!map['D']) map['D'] = { start: 480, end: 960 };
        if (!map['E']) map['E'] = { start: 960, end: 1440 };
        if (!map['N']) map['N'] = { start: 0, end: 480 };
        return map;
    }
}
