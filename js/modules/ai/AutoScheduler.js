// ✅ 修正引用路徑：同層級引用
import { RuleEngine } from "./RuleEngine.js";
import { BalanceStrategy, PreferenceStrategy, PatternStrategy } from "./AIStrategies.js";

const MAX_RUNTIME = 60000;

export class AutoScheduler {

    static async run(currentSchedule, staffList, unitSettings, preScheduleData, strategyCode = 'A') {
        console.log(`🚀 AI 排班啟動: 策略 ${strategyCode} (Monthly Limit Check)`);
        const startTime = Date.now();

        try {
            let StrategyEngine = BalanceStrategy;
            if (strategyCode === 'B') StrategyEngine = PreferenceStrategy;
            if (strategyCode === 'C') StrategyEngine = PatternStrategy;

            const context = this.prepareContext(currentSchedule, staffList, unitSettings, preScheduleData, strategyCode);
            context.StrategyEngine = StrategyEngine;

            this.calculateLeaveQuotas(context);
            this.prefillFixedShifts(context);

            for (let day = 1; day <= context.daysInMonth; day++) {
                if (Date.now() - startTime > MAX_RUNTIME) break;
                if (day > 1) this.retroactiveBalance(day - 1, context);
                await this.solveDay(day, context);
            }

            if (context.daysInMonth > 0) this.retroactiveBalance(context.daysInMonth, context);

            const duration = (Date.now() - startTime) / 1000;
            context.logs.push(`策略 ${strategyCode} 完成 (${duration}s)`);
            return { assignments: context.assignments, logs: context.logs };

        } catch (e) {
            console.error(e);
            return { assignments: {}, logs: [`Error: ${e.message}`] };
        }
    }

    static prepareContext(currentSchedule, staffList, unitSettings, preScheduleData, strategyCode) {
        const assignments = {};
        const preferences = {};
        const whitelists = {};
        const stats = {}; 
        const lastMonthConsecutive = {}; 
        const historyAssignments = preScheduleData.assignments || {};
        const preScheduledOffs = {}; 

        const rules = unitSettings.settings?.rules || {};
        const globalMax = rules.maxConsecutiveWork || 6;
        const allowLongLeave = rules.constraints?.allowLongLeaveException || false;
        const rebalanceLoop = rules.rebalanceLoop || 3;
        
        // ✅ 讀取月班種上限 (預設 2)
        const monthlyLimit = rules.constraints?.monthlyShiftLimit || 2;
        
        const staffReq = unitSettings.staffRequirements || { D:[], E:[], N:[] };

        staffList.forEach(s => {
            const uid = s.uid || s.id;
            assignments[uid] = {};
            stats[uid] = { D:0, E:0, N:0, OFF:0 };
            preScheduledOffs[uid] = {}; 

            // 歷史回溯
            const userHistory = historyAssignments[uid] || {};
            const days = Object.keys(userHistory).map(Number).sort((a, b) => b - a);
            let lastDayShift = 'OFF';
            let cons = 0;
            if (days.length > 0) {
                const lastDayKey = days[0];
                lastDayShift = userHistory[lastDayKey] || 'OFF';
                for (let d of days) {
                    const shift = userHistory[d];
                    if (shift && shift !== 'OFF' && shift !== 'M_OFF') cons++; else break;
                }
            }
            lastMonthConsecutive[uid] = cons;
            assignments[uid][0] = lastDayShift;

            let myMaxConsecutive = globalMax;
            if (allowLongLeave && s.isLongLeave) myMaxConsecutive = 7;
            if (!s.constraints) s.constraints = {};
            s.constraints.calculatedMaxConsecutive = myMaxConsecutive;

            // 白名單邏輯
            const canFixed = s.constraints?.allowFixedShift; 
            const staticFixed = canFixed ? s.constraints.fixedShiftConfig : null;
            const sub = preScheduleData.submissions?.[uid] || {};
            const pref = sub.preferences || {};
            const monthlyBatch = pref.batch; 

            let allowed = []; 
            if (s.constraints?.isPregnant || s.constraints?.isSpecialStatus) {
                allowed = ['D', 'OFF'];
            } else if (monthlyBatch === 'N') {
                allowed = ['N', 'OFF']; 
            } else if (monthlyBatch === 'E') {
                allowed = ['E', 'OFF'];
            } else if (!monthlyBatch && staticFixed === 'N') {
                allowed = ['N', 'OFF'];
            } else if (!monthlyBatch && staticFixed === 'E') {
                allowed = ['E', 'OFF'];
            } else {
                allowed = ['D', 'E', 'N', 'OFF'];
            }
            whitelists[uid] = allowed;
            
            if (sub.wishes) {
                Object.entries(sub.wishes).forEach(([d, w]) => {
                    const shiftCode = (w === 'M_OFF' ? 'OFF' : w);
                    assignments[uid][d] = shiftCode;
                    if (shiftCode === 'OFF') preScheduledOffs[uid][d] = true;
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
            daysInMonth: new Date(currentSchedule.year, currentSchedule.month, 0).getDate(),
            staffList: staffList.map(s => ({ ...s, uid: s.uid || s.id })),
            assignments,
            preferences,
            whitelists,
            stats,
            preScheduledOffs,
            lastMonthConsecutive,
            shiftDefs: unitSettings.settings?.shifts || [],
            staffReq,
            rules: { ...rules, rebalanceLoop, monthlyLimit }, // 傳入 monthlyLimit
            logs: [],
            startTime: Date.now()
        };
    }

    static calculateLeaveQuotas(context) {
        let totalReq = 0;
        for (let d = 1; d <= context.daysInMonth; d++) {
            const w = new Date(context.year, context.month - 1, d).getDay();
            totalReq += (context.staffReq.D[w]||0) + (context.staffReq.E[w]||0) + (context.staffReq.N[w]||0);
        }
        const totalCapacity = context.staffList.length * context.daysInMonth;
        const avgOff = Math.floor((totalCapacity - totalReq) / context.staffList.length);
        context.targetAvgOff = avgOff;
    }

    static prefillFixedShifts(context) {
        Object.entries(context.whitelists).forEach(([uid, allowed]) => {
            const workingShift = allowed.find(s => s !== 'OFF');
            if (allowed.length === 2 && workingShift) {
                for (let d = 1; d <= context.daysInMonth; d++) {
                    if (!context.assignments[uid][d]) {
                        context.assignments[uid][d] = workingShift;
                        context.stats[uid][workingShift] = (context.stats[uid][workingShift]||0) + 1;
                    }
                }
            }
        });
    }

    static async solveDay(day, context) {
        if (Date.now() - context.startTime > MAX_RUNTIME) return false;
        const pending = context.staffList.filter(s => !context.assignments[s.uid][day]);
        this.shuffleArray(pending); 
        await this.solveRecursive(day, pending, 0, context);
        return true;
    }

    static async solveRecursive(day, list, idx, context) {
        if (idx >= list.length) return true;
        const staff = list[idx];
        const uid = staff.uid;
        const w = new Date(context.year, context.month - 1, day).getDay();
        const currentCounts = {};
        context.staffList.forEach(s => {
            const sh = context.assignments[s.uid][day];
            if (sh && sh !== 'OFF') currentCounts[sh] = (currentCounts[sh]||0) + 1;
        });

        let candidates = context.whitelists[uid].map(shift => ({
            shift,
            score: context.StrategyEngine.calculateScore(uid, shift, day, context, currentCounts, w)
        })).sort((a, b) => b.score - a.score);

        for (const item of candidates) {
            const shift = item.shift;
            
            // ✅ 關鍵修正：檢查月班種上限 (若超過則跳過此班別)
            if (RuleEngine.willViolateMonthlyLimit(context.assignments[uid], shift, day, context.rules.monthlyLimit)) {
                continue;
            }

            context.assignments[uid][day] = shift;
            context.stats[uid][shift] = (context.stats[uid][shift]||0) + 1;

            const valid = RuleEngine.validateStaff(
                context.assignments[uid], day, context.shiftDefs, 
                { constraints: { minInterval11h: true } }, 
                staff.constraints, context.assignments[uid][0], context.lastMonthConsecutive[uid], day
            );

            if (!valid.errors[day]) {
                if (await this.solveRecursive(day, list, idx + 1, context)) return true;
            }

            context.stats[uid][shift]--;
            delete context.assignments[uid][day];
        }
        
        context.assignments[uid][day] = 'OFF';
        return true;
    }

    static retroactiveBalance(day, context) {
        const w = new Date(context.year, context.month - 1, day).getDay();
        const shifts = ['D', 'E', 'N'];
        const maxLoops = context.rules.rebalanceLoop || 3; 

        for (let loop = 0; loop < maxLoops; loop++) {
            let changed = false;
            const counts = { D:0, E:0, N:0 };
            const staffByShift = { D:[], E:[], N:[], OFF:[] };
            
            context.staffList.forEach(s => {
                const sh = context.assignments[s.uid][day];
                if (sh && sh !== 'OFF') {
                    counts[sh]++;
                    staffByShift[sh].push(s);
                } else {
                    staffByShift.OFF.push(s);
                }
            });

            let allSatisfied = true;
            shifts.forEach(sh => {
                const req = context.staffReq[sh]?.[w] || 0;
                if (counts[sh] < req) allSatisfied = false; 
                if (counts[sh] > req) allSatisfied = false; 
            });
            if (allSatisfied) break;

            // Trim Excess
            shifts.forEach(sh => {
                const req = context.staffReq[sh]?.[w] || 0;
                if (counts[sh] > req) {
                    const excess = counts[sh] - req;
                    const candidates = staffByShift[sh].sort((a, b) => {
                        const defA = context.targetAvgOff - context.stats[a.uid].OFF;
                        const defB = context.targetAvgOff - context.stats[b.uid].OFF;
                        return defB - defA; 
                    });

                    let trimmed = 0;
                    for (const staff of candidates) {
                        if (trimmed >= excess) break;
                        const subWishes = preScheduleData.submissions?.[staff.uid]?.wishes || {};
                        if (subWishes[day] === sh) continue; 

                        const allowed = context.whitelists[staff.uid];
                        if (allowed.length === 2 && allowed.includes(sh)) continue;

                        context.assignments[staff.uid][day] = 'OFF';
                        context.stats[staff.uid][sh]--;
                        context.stats[staff.uid].OFF++;
                        
                        staffByShift.OFF.push(staff);
                        trimmed++;
                        changed = true;
                    }
                }
            });

            // Fill Shortage
            shifts.forEach(sh => {
                const req = context.staffReq[sh]?.[w] || 0;
                let current = 0;
                context.staffList.forEach(s => { if(context.assignments[s.uid][day] === sh) current++; });

                if (current < req) {
                    const shortage = req - current;
                    const candidates = staffByShift.OFF.sort((a, b) => {
                        const defA = context.targetAvgOff - context.stats[a.uid].OFF;
                        const defB = context.targetAvgOff - context.stats[b.uid].OFF;
                        return defA - defB; 
                    });

                    let filled = 0;
                    for (const staff of candidates) {
                        if (filled >= shortage) break;
                        if (context.preScheduledOffs[staff.uid]?.[day]) continue; 
                        if (!context.whitelists[staff.uid].includes(sh)) continue; 

                        // ✅ 關鍵修正：補人時也要檢查月班種上限
                        if (RuleEngine.willViolateMonthlyLimit(context.assignments[staff.uid], sh, day, context.rules.monthlyLimit)) {
                            continue;
                        }

                        const valid = RuleEngine.validateStaff(
                            { ...context.assignments[staff.uid], [day]: sh }, 
                            day, context.shiftDefs, 
                            { constraints: { minInterval11h: true } }, 
                            staff.constraints, context.assignments[staff.uid][0], context.lastMonthConsecutive[staff.uid], day
                        );
                        if (valid.errors[day]) continue;

                        context.assignments[staff.uid][day] = sh;
                        context.stats[staff.uid].OFF--;
                        context.stats[staff.uid][sh]++;
                        filled++;
                        changed = true;
                    }
                }
            });

            if (!changed) break;
        }
    }

    static shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }
}
