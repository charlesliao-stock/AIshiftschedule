/**
 * 單位資料模型
 * 定義單位資料結構和相關方法
 */

class Unit {
    /**
     * 建立單位實例
     * @param {Object} data - 單位資料
     */
    constructor(data = {}) {
        this.id = data.unit_id || data.id || null;
        this.code = data.unit_code || data.code || '';
        this.name = data.unit_name || data.name || '';
        this.description = data.description || '';
        this.adminUsers = data.admin_users || data.adminUsers || [];
        this.schedulerUsers = data.scheduler_users || data.schedulerUsers || [];
        this.viewerUsers = data.viewer_users || data.viewerUsers || [];
        this.totalStaff = data.total_staff || data.totalStaff || 0;
        this.status = data.status || 'active';
        this.createdAt = data.created_at || data.createdAt || null;
        this.updatedAt = data.updated_at || data.updatedAt || null;
        this.createdBy = data.created_by || data.createdBy || null;
        this.updatedBy = data.updated_by || data.updatedBy || null;
        
        // Google Sheets 相關
        this.sheets = {
            settings: {
                id: data.settings_sheet_id || null,
                url: data.settings_sheet_url || null
            },
            preSchedule: {
                id: data.pre_schedule_sheet_id || null,
                url: data.pre_schedule_sheet_url || null
            },
            schedule: {
                id: data.schedule_sheet_id || null,
                url: data.schedule_sheet_url || null
            }
        };
    }
    
    // ==================== 驗證方法 ====================
    
    /**
     * 驗證單位資料
     * @returns {Object} {valid, errors}
     */
    validate() {
        const errors = [];
        
        if (!this.code || this.code.trim() === '') {
            errors.push('單位代碼為必填');
        } else if (!/^[A-Za-z0-9_]+$/.test(this.code)) {
            errors.push('單位代碼只能包含英文、數字、底線');
        } else if (this.code.length > 20) {
            errors.push('單位代碼不可超過 20 個字元');
        }
        
        if (!this.name || this.name.trim() === '') {
            errors.push('單位名稱為必填');
        } else if (this.name.length > 50) {
            errors.push('單位名稱不可超過 50 個字元');
        }
        
        if (this.description && this.description.length > 200) {
            errors.push('描述不可超過 200 個字元');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    /**
     * 檢查是否為有效狀態
     * @returns {boolean}
     */
    isActive() {
        return this.status === 'active';
    }
    
    /**
     * 檢查是否已建立 Sheets
     * @returns {boolean}
     */
    hasSheetsSetup() {
        return !!(this.sheets.settings.id && 
                 this.sheets.preSchedule.id && 
                 this.sheets.schedule.id);
    }
    
    // ==================== 使用者權限 ====================
    
    /**
     * 檢查使用者是否為管理者
     * @param {string} userEmail - 使用者 Email
     * @returns {boolean}
     */
    isAdmin(userEmail) {
        return this.adminUsers.includes(userEmail);
    }
    
    /**
     * 檢查使用者是否為排班者
     * @param {string} userEmail - 使用者 Email
     * @returns {boolean}
     */
    isScheduler(userEmail) {
        return this.schedulerUsers.includes(userEmail);
    }
    
    /**
     * 檢查使用者是否為一般使用者
     * @param {string} userEmail - 使用者 Email
     * @returns {boolean}
     */
    isViewer(userEmail) {
        return this.viewerUsers.includes(userEmail);
    }
    
    /**
     * 檢查使用者是否有權限存取此單位
     * @param {string} userEmail - 使用者 Email
     * @returns {boolean}
     */
    hasAccess(userEmail) {
        return this.isAdmin(userEmail) || 
               this.isScheduler(userEmail) || 
               this.isViewer(userEmail);
    }
    
    /**
     * 取得使用者角色
     * @param {string} userEmail - 使用者 Email
     * @returns {string|null}
     */
    getUserRole(userEmail) {
        if (this.isAdmin(userEmail)) return CONSTANTS.ROLES.ADMIN;
        if (this.isScheduler(userEmail)) return CONSTANTS.ROLES.SCHEDULER;
        if (this.isViewer(userEmail)) return CONSTANTS.ROLES.VIEWER;
        return null;
    }
    
    /**
     * 新增管理者
     * @param {string} userEmail - 使用者 Email
     */
    addAdmin(userEmail) {
        if (!this.adminUsers.includes(userEmail)) {
            this.adminUsers.push(userEmail);
        }
    }
    
    /**
     * 新增排班者
     * @param {string} userEmail - 使用者 Email
     */
    addScheduler(userEmail) {
        if (!this.schedulerUsers.includes(userEmail)) {
            this.schedulerUsers.push(userEmail);
        }
    }
    
    /**
     * 新增一般使用者
     * @param {string} userEmail - 使用者 Email
     */
    addViewer(userEmail) {
        if (!this.viewerUsers.includes(userEmail)) {
            this.viewerUsers.push(userEmail);
        }
    }
    
    /**
     * 移除使用者
     * @param {string} userEmail - 使用者 Email
     */
    removeUser(userEmail) {
        this.adminUsers = this.adminUsers.filter(e => e !== userEmail);
        this.schedulerUsers = this.schedulerUsers.filter(e => e !== userEmail);
        this.viewerUsers = this.viewerUsers.filter(e => e !== userEmail);
    }
    
    /**
     * 取得所有使用者
     * @returns {Array<string>}
     */
    getAllUsers() {
        return [
            ...this.adminUsers,
            ...this.schedulerUsers,
            ...this.viewerUsers
        ];
    }
    
    /**
     * 取得使用者總數
     * @returns {number}
     */
    getTotalUsers() {
        const allUsers = new Set(this.getAllUsers());
        return allUsers.size;
    }
    
    // ==================== 資料轉換 ====================
    
    /**
     * 轉換為 JSON 物件
     * @returns {Object}
     */
    toJSON() {
        return {
            unit_id: this.id,
            unit_code: this.code,
            unit_name: this.name,
            description: this.description,
            admin_users: this.adminUsers,
            scheduler_users: this.schedulerUsers,
            viewer_users: this.viewerUsers,
            total_staff: this.totalStaff,
            status: this.status,
            created_at: this.createdAt,
            updated_at: this.updatedAt,
            created_by: this.createdBy,
            updated_by: this.updatedBy,
            settings_sheet_id: this.sheets.settings.id,
            settings_sheet_url: this.sheets.settings.url,
            pre_schedule_sheet_id: this.sheets.preSchedule.id,
            pre_schedule_sheet_url: this.sheets.preSchedule.url,
            schedule_sheet_id: this.sheets.schedule.id,
            schedule_sheet_url: this.sheets.schedule.url
        };
    }
    
    /**
     * 轉換為 API 請求格式
     * @returns {Object}
     */
    toAPIFormat() {
        return {
            unit_code: this.code,
            unit_name: this.name,
            description: this.description,
            admin_users: this.adminUsers,
            scheduler_users: this.schedulerUsers,
            viewer_users: this.viewerUsers
        };
    }
    
    /**
     * 轉換為顯示格式
     * @returns {Object}
     */
    toDisplayFormat() {
        return {
            代碼: this.code,
            名稱: this.name,
            描述: this.description || '-',
            人員數: this.totalStaff,
            管理者: this.adminUsers.length,
            排班者: this.schedulerUsers.length,
            狀態: this.status === 'active' ? '啟用' : '停用',
            建立時間: this.createdAt ? Utils.formatDate(new Date(this.createdAt)) : '-'
        };
    }
    
    // ==================== 複製與更新 ====================
    
    /**
     * 複製單位
     * @returns {Unit}
     */
    clone() {
        return new Unit(this.toJSON());
    }
    
    /**
     * 更新單位資料
     * @param {Object} data - 更新資料
     */
    update(data) {
        if (data.unit_name !== undefined) this.name = data.unit_name;
        if (data.description !== undefined) this.description = data.description;
        if (data.admin_users !== undefined) this.adminUsers = data.admin_users;
        if (data.scheduler_users !== undefined) this.schedulerUsers = data.scheduler_users;
        if (data.viewer_users !== undefined) this.viewerUsers = data.viewer_users;
        if (data.total_staff !== undefined) this.totalStaff = data.total_staff;
        if (data.status !== undefined) this.status = data.status;
        
        this.updatedAt = new Date().toISOString();
    }
    
    // ==================== 工具方法 ====================
    
    /**
     * 取得顯示名稱
     * @returns {string}
     */
    getDisplayName() {
        return `${this.code} - ${this.name}`;
    }
    
    /**
     * 取得簡短描述
     * @param {number} maxLength - 最大長度
     * @returns {string}
     */
    getShortDescription(maxLength = 50) {
        if (!this.description) return '';
        return Utils.truncate(this.description, maxLength);
    }
    
    /**
     * 是否為新建立的單位
     * @returns {boolean}
     */
    isNew() {
        return !this.id;
    }
    
    /**
     * 取得建立天數
     * @returns {number}
     */
    getDaysSinceCreated() {
        if (!this.createdAt) return 0;
        const created = new Date(this.createdAt);
        const now = new Date();
        const diff = now - created;
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    }
    
    /**
     * 取得最後更新天數
     * @returns {number}
     */
    getDaysSinceUpdated() {
        if (!this.updatedAt) return this.getDaysSinceCreated();
        const updated = new Date(this.updatedAt);
        const now = new Date();
        const diff = now - updated;
        return Math.floor(diff / (1000 * 60 * 60 * 24));
    }
}

// ==================== 靜態方法 ====================

/**
 * 從 API 資料建立單位實例
 * @param {Object} apiData - API 資料
 * @returns {Unit}
 */
Unit.fromAPI = function(apiData) {
    return new Unit(apiData);
};

/**
 * 從 API 資料建立多個單位實例
 * @param {Array} apiDataArray - API 資料陣列
 * @returns {Array<Unit>}
 */
Unit.fromAPIArray = function(apiDataArray) {
    return apiDataArray.map(data => new Unit(data));
};

/**
 * 建立空單位
 * @returns {Unit}
 */
Unit.createEmpty = function() {
    return new Unit({
        status: 'active',
        admin_users: [],
        scheduler_users: [],
        viewer_users: []
    });
};

/**
 * 驗證單位代碼格式
 * @param {string} code - 單位代碼
 * @returns {boolean}
 */
Unit.isValidCode = function(code) {
    if (!code || typeof code !== 'string') return false;
    if (code.length > 20) return false;
    return /^[A-Za-z0-9_]+$/.test(code);
};

/**
 * 驗證單位名稱格式
 * @param {string} name - 單位名稱
 * @returns {boolean}
 */
Unit.isValidName = function(name) {
    if (!name || typeof name !== 'string') return false;
    if (name.trim() === '') return false;
    if (name.length > 50) return false;
    return true;
};

// 讓 Unit 模型可在全域使用
if (typeof window !== 'undefined') {
    window.Unit = Unit;
}

// 支援 Node.js 環境
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Unit;
}