/**
 * js/core/storage.js
 * 本地儲存管理 (ES Module 版)
 */

import { CONSTANTS } from '../config/constants.js';

export const Storage = {
    // ==================== localStorage 操作 ====================
    
    set(key, value) {
        try {
            const jsonValue = JSON.stringify(value);
            localStorage.setItem(key, jsonValue);
        } catch (error) {
            console.error('儲存失敗:', error);
        }
    },
    
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
    
    remove(key) {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error('刪除失敗:', error);
        }
    },
    
    clear() {
        try {
            localStorage.clear();
        } catch (error) {
            console.error('清空失敗:', error);
        }
    },
    
    // ==================== sessionStorage 操作 ====================
    
    setSession(key, value) {
        try {
            const jsonValue = JSON.stringify(value);
            sessionStorage.setItem(key, jsonValue);
        } catch (error) {
            console.error('儲存失敗:', error);
        }
    },
    
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
    
    removeSession(key) {
        try {
            sessionStorage.removeItem(key);
        } catch (error) {
            console.error('刪除失敗:', error);
        }
    },
    
    clearSession() {
        try {
            sessionStorage.clear();
        } catch (error) {
            console.error('清空失敗:', error);
        }
    },
    
    // ==================== 快捷方法 (使用系統定義的鍵) ====================
    
    saveUser(user) {
        // 使用 Optional Chaining 防止 CONSTANTS 未載入
        const key = CONSTANTS.STORAGE_KEYS?.USER || 'nursing_schedule_user';
        this.set(key, user);
    },
    
    getUser() {
        const key = CONSTANTS.STORAGE_KEYS?.USER || 'nursing_schedule_user';
        return this.get(key);
    },
    
    removeUser() {
        const key = CONSTANTS.STORAGE_KEYS?.USER || 'nursing_schedule_user';
        this.remove(key);
    },
    
    saveToken(token) {
        const key = CONSTANTS.STORAGE_KEYS?.TOKEN || 'nursing_schedule_token';
        this.set(key, token);
    },
    
    getToken() {
        const key = CONSTANTS.STORAGE_KEYS?.TOKEN || 'nursing_schedule_token';
        return this.get(key);
    },
    
    removeToken() {
        const key = CONSTANTS.STORAGE_KEYS?.TOKEN || 'nursing_schedule_token';
        this.remove(key);
    },
    
    saveSettings(settings) {
        const key = CONSTANTS.STORAGE_KEYS?.SETTINGS || 'nursing_schedule_settings';
        this.set(key, settings);
    },
    
    getSettings() {
        const key = CONSTANTS.STORAGE_KEYS?.SETTINGS || 'nursing_schedule_settings';
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
    
    getUsedSpace() {
        let total = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                total += localStorage[key].length + key.length;
            }
        }
        return total;
    },
    
    getUsedSpaceReadable() {
        const bytes = this.getUsedSpace();
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }
};