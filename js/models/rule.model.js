/**
 * 排班規則資料模型
 */

class Rule {
    constructor(data = {}) {
        // 基本規則
        this.monthlyOffDays = data.monthlyOffDays || 8;
        this.dailyPreScheduleLimit = data.dailyPreScheduleLimit || 'dynamic';
        this.holidayPreScheduleLimit = data.holidayPreScheduleLimit || 2;
        this.monthlyPreScheduleLimit = data.monthlyPreScheduleLimit || 'dynamic';
        this.averageOffDays = data.averageOffDays || 8.4;
        
        // 包班規則
        this.packageMinDays = data.packageMinDays || 16;
        this.enablePackageRule = data.enablePackageRule !== false;
        
        // 接班規則
        this.enableShiftOrder = data.enableShiftOrder !== false;
        this.shiftOrder = data.shiftOrder || ['FF', '大', '白', '小', 'DL'];
        
        // 特殊規則
        this.enableFFNoNight = data.enableFFNoNight !== false;
        
        // 假日規則
        this.holidayLimitFormula = data.holidayLimitFormula || 'Math.floor(假日數/2)';
        
        // 預班規則
        this.offCountToLimit = data.offCountToLimit !== false;
        this.otherShiftCountToLimit = data.otherShiftCountToLimit || false;
        
        // 換班規則
        this.swapOpenDays = data.swapOpenDays || 7;
        this.swapCountToStats = data.swapCountToStats !== false;
        
        // 勞基法規範
        this.laborStandardType = data.laborStandardType || 'four_week';
        this.enableLaborCheck = data.enableLaborCheck !== false;
    }
    
    /**
     * 驗證規則資料
     * @returns {Object} { valid: boolean, errors: Array }
     */
    validate() {
        const errors = [];
        
        if (this.monthlyOffDays < 0 || this.monthlyOffDays > 31) {
            errors.push('本月應放天數必須在 0-31 之間');
        }
        
        if (this.holidayPreScheduleLimit < 0) {
            errors.push('假日可預天數不可為負數');
        }
        
        if (this.packageMinDays < 0 || this.packageMinDays > 31) {
            errors.push('包班最少天數必須在 0-31 之間');
        }
        
        if (this.swapOpenDays < 0 || this.swapOpenDays > 30) {
            errors.push('換班開放天數必須在 0-30 之間');
        }
        
        if (!Array.isArray(this.shiftOrder) || this.shiftOrder.length === 0) {
            errors.push('請設定班別順序');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    /**
     * 計算每日可預人數
     * @param {number} totalStaff - 總人數
     * @param {number} requiredStaff - 應排人數
     * @returns {number}
     */
    calculateDailyPreScheduleLimit(totalStaff, requiredStaff) {
        if (this.dailyPreScheduleLimit === 'dynamic') {
            return Math.max(0, totalStaff - requiredStaff - 1);
        }
        return parseInt(this.dailyPreScheduleLimit) || 0;
    }
    
    /**
     * 計算全月可預天數
     * @returns {number}
     */
    calculateMonthlyPreScheduleLimit() {
        if (this.monthlyPreScheduleLimit === 'dynamic') {
            return Math.floor(this.averageOffDays / 2);
        }
        return parseInt(this.monthlyPreScheduleLimit) || 0;
    }
    
    /**
     * 計算假日上限
     * @param {number} totalHolidays - 當月假日數
     * @returns {number}
     */
    calculateHolidayLimit(totalHolidays) {
        return Math.floor(totalHolidays / 2);
    }
    
    /**
     * 檢查接班順序是否合法
     * @param {string} prevShift - 前一班
     * @param {string} nextShift - 後一班
     * @returns {boolean}
     */
    isValidShiftOrder(prevShift, nextShift) {
        if (!this.enableShiftOrder) return true;
        
        const prevIndex = this.shiftOrder.indexOf(prevShift);
        const nextIndex = this.shiftOrder.indexOf(nextShift);
        
        if (prevIndex === -1 || nextIndex === -1) return true;
        
        // 順向接班: 後一班的順序要大於等於前一班
        return nextIndex >= prevIndex;
    }
    
    /**
     * 轉換為 Plain Object
     */
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
    
    /**
     * 從 Plain Object 建立實例
     */
    static fromObject(obj) {
        return new Rule(obj);
    }
    
    /**
     * 取得預設規則
     */
    static getDefaults() {
        return new Rule(CONSTANTS.DEFAULT_RULES);
    }
}

// 讓模型可在全域使用
if (typeof window !== 'undefined') {
    window.Rule = Rule;
}