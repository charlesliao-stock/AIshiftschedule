/**
 * 組別資料模型
 */

class Group {
    constructor(data = {}) {
        this.id = data.id || null;
        this.name = data.name || '';
        this.totalStaff = data.totalStaff || 0;
        this.minPerShift = data.minPerShift || 0;
        this.maxPerShift = data.maxPerShift || 0;
        this.description = data.description || '';
    }
    
    /**
     * 驗證組別資料
     * @returns {Object} { valid: boolean, errors: Array }
     */
    validate() {
        const errors = [];
        
        if (!this.name || !this.name.trim()) {
            errors.push('請輸入組別名稱');
        }
        
        if (this.totalStaff < 0) {
            errors.push('總員額不可為負數');
        }
        
        if (this.minPerShift < 0) {
            errors.push('每班最少人數不可為負數');
        }
        
        if (this.maxPerShift < 0) {
            errors.push('每班最多人數不可為負數');
        }
        
        if (this.minPerShift > this.maxPerShift) {
            errors.push('每班最少人數不可大於最多人數');
        }
        
        if (this.maxPerShift > this.totalStaff) {
            errors.push('每班最多人數不可大於總員額');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    /**
     * 轉換為 Plain Object
     */
    toObject() {
        return {
            id: this.id,
            name: this.name,
            totalStaff: this.totalStaff,
            minPerShift: this.minPerShift,
            maxPerShift: this.maxPerShift,
            description: this.description
        };
    }
    
    /**
     * 從 Plain Object 建立實例
     */
    static fromObject(obj) {
        return new Group(obj);
    }
    
    /**
     * 取得預設組別列表
     */
    static getDefaults() {
        return CONSTANTS.DEFAULT_GROUPS.map(g => new Group(g));
    }
}

// 讓模型可在全域使用
if (typeof window !== 'undefined') {
    window.Group = Group;
}