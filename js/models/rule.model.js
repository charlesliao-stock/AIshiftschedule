/**
 * js/models/rule.model.js
 * 排班規則資料模型 (ES Module 版)
 */

import { CONSTANTS } from '../config/constants.js';

export class Rule {
    constructor(data = {}) {
        this.monthlyOffDays = data.monthlyOffDays || 8;
        this.dailyPreScheduleLimit = data.dailyPreScheduleLimit || 'dynamic';
        this.holidayPreScheduleLimit = data.holidayPreScheduleLimit || 2;
        this.monthlyPreScheduleLimit = data.monthlyPreScheduleLimit || 'dynamic';
        this.averageOffDays = data.averageOffDays || 8.4;
        
        this.packageMinDays = data.packageMinDays || 16;
        this.enablePackageRule = data.enablePackageRule !== false;
        
        this.enableShiftOrder = data.enableShiftOrder !== false;
        this.shiftOrder = data.shiftOrder || ['FF', '大', '白', '小', 'DL'];
        
        this.enableFFNoNight = data.enableFFNoNight !== false;
        
        this.holidayLimitFormula = data.holidayLimitFormula || 'Math.floor(假日數/2)';
        
        this.offCountToLimit = data.offCountToLimit !== false;
        this.otherShiftCountToLimit = data.otherShiftCountToLimit || false;
        
        this.swapOpenDays = data.swapOpenDays || 7;
        this.swapCountToStats = data.swapCountToStats !== false;
        
        this.laborStandardType = data.laborStandardType || 'four_week';
        this.enableLaborCheck = data.enableLaborCheck !== false;
    }
    
    validate() {
        const errors = [];
        if (this.monthlyOffDays < 0 || this.monthlyOffDays > 31) errors.push('本月應放天數必須在 0-31 之間');
        if (this.holidayPreScheduleLimit < 0) errors.push('假日可預天數不可為負數');
        if (this.packageMinDays < 0 || this.packageMinDays > 31) errors.push('包班最少天數必須在 0-31 之間');
        if (this.swapOpenDays < 0 || this.swapOpenDays > 30) errors.push('換班開放天數必須在 0-30 之間');
        if (!Array.isArray(this.shiftOrder) || this.shiftOrder.length === 0) errors.push('請設定班別順序');
        
        return { valid: errors.length === 0, errors };
    }
    
    calculateDailyPreScheduleLimit(totalStaff, requiredStaff) {
        if (this.dailyPreScheduleLimit === 'dynamic') {
            return Math.max(0, totalStaff - requiredStaff - 1);
        }
        return parseInt(this.dailyPreScheduleLimit) || 0;
    }
    
    calculateMonthlyPreScheduleLimit() {
        if (this.monthlyPreScheduleLimit === 'dynamic') {
            return Math.floor(this.averageOffDays / 2);
        }
        return parseInt(this.monthlyPreScheduleLimit) || 0;
    }
    
    calculateHolidayLimit(totalHolidays) {
        return Math.floor(totalHolidays / 2);
    }
    
    isValidShiftOrder(prevShift, nextShift) {
        if (!this.enableShiftOrder) return true;
        
        const prevIndex = this.shiftOrder.indexOf(prevShift);
        const nextIndex = this.shiftOrder.indexOf(nextShift);
        
        if (prevIndex === -1 || nextIndex === -1) return true;
        return nextIndex >= prevIndex;
    }
    
    toObject() {
        return {
            monthlyOffDays: this.monthlyOffDays,
            dailyPreScheduleLimit: this.dailyPreScheduleLimit,
            holidayPreScheduleLimit: this.holidayPreScheduleLimit,
            monthlyPreScheduleLimit: this.monthlyPreScheduleLimit,
            averageOffDays: this.averageOffDays,
            packageMinDays: this.packageMinDays,
            enablePackageRule: this.enablePackageRule,
            enableShiftOrder: this.enableShiftOrder,
            shiftOrder: this.shiftOrder,
            enableFFNoNight: this.enableFFNoNight,
            holidayLimitFormula: this.holidayLimitFormula,
            offCountToLimit: this.offCountToLimit,
            otherShiftCountToLimit: this.otherShiftCountToLimit,
            swapOpenDays: this.swapOpenDays,
            swapCountToStats: this.swapCountToStats,
            laborStandardType: this.laborStandardType,
            enableLaborCheck: this.enableLaborCheck
        };
    }
    
    static fromObject(obj) {
        return new Rule(obj);
    }
    
    static getDefaults() {
        return new Rule(CONSTANTS.DEFAULT_RULES);
    }
}