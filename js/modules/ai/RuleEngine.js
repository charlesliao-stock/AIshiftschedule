export class RuleEngine {

    /**
     * 驗證單一員工 (包含月班種限制)
     */
    static validateStaff(assignments, daysInMonth, shiftDefs, rules, staffConstraints = {}, lastMonthLastShift = 'OFF', lastMonthConsecutive = 0, checkUpToDay = null) {
        const errors = {};
        const safeAssignments = assignments || {};
        const limitDay = checkUpToDay || daysInMonth;

        // 1. 讀取規則
        const maxConsecutive = staffConstraints.calculatedMaxConsecutive || staffConstraints.maxConsecutive || rules.maxConsecutiveWork || 6;
        const maxNight = staffConstraints.maxConsecutiveNights || rules.constraints?.maxConsecutiveNight || 4;
        const isProtected = !!staffConstraints.isPregnant || !!staffConstraints.isPostpartum;
        const minIntervalMins = (rules.constraints?.minInterval11h !== false) ? 660 : 0; 
        
        // ✅ 新增：月班種上限 (預設 2 種)
        const monthlyTypeLimit = rules.constraints?.monthlyShiftLimit || 2;

        // 建立時間查詢表
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

        // 變數初始化
        let consecutiveDays = lastMonthConsecutive;
        let consecutiveNights = (lastMonthLastShift === 'N') ? 1 : 0; 
        let prevShift = lastMonthLastShift;
        
        // 用於統計本月已出現的班別 (D, E, N)
        const usedShifts = new Set(); 

        for (let d = 1; d <= limitDay; d++) {
            const shift = safeAssignments[d] || 'OFF';
            const isWorking = shift !== 'OFF' && shift !== 'M_OFF';
            const prevIsWorking = prevShift !== 'OFF' && prevShift !== 'M_OFF';

            // 收集班別種類 (排除 OFF)
            if (isWorking) usedShifts.add(shift);

            // A. 連續上班天數檢查
            if (isWorking) consecutiveDays++; else consecutiveDays = 0;
            if (consecutiveDays > maxConsecutive) {
                errors[d] = `連${consecutiveDays} (上限${maxConsecutive})`;
            }

            // B. 連續夜班檢查
            if (shift === 'N') consecutiveNights++; else consecutiveNights = 0;
            if (consecutiveNights > maxNight) {
                errors[d] = `連夜${consecutiveNights} (上限${maxNight})`;
            }

            // C. 母性保護
            if (isProtected && (shift === 'N' || shift === 'E')) {
                errors[d] = "懷孕/哺乳不可夜班";
            }

            // D. 休息間隔 11 小時
            if (minIntervalMins > 0 && prevIsWorking && isWorking) {
                const t1 = shiftMap[prevShift];
                const t2 = shiftMap[shift];
                if (t1 && t2) {
                    let interval = (1440 - t1.end) + t2.start;
                    if (interval < minIntervalMins) {
                        errors[d] = `間隔不足 (${Math.floor(interval/60)}h)`;
                    }
                }
            }

            // E. 大夜銜接 (防逆向)
            if (shift === 'N') {
                if (prevShift !== 'N' && prevShift !== 'OFF' && prevShift !== 'M_OFF') {
                    errors[d] = "大夜前需OFF"; 
                }
            }

            prevShift = shift;
        }

        // ✅ F. 檢查月班種數量
        // 如果這個人這個月排了 D, E, N (3種)，但上限是 2 -> 報錯
        // 注意：這通常在「嘗試填入」時就要擋掉，這裡是事後驗證
        if (usedShifts.size > monthlyTypeLimit) {
            // 標記在最後一天 (或每一天)
            errors['monthly'] = `班種${usedShifts.size}種 (上限${monthlyTypeLimit})`;
        }

        return { errors };
    }

    /**
     * ✅ 輔助方法：檢查單日填入某班別後，是否會違反月上限
     * (供 AutoScheduler 在填入前預判)
     */
    static willViolateMonthlyLimit(currentAssignments, newShift, day, monthlyTypeLimit) {
        if (newShift === 'OFF' || newShift === 'M_OFF') return false;
        
        const used = new Set();
        used.add(newShift); // 加入新班別

        // 掃描已排的班別
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
