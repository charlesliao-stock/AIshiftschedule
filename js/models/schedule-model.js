/**
 * 排班資料模型
 */

class Schedule {
    constructor(data = {}) {
        this.year = data.year || new Date().getFullYear();
        this.month = data.month || new Date().getMonth() + 1;
        this.unitId = data.unitId || '';
        this.scheduleData = data.scheduleData || {}; // { staffId: { date: shiftCode } }
        this.status = data.status || 'draft'; // draft, published
        this.publishedAt = data.publishedAt || null;
        this.publishedBy = data.publishedBy || null;
    }
    
    /**
     * 取得月份字串 YYYYMM
     */
    getMonthString() {
        return `${this.year}${String(this.month).padStart(2, '0')}`;
    }
    
    /**
     * 取得指定員工的排班
     * @param {string} staffId - 員工 ID
     * @returns {Object} { date: shiftCode }
     */
    getStaffSchedule(staffId) {
        return this.scheduleData[staffId] || {};
    }
    
    /**
     * 設定指定員工的班別
     * @param {string} staffId - 員工 ID
     * @param {string} date - 日期 (YYYY-MM-DD)
     * @param {string} shiftCode - 班別代碼
     */
    setShift(staffId, date, shiftCode) {
        if (!this.scheduleData[staffId]) {
            this.scheduleData[staffId] = {};
        }
        this.scheduleData[staffId][date] = shiftCode;
    }
    
    /**
     * 取得指定日期的班別
     * @param {string} staffId - 員工 ID
     * @param {string} date - 日期
     * @returns {string|null}
     */
    getShift(staffId, date) {
        return this.scheduleData[staffId]?.[date] || null;
    }
    
    /**
     * 清除指定員工的班別
     * @param {string} staffId - 員工 ID
     * @param {string} date - 日期
     */
    clearShift(staffId, date) {
        if (this.scheduleData[staffId]) {
            delete this.scheduleData[staffId][date];
        }
    }
    
    /**
     * 清除所有排班
     */
    clearAll() {
        this.scheduleData = {};
    }
    
    /**
     * 計算員工統計
     * @param {string} staffId - 員工 ID
     * @param {Array} holidays - 假日列表
     * @returns {Object}
     */
    calculateStaffStats(staffId, holidays = []) {
        const staffSchedule = this.getStaffSchedule(staffId);
        const stats = {
            workDays: 0,
            offDays: 0,
            holidayWork: 0,
            shiftCounts: {},
            consecutiveMax: 0
        };
        
        let consecutiveDays = 0;
        let lastWasWork = false;
        
        Object.entries(staffSchedule).forEach(([date, shiftCode]) => {
            // 計算工作天數
            if (shiftCode !== 'FF' && shiftCode !== 'OFF') {
                stats.workDays++;
                
                // 計算連續工作天數
                if (lastWasWork) {
                    consecutiveDays++;
                } else {
                    consecutiveDays = 1;
                    lastWasWork = true;
                }
                
                stats.consecutiveMax = Math.max(stats.consecutiveMax, consecutiveDays);
                
                // 計算假日上班
                if (this.isHoliday(date, holidays)) {
                    stats.holidayWork++;
                }
            } else {
                stats.offDays++;
                lastWasWork = false;
                consecutiveDays = 0;
            }
            
            // 計算各班別天數
            if (!stats.shiftCounts[shiftCode]) {
                stats.shiftCounts[shiftCode] = 0;
            }
            stats.shiftCounts[shiftCode]++;
        });
        
        return stats;
    }
    
    /**
     * 檢查是否為假日
     * @param {string} date - 日期
     * @param {Array} holidays - 假日列表
     * @returns {boolean}
     */
    isHoliday(date, holidays) {
        const d = new Date(date);
        const weekday = d.getDay();
        
        // 週末
        if (weekday === 0 || weekday === 6) return true;
        
        // 國定假日
        return holidays.some(h => 
            h.enabled && h.date === date
        );
    }
    
    /**
     * 取得當月所有日期
     * @returns {Array<string>} 日期陣列 YYYY-MM-DD
     */
    getAllDates() {
        const dates = [];
        const daysInMonth = new Date(this.year, this.month, 0).getDate();
        
        for (let day = 1; day <= daysInMonth; day++) {
            const date = `${this.year}-${String(this.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            dates.push(date);
        }
        
        return dates;
    }
    
    /**
     * 取得前一個月的後 6 天日期
     * @returns {Array<string>}
     */
    getPreviousMonthDates() {
        const dates = [];
        const prevMonth = this.month === 1 ? 12 : this.month - 1;
        const prevYear = this.month === 1 ? this.year - 1 : this.year;
        const daysInPrevMonth = new Date(prevYear, prevMonth, 0).getDate();
        
        for (let i = 6; i >= 1; i--) {
            const day = daysInPrevMonth - i + 1;
            const date = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            dates.push(date);
        }
        
        return dates;
    }
    
    /**
     * 檢查排班完整性
     * @param {Array} staffList - 員工列表
     * @param {Object} requirements - 人數需求 { date: { shift: count } }
     * @returns {Object} { complete: boolean, missing: Array }
     */
    checkCompleteness(staffList, requirements = {}) {
        const missing = [];
        const dates = this.getAllDates();
        
        dates.forEach(date => {
            const dayRequirements = requirements[date] || {};
            const actual = {};
            
            // 計算實際人數
            staffList.forEach(staff => {
                const shift = this.getShift(staff.id, date);
                if (shift && shift !== 'FF' && shift !== 'OFF') {
                    if (!actual[shift]) actual[shift] = 0;
                    actual[shift]++;
                }
            });
            
            // 檢查是否符合需求
            Object.entries(dayRequirements).forEach(([shift, required]) => {
                const actualCount = actual[shift] || 0;
                if (actualCount < required) {
                    missing.push({
                        date,
                        shift,
                        required,
                        actual: actualCount,
                        shortage: required - actualCount
                    });
                }
            });
        });
        
        return {
            complete: missing.length === 0,
            missing
        };
    }
    
    /**
     * 轉換為 Plain Object
     */
    toObject() {
        return {
            year: this.year,
            month: this.month,
            unitId: this.unitId,
            scheduleData: this.scheduleData,
            status: this.status,
            publishedAt: this.publishedAt,
            publishedBy: this.publishedBy
        };
    }
    
    /**
     * 從 Plain Object 建立實例
     */
    static fromObject(obj) {
        return new Schedule(obj);
    }
    
    /**
     * 建立空排班表
     * @param {number} year - 年份
     * @param {number} month - 月份
     * @param {string} unitId - 單位 ID
     * @returns {Schedule}
     */
    static createEmpty(year, month, unitId) {
        return new Schedule({
            year,
            month,
            unitId,
            scheduleData: {},
            status: 'draft'
        });
    }
}

// 讓模型可在全域使用
if (typeof window !== 'undefined') {
    window.Schedule = Schedule;
}