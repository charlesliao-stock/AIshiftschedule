export class RuleEngine {

    static validateStaff(assignments, day, shiftDefs, rules, staffConstraints = {}, lastMonthLastShift = 'OFF', lastMonthConsecutive = 0) {
        const errors = {};
        
        const currentShift = assignments[day] || 'OFF';
        const isWorking = currentShift !== 'OFF' && currentShift !== 'M_OFF';

        if (!isWorking) return { errors };

        const maxConsecutive = staffConstraints.calculatedMaxConsecutive || rules.maxConsecutiveWork || 6;
        const minIntervalMins = (rules.constraints?.minInterval11h !== false) ? 660 : 0;

        // 1. 連續上班檢查
        let consecutive = 0;
        for (let d = day; d >= 1; d--) {
            const s = assignments[d];
            if (s && s !== 'OFF' && s !== 'M_OFF') consecutive++;
            else break;
        }
        if (consecutive === day) {
            consecutive += lastMonthConsecutive;
        }

        // 當天若上班導致超過上限，則報錯
        // 例如 max=6，consecutive=7 -> Error
        if (consecutive > maxConsecutive) {
            errors[day] = `連${consecutive} (上限${maxConsecutive})`;
            return { errors };
        }

        // 2. 間隔 11 小時檢查
        let prevShift = 'OFF';
        if (day === 1) prevShift = lastMonthLastShift;
        else prevShift = assignments[day - 1] || 'OFF';

        const prevIsWorking = prevShift !== 'OFF' && prevShift !== 'M_OFF';

        if (minIntervalMins > 0 && prevIsWorking) {
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

            const t1 = shiftMap[prevShift];
            const t2 = shiftMap[currentShift];
            
            if (t1 && t2) {
                let interval = (1440 - t1.end) + t2.start;
                if (interval < minIntervalMins) {
                    errors[day] = `間隔不足 (${Math.floor(interval/60)}h)`;
                }
            }
        }

        // 3. 檢查大夜後是否接白/小
        if (prevShift === 'N' && (currentShift === 'D' || currentShift === 'E')) {
             errors[day] = "大夜後不可接白/小";
        }

        return { errors };
    }

    static _timeToMins(timeStr) {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }
}
