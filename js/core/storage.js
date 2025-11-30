/**
 * 本地儲存管理
 * 封裝 localStorage 和 sessionStorage
 */

const Storage = {
    // ==================== localStorage 操作 ====================
    
    /**
     * 儲存資料到 localStorage
     * @param {string} key - 鍵
     * @param {*} value - 值 (會自動 JSON 序列化)
     */
    set(key, value) {
        try {
            const jsonValue = JSON.stringify(value);
            localStorage.setItem(key, jsonValue);
        } catch (error) {
            console.error('儲存失敗:', error);
        }
    },
    
    /**
     * 從 localStorage 讀取資料
     * @param {string} key - 鍵
     * @param {*} defaultValue - 預設值
     * @returns {*}
     */
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            if (item === null) return defaultValue;
            return JSON.parse(item);
        } catch (error) {
            console.error('讀取失敗:', error);
            return defaultValue;
        }
    },
    
    /**
     * 刪除 localStorage 中的資料
     * @param {string} key - 鍵
     */
    remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error('刪除失敗:', error);
        }
    },
    
    /**
     * 清空 localStorage
     */
    clear() {
        try {
            localStorage.clear();
        } catch (error) {
            console.error('清空失敗:', error);
        }
    },
    
    // ==================== sessionStorage 操作 ====================
    
    /**
     * 儲存資料到 sessionStorage
     * @param {string} key - 鍵
     * @param {*} value - 值
     */
    setSession(key, value) {
        try {
            const jsonValue = JSON.stringify(value);
            sessionStorage.setItem(key, jsonValue);
        } catch (error) {
            console.error('儲存失敗:', error);
        }
    },
    
    /**
     * 從 sessionStorage 讀取資料
     * @param {string} key - 鍵
     * @param {*} defaultValue - 預設值
     * @returns {*}
     */
    getSession(key, defaultValue = null) {
        try {
            const item = sessionStorage.getItem(key);
            if (item === null) return defaultValue;
            return JSON.parse(item);
        } catch (error) {
            console.error('讀取失敗:', error);
            return defaultValue;
        }
    },
    
    /**
     * 刪除 sessionStorage 中的資料
     * @param {string} key - 鍵
     */
    removeSession(key) {
        try {
            sessionStorage.removeItem(key);
        } catch (error) {
            console.error('刪除失敗:', error);
        }
    },
    
    /**
     * 清空 sessionStorage
     */
    clearSession() {
        try {
            sessionStorage.clear();
        } catch (error) {
            console.error('清空失敗:', error);
        }
    },
    
    // ==================== 快捷方法 (使用系統定義的鍵) ====================
    
    /**
     * 儲存使用者資料
     * @param {Object} user - 使用者物件
     */
    saveUser(user) {
        this.set(CONSTANTS.STORAGE_KEYS.USER, user);
    },
    
    /**
     * 取得使用者資料
     * @returns {Object|null}
     */
    getUser() {
        return this.get(CONSTANTS.STORAGE_KEYS.USER);
    },
    
    /**
     * 刪除使用者資料
     */
    removeUser() {
        this.remove(CONSTANTS.STORAGE_KEYS.USER);
    },
    
    /**
     * 儲存認證 Token
     * @param {string} token - Token
     */
    saveToken(token) {
        this.set(CONSTANTS.STORAGE_KEYS.TOKEN, token);
    },
    
    /**
     * 取得認證 Token
     * @returns {string|null}
     */
    getToken() {
        return this.get(CONSTANTS.STORAGE_KEYS.TOKEN);
    },
    
    /**
     * 刪除認證 Token
     */
    removeToken() {
        this.remove(CONSTANTS.STORAGE_KEYS.TOKEN);
    },
    
    /**
     * 儲存系統設定
     * @param {Object} settings - 設定物件
     */
    saveSettings(settings) {
        this.set(CONSTANTS.STORAGE_KEYS.SETTINGS, settings);
    },
    
    /**
     * 取得系統設定
     * @returns {Object}
     */
    getSettings() {
        return this.get(CONSTANTS.STORAGE_KEYS.SETTINGS, {});
    },
    
    /**
     * 儲存側邊欄收合狀態
     * @param {boolean} collapsed - 是否收合
     */
    saveSidebarCollapsed(collapsed) {
        this.set(CONSTANTS.STORAGE_KEYS.SIDEBAR_COLLAPSED, collapsed);
    },
    
    /**
     * 取得側邊欄收合狀態
     * @returns {boolean}
     */
    getSidebarCollapsed() {
        return this.get(CONSTANTS.STORAGE_KEYS.SIDEBAR_COLLAPSED, false);
    },
    
    // ==================== 工具方法 ====================
    
    /**
     * 檢查 localStorage 是否可用
     * @returns {boolean}
     */
    isLocalStorageAvailable() {
        try {
            const test = '__storage_test__';
            localStorage.setItem(test, test);
            localStorage.removeItem(test);
            return true;
        } catch (error) {
            return false;
        }
    },
    
    /**
     * 取得 localStorage 已使用空間 (大約值)
     * @returns {number} 位元組數
     */
    getUsedSpace() {
        let total = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                total += localStorage[key].length + key.length;
            }
        }
        return total;
    },
    
    /**
     * 取得 localStorage 已使用空間 (人類可讀格式)
     * @returns {string}
     */
    getUsedSpaceReadable() {
        const bytes = this.getUsedSpace();
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }
};

// 讓儲存管理可在全域使用
if (typeof window !== 'undefined') {
    window.Storage = Storage;
}