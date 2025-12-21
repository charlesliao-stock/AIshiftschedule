import { RuleEngine } from "./RuleEngine.js";

const MAX_RUNTIME = 60000;

export class AutoScheduler {

    static async run(currentSchedule, staffList, unitSettings, preScheduleData, strategyCode = 'A') {
        console.log(`🚀 AI 排班啟動 (v4.3 效能優化版): 策略 ${strategyCode}`);
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

                // ✅ 關鍵修正：每處理一天，讓出執行緒 0 毫秒 (避免 UI 卡死)
                await new Promise(resolve => setTimeout(resolve, 0));

                // 1. 基礎排班
                this.cycle1_BasicAssignment(context, day);

                // 2. 智慧填補缺口 (async 呼叫)
                await this.cycle2_SmartFill(context, day);

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
    // 🧠 Cycle 2: 智慧填補缺口 (Smart Fill) - v4.3 優化版
    // =========================================================================
    static async cycle2_SmartFill(context, day) {
        const { staffList, staffReq } = context;
        const dayOfWeek = new Date(context.year, context.month - 1, day).getDay();
        const targetCounts = {
            D: staffReq['D']?.[dayOfWeek] || 0,
            E: staffReq['E']?.[dayOfWeek] || 0,
            N: staffReq['N']?.[dayOfWeek] || 0
        };

        const maxIterations = staffList.length + 10; 
        
        for (let iter = 0; iter < maxIterations; iter++) {
            // ✅ 優化：每執行 5 次運算，暫停一下讓路給瀏覽器
            if (iter % 5 === 0) {
                await new Promise(r => setTimeout(r, 0));
            }

            const currentCounts = this.getCurrentCounts(context, day);
            const gaps = ['D', 'E', 'N'].filter(s => targetCounts[s] > currentCounts[s]);
            const surpluses = ['D', 'E', 'N'].filter(s => currentCounts[s] > targetCounts[s]);

            if (gaps.length === 0) break;

            const candidates = [];
            const offStaff = staffList.filter(s => 
                !this.isLocked(context, s.uid, day) && 
                context.assignments[s.uid][day] === 'OFF'
            );

            // --- 策略 A: 直接填補 ---
            for (const staff of offStaff) {
                let whitelist = this.generateWhitelist(context, staff);
                whitelist = this.filterWhitelistRules(context, staff, day, whitelist);
                for (const targetShift of gaps) {
                    if (whitelist.includes(targetShift)) {
                        candidates.push({
                            type: 'DIRECT',
                            staff: staff,
                            targetShift: targetShift,
                            score: 100 + context.stats[staff.uid].totalOff
                        });
                    }
                }
            }

            // --- 策略 B: 超額調度 ---
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
                                score: 200 + context.stats[staff.uid].totalOff
                            });
                        }
                    }
                }
            }

            // --- 策略 C: 連鎖補位 ---
            for (const targetShift of gaps) {
                const validSourceShifts = ['D', 'E', 'N'].filter(s => 
                    s !== targetShift && 
                    currentCounts[s] >= targetCounts[s] 
                );
                for (const sourceShift of validSourceShifts) {
                    const potentialSwitchers = staffList.filter(s => 
                        !this.isLocked(context, s.uid, day) &&
                        context.assignments[s.uid][day] === sourceShift
                    );
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
                                score: 50 + (context.stats[switcher.uid].totalOff + context.stats[reliever.uid].totalOff) / 2
                            });
                        }
                    }
                }
            }

            // 決策
            if (candidates.length === 0) {
                const panicMove = this.getConsecutivePanicMove(context, day, gaps, surpluses);
                if (panicMove) {
                    this.assign(context, panicMove.staff.uid, day, panicMove.targetShift);
                    continue;
                } else {
                    break; 
                }
            }

            candidates.sort((a, b) => b.score - a.score);
            const bestMove = candidates[0]; 

            if (bestMove.type === 'DIRECT') {
                this.assign(context, bestMove.staff.uid, day, bestMove.targetShift);
            } 
            else if (bestMove.type === 'SWAP_SURPLUS') {
                this.assign(context, bestMove.staff.uid, day, bestMove.targetShift);
            } 
            else if (bestMove.type === 'CHAIN') {
                this.assign(context, bestMove.switcher.uid, day, bestMove.targetShift);
                this.assign(context, bestMove.reliever.uid, day, bestMove.sourceShift);
            }
        }
    }

    // 輔助：當正常招數都無效時，找連上3天的人 (Panic Mode)
    static getConsecutivePanicMove(context, day, gaps, surpluses) {
        if (surpluses.length === 0) return null;
        const { staffList } = context;
        for (const sourceShift of surpluses) {
            const candidates = staffList.filter(s => {
                if (this.isLocked(context, s.uid, day)) return false;
                if (context.assignments[s.uid][day] !== sourceShift) return false;
                const cons = this.getConsecutiveDaysFromOff(context, s.uid, day, sourceShift);
                return cons >= 3;
            });
            if (candidates.length > 0) {
                const staff = candidates[Math.floor(Math.random() * candidates.length)];
                let whitelist = this.generateWhitelist(context, staff);
                whitelist = this.filterWhitelistRules(context, staff, day, whitelist);
                const validGaps = gaps.filter(g => whitelist.includes(g));
                if (validGaps.length > 0) {
                    return { staff: staff, targetShift: validGaps[0] };
                }
            }
        }
        return null;
    }

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
                totalOff: preOffCount, 
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
