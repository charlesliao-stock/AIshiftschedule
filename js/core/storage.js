/**
 * js/core/storage.js
 * 本地儲存管理 (ES Module 版)
 * 封裝 localStorage 與 sessionStorage 操作，並提供型別安全的方法
 */

import { CONSTANTS } from '../config/constants.js';

export const Storage = {
    // ==================== localStorage 核心操作 ====================
    
    set(key, value) {
        try {
            const jsonValue = JSON.stringify(value);
            localStorage.setItem(key, jsonValue);
        } catch (error) {
            console.error('[Storage] 儲存失敗:', error);
        }
    },
    
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            if (item === null) return defaultValue;
            return JSON.parse(item);
        } catch (error) {
            console.error('[Storage] 讀取失敗:', error);
            return defaultValue;
        }
    },
    
    remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error('[Storage] 刪除失敗:', error);
        }
    },
    
    clear() {
        try {
            localStorage.clear();
            console.log('[Storage] LocalStorage 已清空');
        } catch (error) {
            console.error('[Storage] 清空失敗:', error);
        }
    },
    
    // ==================== sessionStorage 核心操作 ====================
    
    setSession(key, value) {
        try {
            const jsonValue = JSON.stringify(value);
            sessionStorage.setItem(key, jsonValue);
        } catch (error) {
            console.error('[Storage] Session 儲存失敗:', error);
        }
    },
    
    getSession(key, defaultValue = null) {
        try {
            const item = sessionStorage.getItem(key);
            if (item === null) return defaultValue;
            return JSON.parse(item);
        } catch (error) {
            console.error('[Storage] Session 讀取失敗:', error);
            return defaultValue;
        }
    },
    
    removeSession(key) {
        try {
            sessionStorage.removeItem(key);
        } catch (error) {
            console.error('[Storage] Session 刪除失敗:', error);
        }
    },
    
    clearSession() {
        try {
            sessionStorage.clear();
        } catch (error) {
            console.error('[Storage] Session 清空失敗:', error);
        }
    },
    
    // ==================== 快捷方法 (業務邏輯封裝) ====================
    // 使用 CONSTANTS 定義的鍵值，避免字串拼寫錯誤
    
    saveUser(user) {
        const key = CONSTANTS.STORAGE_KEYS?.USER || 'app_user';
        this.set(key, user);
    },
    
    getUser() {
        const key = CONSTANTS.STORAGE_KEYS?.USER || 'app_user';
        return this.get(key);
    },
    
    removeUser() {
        const key = CONSTANTS.STORAGE_KEYS?.USER || 'app_user';
        this.remove(key);
    },
    
    saveToken(token) {
        const key = CONSTANTS.STORAGE_KEYS?.TOKEN || 'app_token';
        this.set(key, token);
    },
    
    getToken() {
        const key = CONSTANTS.STORAGE_KEYS?.TOKEN || 'app_token';
        return this.get(key);
    },
    
    removeToken() {
        const key = CONSTANTS.STORAGE_KEYS?.TOKEN || 'app_token';
        this.remove(key);
    },
    
    saveSettings(settings) {
        const key = CONSTANTS.STORAGE_KEYS?.SETTINGS || 'app_settings';
        this.set(key, settings);
    },
    
    getSettings() {
        const key = CONSTANTS.STORAGE_KEYS?.SETTINGS || 'app_settings';
        return this.get(key, {});
    },
    
    saveSidebarCollapsed(collapsed) {
        const key = CONSTANTS.STORAGE_KEYS?.SIDEBAR_COLLAPSED || 'sidebar_collapsed';
        this.set(key, collapsed);
    },
    
    getSidebarCollapsed() {
        const key = CONSTANTS.STORAGE_KEYS?.SIDEBAR_COLLAPSED || 'sidebar_collapsed';
        return this.get(key, false);
    },
    
    // ==================== 工具方法 ====================
    
    /**
     * 檢查 LocalStorage 是否可用
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
     * 計算已使用的空間 (Bytes)
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
     * 計算已使用的空間 (可讀格式)
     */
    getUsedSpaceReadable() {
        const bytes = this.getUsedSpace();
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }
};
