
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

                        if (RuleEngine.willViolateMonthlyLimit(context.assignments[staff.uid], sh, day, context.rules.monthlyLimit)) {
                            continue;
                        }

                        const valid = RuleEngine.validateStaff(
                            { ...context.assignments[staff.uid], [day]: sh }, 
                            day, context.shiftDefs, 
                            context.rules, 
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
