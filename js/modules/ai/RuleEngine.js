export class RuleEngine {

    /**
     * 驗證單一員工 (包含月班種限制)
     */
    static validateStaff(assignments, daysInMonth, shiftDefs, rules, staffConstraints = {}, lastMonthLastShift = 'OFF', lastMonthConsecutive = 0, checkUpToDay = null) {
        const errors = {};
        const safeAssignments = assignments || {};
        const limitDay = checkUpToDay || daysInMonth;

        // 安全讀取規則
        const safeRules = rules || {};
        const maxConsecutive = staffConstraints.calculatedMaxConsecutive || staffConstraints.maxConsecutive || safeRules.maxConsecutiveWork || 6;
        const maxNight = staffConstraints.maxConsecutiveNights || safeRules.constraints?.maxConsecutiveNight || 4;
        const isProtected = !!staffConstraints.isPregnant || !!staffConstraints.isPostpartum;
        
        // 11小時檢查：若規則未關閉，則預設檢查 (660分鐘)
        const minIntervalMins = (safeRules.minInterval11 !== false) ? 660 : 0; 
        
        // 大夜前規則：若規則開啟，N 的前一天必須是 OFF 或 N
        const strictPreNight = !!safeRules.preNightOff;

        const monthlyTypeLimit = safeRules.maxShiftTypes || 2;

        // 建構班別時間 Map
        const shiftMap = {};
        if (shiftDefs) {
            shiftDefs.forEach(s => {
                shiftMap[s.code] = {
                    start: this._timeToMins(s.startTime),
                    end: this._timeToMins(s.endTime)
                };
                // 跨日處理 (例如 N 班 24:00 結束或 08:00 結束)
                if (shiftMap[s.code].end <= shiftMap[s.code].start) {
                    shiftMap[s.code].end += 1440; // 加 24 小時
                }
            });
        } else {
            // 預設 fallback
            shiftMap['D'] = { start: 480, end: 960 };   // 08:00 - 16:00
            shiftMap['E'] = { start: 960, end: 1440 };  // 16:00 - 24:00
            shiftMap['N'] = { start: 0, end: 480 };     // 00:00 - 08:00 
        }

        let consecutive = lastMonthConsecutive;
        let consecutiveNight = 0; 
        
        // 為了檢查間隔，我們需要追蹤 "前一天的班別"
        let prevShift = lastMonthLastShift;

        // 掃描每一天
        for (let d = 1; d <= limitDay; d++) {
            const shift = safeAssignments[d];
            
            // 若該日未排班，暫時跳過檢查 (視為還沒排到)
            if (!shift) continue;

            // --- 1. 連續上班檢查 ---
            if (shift === 'OFF' || shift === 'M_OFF') {
                consecutive = 0;
                consecutiveNight = 0;
            } else {
                consecutive++;
                if (shift === 'N') consecutiveNight++;
                else consecutiveNight = 0;
            }

            if (consecutive > maxConsecutive) {
                errors[d] = `連${consecutive}`;
            }
            if (consecutiveNight > maxNight) {
                errors[d] = `連N${consecutiveNight}`;
            }

            // --- 2. 特殊身分保護 (懷孕/哺乳) ---
            if (isProtected) {
                // 禁止夜班 (N) 
                if (shift === 'N') errors[d] = '孕哺禁N';
                // 若 E 班結束時間 > 22:00 (1320 mins)，也應禁止 (視勞基法而定，此處暫時只禁N)
            }

            // --- 3. 班別間隔檢查 (11小時 = 660分鐘) ---
            if (minIntervalMins > 0 && d > 1) { 
                if (shift !== 'OFF' && shift !== 'M_OFF' && prevShift !== 'OFF' && prevShift !== 'M_OFF') {
                    // ✅ 呼叫 checkShiftInterval (此次報錯就是缺這個)
                    const isValid = this.checkShiftInterval(prevShift, shift, shiftMap, minIntervalMins);
                    if (!isValid) {
                        errors[d] = `間隔<11h (${prevShift}->${shift})`;
                    }
                }
            }
            
            // --- 4. 大夜班前置規則 (Pre-Night Rule) ---
            // 規則：N 的前一天必須是 N 或 OFF (即禁止 D->N, E->N)
            if (strictPreNight && shift === 'N') {
                const isPrevSafe = (prevShift === 'N' || prevShift === 'OFF' || prevShift === 'M_OFF');
                if (!isPrevSafe) {
                    errors[d] = `限N/OFF接N (前:${prevShift})`;
                }
            }

            prevShift = shift;
        }

        // --- 5. 月班種數量檢查 ---
        const usedTypes = new Set();
        Object.values(safeAssignments).forEach(s => {
            if (s && s !== 'OFF' && s !== 'M_OFF') usedTypes.add(s);
        });
        if (usedTypes.size > monthlyTypeLimit) {
            errors['monthly'] = `班種>${monthlyTypeLimit}`;
        }

        return { errors };
    }

    /**
     * ✅ 關鍵修復：檢查兩個班別中間是否休息足夠分鐘數
     * 邏輯：(前一天班別結束時間) 到 (今天班別開始時間 + 24小時) 的差距
     */
    static checkShiftInterval(prevShift, currShift, shiftMap, minMinutes) {
        if (!shiftMap[prevShift] || !shiftMap[currShift]) return true; // 無定義則略過

        const prevEnd = shiftMap[prevShift].end; // 例如 E 班 24:00 (1440)
        const currStart = shiftMap[currShift].start; // 例如 D 班 08:00 (480)

        // 計算間隔：(今天開始時間 + 1440) - 昨天結束時間
        const interval = (currStart + 1440) - prevEnd;
        return interval >= minMinutes;
    }

    // 輔助：時間字串轉分鐘 (08:00 -> 480)
    static _timeToMins(timeStr) {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return h * 60 + m;
    }

    /**
     * 預判是否會違反月上限 (AutoScheduler 用)
     */
    static willViolateMonthlyLimit(currentAssignments, newShift, day, monthlyTypeLimit = 2) {
        if (!currentAssignments) return false;
        if (newShift === 'OFF' || newShift === 'M_OFF') return false;
        
        const used = new Set();
        used.add(newShift); 
        Object.values(currentAssignments).forEach(s => {
            if (s && s !== 'OFF' && s !== 'M_OFF') used.add(s);
        });

        return used.size > monthlyTypeLimit;
    }

    /**
     * 驗證所有人 (SchedulePage 用)
     */
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
        return { staffReport };
    }
}
