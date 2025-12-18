export class RuleEngine {

    /**
     * 驗證單一員工 (包含月班種限制)
     */
    static validateStaff(assignments, daysInMonth, shiftDefs, rules, staffConstraints = {}, lastMonthLastShift = 'OFF', lastMonthConsecutive = 0, checkUpToDay = null) {
        const errors = {};
        const safeAssignments = assignments || {};
        const limitDay = checkUpToDay || daysInMonth;

        // 安全讀取規則，避免 undefined
        const safeRules = rules || {};
        const maxConsecutive = staffConstraints.calculatedMaxConsecutive || staffConstraints.maxConsecutive || safeRules.maxConsecutiveWork || 6;
        const maxNight = staffConstraints.maxConsecutiveNights || safeRules.constraints?.maxConsecutiveNight || 4;
        const isProtected = !!staffConstraints.isPregnant || !!staffConstraints.isPostpartum;
        const minIntervalMins = (safeRules.constraints?.minInterval11h !== false) ? 660 : 0; 
        
        const monthlyTypeLimit = safeRules.constraints?.monthlyShiftLimit || 2;

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

            if (isWorking) consecutiveDays++; else consecutiveDays = 0;
            if (consecutiveDays > maxConsecutive) {
                errors[d] = `連${consecutiveDays}`;
            }

            if (shift === 'N') consecutiveNights++; else consecutiveNights = 0;
            if (consecutiveNights > maxNight) {
                errors[d] = `連夜${consecutiveNights}`;
            }

            if (isProtected && (shift === 'N' || shift === 'E')) {
                errors[d] = "孕/哺禁夜";
            }

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

            if (shift === 'N') {
                if (prevShift !== 'N' && prevShift !== 'OFF' && prevShift !== 'M_OFF') {
                    errors[d] = "大夜前需OFF"; 
                }
            }
            prevShift = shift;
        }

        if (usedShifts.size > monthlyTypeLimit) {
            errors['monthly'] = `班種>${monthlyTypeLimit}`;
        }

        return { errors };
    }

    /**
     * ✅ 關鍵修復：預判是否會違反月上限
     * 增加空值檢查，防止 assignments 為 undefined 時報錯
     */
    static willViolateMonthlyLimit(currentAssignments, newShift, day, monthlyTypeLimit = 2) {
        if (!currentAssignments) return false; // 安全檢查
        if (newShift === 'OFF' || newShift === 'M_OFF') return false;
        
        const used = new Set();
        used.add(newShift); // 加入新班別

        // 掃描已排的班別 (過濾掉 undefined/null)
        Object.values(currentAssignments).forEach(s => {
            if (s && s !== 'OFF' && s !== 'M_OFF') used.add(s);
        });

        // 若加入新班別後，種類數超過上限，則違反
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
