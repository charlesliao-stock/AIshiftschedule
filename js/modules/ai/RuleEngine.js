export class RuleEngine {

    /**
     * 驗證單一員工
     * @param {Array} shiftDefs 班別定義 (需包含 startTime, endTime)
     */
    static validateStaff(assignments, daysInMonth, shiftDefs, rules, staffConstraints = {}, lastMonthLastShift = 'OFF', lastMonthConsecutive = 0, checkUpToDay = null, year = null, month = null) {
        const errors = {};
        const safeAssignments = assignments || {};
        const limitDay = checkUpToDay || daysInMonth;

        const maxConsecutive = staffConstraints.maxConsecutive || rules.maxConsecutiveWork || 6;
        const isProtected = !!staffConstraints.isPregnant || !!staffConstraints.isPostpartum;
        const minIntervalMins = (rules.constraints?.minInterval11h !== false) ? 660 : 0; // 11hr = 660mins

        let consecutiveDays = lastMonthConsecutive;
        let prevShift = lastMonthLastShift;

        // 建立班別時間查詢表 (加速運算)
        const shiftMap = {};
        if (shiftDefs) {
            shiftDefs.forEach(s => {
                shiftMap[s.code] = {
                    start: this._timeToMins(s.startTime),
                    end: this._timeToMins(s.endTime)
                };
                // 跨日處理 (例如 16:00 - 00:00，end=0 -> 1440)
                if (shiftMap[s.code].end === 0) shiftMap[s.code].end = 1440;
                if (shiftMap[s.code].end < shiftMap[s.code].start) shiftMap[s.code].end += 1440; // 跨日
            });
        }

        for (let d = 1; d <= limitDay; d++) {
            const shift = safeAssignments[d] || 'OFF';
            const isWorking = shift !== 'OFF' && shift !== 'M_OFF';
            const prevIsWorking = prevShift !== 'OFF' && prevShift !== 'M_OFF';

            // 1. 連續上班天數
            if (isWorking) consecutiveDays++; else consecutiveDays = 0;
            if (consecutiveDays > maxConsecutive) {
                errors[d] = `連${consecutiveDays} (上限${maxConsecutive})`;
            }

            // 2. 母性保護
            if (isProtected && (shift === 'N' || shift === 'E')) {
                errors[d] = "懷孕/哺乳不可夜班";
            }

            // 3. 休息間隔檢查 (取代逆向排班硬規則)
            if (minIntervalMins > 0 && prevIsWorking && isWorking) {
                const t1 = shiftMap[prevShift];
                const t2 = shiftMap[shift];
                
                if (t1 && t2) {
                    // 間隔 = (24hr - 前班結束) + 後班開始
                    // 假設前一天是 D-1，今天是 D
                    // 這裡的邏輯簡化為「日切點」計算，若班別定義精確，此公式通用
                    // E(16-24) -> D(08-16): (1440 - 1440) + 480 = 480 < 660 (Fail)
                    // N(00-08) -> E(16-24): (1440 - 480) + 960 = 1920 > 660 (Pass)
                    let interval = (1440 - t1.end) + t2.start;
                    
                    if (interval < minIntervalMins) {
                        errors[d] = `間隔不足 (${Math.floor(interval/60)}h)`;
                    }
                }
            }

            // 4. 大夜銜接規則 (依舊保留，因涉及生理時鐘調整)
            if (shift === 'N') {
                if (prevShift !== 'N' && prevShift !== 'OFF' && prevShift !== 'M_OFF') {
                    errors[d] = "大夜前需OFF"; // 或連N
                }
            }

            prevShift = shift;
        }

        return { errors };
    }

    static validateAll(scheduleData, daysInMonth, staffList, unitSettings, rules) {
        const staffReport = {};
        const shiftDefs = unitSettings?.settings?.shifts || [];
        staffList.forEach(staff => {
            const result = this.validateStaff(
                scheduleData.assignments[staff.uid], 
                daysInMonth, shiftDefs, rules, staff.constraints,
                'OFF', 0, null, 
                scheduleData.year, scheduleData.month
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
