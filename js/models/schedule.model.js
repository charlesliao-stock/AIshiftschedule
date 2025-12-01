/**
 * js/models/schedule.model.js
 * 排班資料模型 (ES Module 版)
 */

export class Schedule {
    constructor(data = {}) {
        this.year = data.year || new Date().getFullYear();
        this.month = data.month || new Date().getMonth() + 1;
        this.unitId = data.unitId || '';
        this.scheduleData = data.scheduleData || {}; // { staffId: { date: shiftCode } }
        this.status = data.status || 'draft'; // draft, published
        this.publishedAt = data.publishedAt || null;
        this.publishedBy = data.publishedBy || null;
    }
    
    getMonthString() {
        return `${this.year}${String(this.month).padStart(2, '0')}`;
    }
    
    getStaffSchedule(staffId) {
        return this.scheduleData[staffId] || {};
    }
    
    setShift(staffId, date, shiftCode) {
        if (!this.scheduleData[staffId]) {
            this.scheduleData[staffId] = {};
        }
        this.scheduleData[staffId][date] = shiftCode;
    }
    
    getShift(staffId, date) {
        return this.scheduleData[staffId]?.[date] || null;
    }
    
    clearShift(staffId, date) {
        if (this.scheduleData[staffId]) {
            delete this.scheduleData[staffId][date];
        }
    }
    
    clearAll() {
        this.scheduleData = {};
    }
    
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
                
                if (lastWasWork) {
                    consecutiveDays++;
                } else {
                    consecutiveDays = 1;
                    lastWasWork = true;
                }
                
                stats.consecutiveMax = Math.max(stats.consecutiveMax, consecutiveDays);
                
                if (this.isHoliday(date, holidays)) {
                    stats.holidayWork++;
                }
            } else {
                stats.offDays++;
                lastWasWork = false;
                consecutiveDays = 0;
            }
            
            if (!stats.shiftCounts[shiftCode]) {
                stats.shiftCounts[shiftCode] = 0;
            }
            stats.shiftCounts[shiftCode]++;
        });
        
        return stats;
    }
    
    isHoliday(date, holidays) {
        const d = new Date(date);
        const weekday = d.getDay();
        
        if (weekday === 0 || weekday === 6) return true;
        
        return holidays.some(h => h.enabled && h.date === date);
    }
    
    getAllDates() {
        const dates = [];
        const daysInMonth = new Date(this.year, this.month, 0).getDate();
        
        for (let day = 1; day <= daysInMonth; day++) {
            const date = `${this.year}-${String(this.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            dates.push(date);
        }
        
        return dates;
    }
    
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
    
    checkCompleteness(staffList, requirements = {}) {
        const missing = [];
        const dates = this.getAllDates();
        
        dates.forEach(date => {
            const dayRequirements = requirements[date] || {};
            const actual = {};
            
            staffList.forEach(staff => {
                const shift = this.getShift(staff.id, date);
                if (shift && shift !== 'FF' && shift !== 'OFF') {
                    if (!actual[shift]) actual[shift] = 0;
                    actual[shift]++;
                }
            });
            
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
    
    static fromObject(obj) {
        return new Schedule(obj);
    }
    
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