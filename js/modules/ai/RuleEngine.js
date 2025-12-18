export class RuleEngine {

    /**
     * 驗證單一員工
     */
    static validateStaff(assignments, daysInMonth, shiftDefs, rules, staffConstraints = {}, lastMonthLastShift = 'OFF', lastMonthConsecutive = 0, checkUpToDay = null) {
        const errors = {};
        const safeAssignments = assignments || {};
        const limitDay = checkUpToDay || daysInMonth;

        const maxConsecutive = staffConstraints.calculatedMaxConsecutive || staffConstraints.maxConsecutive || rules.maxConsecutiveWork || 6;
        const maxNight = staffConstraints.maxConsecutiveNights || rules.constraints?.maxConsecutiveNight || 4;
        const isProtected = !!staffConstraints.isPregnant || !!staffConstraints.isPostpartum;
        const minIntervalMins = (rules.constraints?.minInterval11h !== false) ? 660 : 0; 
        
        // 這裡會讀取傳入的 rules，若 AutoScheduler 傳對了，這裡就會是動態的
        const monthlyTypeLimit = rules.constraints?.monthlyShiftLimit || 2;

        const shiftMap = {};
        if (shiftDefs) {
            shiftDefs.forEach(s => {
                shiftMap[s.code] = {
                    start: this._timeToMins(s.startTime),
                    end: this._timeToMins(s.endTime)
                };
                if (shiftMap[s.code].end === 0) shiftMap[s.code].end = 1440;
                if (shiftMap[s.code].end < shiftMap[s.code].start) shiftMap[s.code].end += 1440; 
            });
        }

        let consecutiveDays = lastMonthConsecutive;
        let consecutiveNights = (lastMonthLastShift === 'N') ? 1 : 0; 
        let prevShift = lastMonthLastShift;
        
        const usedShifts = new Set(); 

        for (let d = 1; d <= limitDay; d++) {
            const shift = safeAssignments[d] || 'OFF';
            const isWorking = shift !== 'OFF' && shift !== 'M_OFF';
            const prevIsWorking = prevShift !== 'OFF' && prevShift !== 'M_OFF';

            if (isWorking) usedShifts.add(shift);

            // A. 連續上班
            if (isWorking) consecutiveDays++; else consecutiveDays = 0;
            if (consecutiveDays > maxConsecutive) {
                errors[d] = `連${consecutiveDays}`;
            }

            // B. 連續夜班
            if (shift === 'N') consecutiveNights++; else consecutiveNights = 0;
            if (consecutiveNights > maxNight) {
                errors[d] = `連夜${consecutiveNights}`;
            }

            // C. 母性保護
            if (isProtected && (shift === 'N' || shift === 'E')) {
                errors[d] = "孕/哺禁夜";
            }

            // D. 11小時
            if (minIntervalMins > 0 && prevIsWorking && isWorking) {
                const t1 = shiftMap[prevShift];
                const t2 = shiftMap[shift];
                if (t1 && t2) {
                    let interval = (1440 - t1.end) + t2.start;
                    if (interval < minIntervalMins) {
                        errors[d] = `間隔不足`;
                    }
                }
            }

            // E. 防逆向
            if (shift === 'N') {
                if (prevShift !== 'N' && prevShift !== 'OFF' && prevShift !== 'M_OFF') {
                    errors[d] = "大夜前需OFF"; 
                }
            }

            prevShift = shift;
        }

        // F. 月班種檢查
        if (usedShifts.size > monthlyTypeLimit) {
            errors['monthly'] = `班種>${monthlyTypeLimit}`;
        }

        return { errors };
    }

    /**
     * 預判是否會違反月上限
     */
    static willViolateMonthlyLimit(currentAssignments, newShift, day, monthlyTypeLimit) {
        if (newShift === 'OFF' || newShift === 'M_OFF') return false;
        
        const used = new Set();
        used.add(newShift);

        Object.values(currentAssignments).forEach(s => {
            if (s && s !== 'OFF' && s !== 'M_OFF') used.add(s);
        });

        return used.size > monthlyTypeLimit;
    }

    static validateAll(scheduleData, daysInMonth, staffList, unitSettings, rules) {
        const staffReport = {};
        const shiftDefs = unitSettings?.settings?.shifts || [];
        staffList.forEach(staff => {
            const result = this.validateStaff(
                scheduleData.assignments[staff.uid], 
                daysInMonth, shiftDefs, rules, staff.constraints,
                'OFF', 0, null
            );
            if (Object.keys(result.errors).length > 0) staffReport[staff.uid] = result;
        });
        return { staffReport, coverageErrors: {} };
    }

    static _timeToMins(timeStr) {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }
}
