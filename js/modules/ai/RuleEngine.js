export class RuleEngine {

    /**
     * 驗證單一員工在特定日期的排班是否合法
     */
    static validateStaff(assignments, day, shiftDefs, rules, staffConstraints = {}, lastMonthLastShift = 'OFF', lastMonthConsecutive = 0) {
        const errors = {};
        
        // 1. 取得該日班別
        const currentShift = assignments[day] || 'OFF';
        const isWorking = currentShift !== 'OFF' && currentShift !== 'M_OFF';

        // 若當天休假，則不需要檢查，直接 Pass
        if (!isWorking) return { errors };

        // 參數設定
        const maxConsecutive = staffConstraints.calculatedMaxConsecutive || rules.maxConsecutiveWork || 6;
        const minIntervalMins = (rules.constraints?.minInterval11h !== false) ? 660 : 0;

        // --- 檢查 1: 連續上班天數 (Consecutive Days) ---
        let consecutive = 0;
        // 往回追溯
        for (let d = day; d >= 1; d--) {
            const s = assignments[d];
            if (s && s !== 'OFF' && s !== 'M_OFF') consecutive++;
            else break;
        }
        // 若追溯到 1 號仍是上班，加上上月累積
        if (consecutive === day) {
            consecutive += lastMonthConsecutive;
        }

        if (consecutive > maxConsecutive) {
            errors[day] = `連${consecutive} (上限${maxConsecutive})`;
            return { errors }; // 違反硬性上限，直接回傳
        }

        // --- 檢查 2: 間隔 11 小時 (Interval Check) ---
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
                    // 處理跨午夜 (例如大夜 00:00 結束，或夜班跨天)
                    if (shiftMap[s.code].end === 0) shiftMap[s.code].end = 1440; // 24:00
                    if (shiftMap[s.code].end < shiftMap[s.code].start) shiftMap[s.code].end += 1440; 
                });
            }

            const t1 = shiftMap[prevShift];
            const t2 = shiftMap[currentShift];
            
            if (t1 && t2) {
                // 間隔計算公式：(24小時 - 前班結束時間) + 後班開始時間
                // 例如：前班(N) 08:00 結束，後班(D) 08:00 開始
                // 間隔 = (1440 - 480) + 480 = 1440 分鐘 (24小時) -> 合法
                let interval = (1440 - t1.end) + t2.start;
                
                if (interval < minIntervalMins) {
                    errors[day] = `間隔不足 (${Math.floor(interval/60)}h)`;
                }
            }
        }

        // ❌ 已移除錯誤的「大夜後不可接白/小」檢查
        // 因為 N(Day1 08:00 end) -> D(Day2 08:00 start) 間隔 24h，符合規定

        return { errors };
    }

    static _timeToMins(timeStr) {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }
}
