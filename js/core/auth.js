/**
 * js/core/auth.js
 * 使用者認證管理 (ES Module / Modular SDK)
 * 負責登入、登出與狀態監聽
 */

import { 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { FirebaseService } from '../services/firebase.service.js';
import { Storage } from './storage.js';
import { CONSTANTS } from '../config/constants.js';

export const Auth = {
    authInstance: null,
    currentUser: null,
    listeners: [],

    /**
     * 初始化認證模組
     */
    async init() {
        console.log('[Auth] 初始化認證系統...');
        
        // 1. 從 FirebaseService 取得 Auth 實體
        this.authInstance = FirebaseService.auth;
        
        if (!this.authInstance) {
            console.error('[Auth] 無法取得 Firebase Auth 實體，請檢查 FirebaseService 初始化順序');
            throw new Error('Auth Initialization Failed');
        }

        // 2. 註冊 Firebase 狀態監聽
        // 使用 Modular SDK 的 onAuthStateChanged
        onAuthStateChanged(this.authInstance, (user) => {
            this.handleAuthStateChange(user);
        });

        // 3. 嘗試從 LocalStorage 恢復使用者資訊 (用於快速渲染 UI)
        const savedUser = Storage.get(CONSTANTS.STORAGE_KEYS.USER);
        if (savedUser) {
            console.log(`[Auth] 從本地儲存載入使用者: ${savedUser.email}`);
            this.currentUser = savedUser;
        }
    },

    /**
     * 處理狀態變更
     * @param {object|null} user Firebase User 物件
     */
    handleAuthStateChange(user) {
        if (user) {
            // 使用者已登入
            this.currentUser = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || user.email.split('@')[0],
                photoURL: user.photoURL,
                emailVerified: user.emailVerified
            };
            // 更新本地儲存
            Storage.set(CONSTANTS.STORAGE_KEYS.USER, this.currentUser);
        } else {
            // 使用者已登出
            this.currentUser = null;
            Storage.remove(CONSTANTS.STORAGE_KEYS.USER);
        }

        // 通知所有註冊的監聽器 (例如 Navbar, Sidebar)
        this.notifyListeners(this.currentUser);
    },

    /**
     * 登入
     * @param {string} email 
     * @param {string} password 
     */
    async login(email, password) {
        try {
            if (!this.authInstance) throw new Error('Auth not initialized');
            
            // 使用 Modular SDK 的 signInWithEmailAndPassword
            const userCredential = await signInWithEmailAndPassword(this.authInstance, email, password);
            return userCredential.user;
        } catch (error) {
            console.error('[Auth] 登入失敗:', error.code, error.message);
            throw error;
        }
    },

    /**
     * 登出
     */
    async logout() {
        try {
            if (!this.authInstance) return;
            
            // 使用 Modular SDK 的 signOut
            await signOut(this.authInstance);
            console.log('[Auth] 使用者已登出');
            
            // 清除本地資料
            Storage.clear(); 
            // 重新導向至登入頁
            window.location.href = 'login.html';
        } catch (error) {
            console.error('[Auth] 登出失敗:', error);
            throw error;
        }
    },

    /**
     * 檢查是否已登入
     */
    isAuthenticated() {
        return !!this.currentUser;
    },

    /**
     * 取得當前使用者資訊
     */
    getCurrentUser() {
        return this.currentUser;
    },

    /**
     * 取得 Auth Token (用於 API 請求)
     */
    async getToken() {
        if (!this.authInstance?.currentUser) return null;
        return await this.authInstance.currentUser.getIdToken();
    },

    /**
     * 註冊狀態變更監聽器 (Observer Pattern)
     * @param {Function} callback (user) => {}
     */
    onAuthStateChanged(callback) {
        if (typeof callback === 'function') {
            this.listeners.push(callback);
            // 如果當前已有狀態，立即觸發一次
            if (this.currentUser) {
                callback(this.currentUser);
            }
        }
    },

    /**
     * 通知所有監聽器 (內部使用)
     */
    notifyListeners(user) {
        this.listeners.forEach(listener => {
            try {
                listener(user);
            } catch (error) {
                console.error('[Auth] Listener error:', error);
            }
        });
    }
};
