/**
 * js/core/auth.js
 * 使用者認證管理 (含角色權限讀取 & 完整權限判斷)
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
        
        this.authInstance = FirebaseService.auth;
        
        if (!this.authInstance) {
            console.error('[Auth] 無法取得 Firebase Auth 實體');
            throw new Error('Auth Initialization Failed');
        }

        // 監聽登入狀態
        onAuthStateChanged(this.authInstance, async (user) => {
            await this.handleAuthStateChange(user);
        });

        // 優先載入本地緩存的使用者
        const savedUser = Storage.get(CONSTANTS.STORAGE_KEYS.USER);
        if (savedUser) {
            this.currentUser = savedUser; 
            console.log(`[Auth] 從本地儲存載入使用者: ${savedUser.email} (Role: ${savedUser.role})`);
        }
    },

    /**
     * 處理狀態變更
     */
    async handleAuthStateChange(user) {
        if (user) {
            let profile = {
                uid: user.uid,
                email: user.email,
                displayName: user.displayName || user.email.split('@')[0],
                photoURL: user.photoURL,
                emailVerified: user.emailVerified,
                role: CONSTANTS.ROLES.USER
            };

            try {
                const userDoc = await FirebaseService.getDocument('users', user.uid);
                if (userDoc) {
                    profile = { ...profile, ...userDoc };
                } else {
                    await this.createUserProfile(profile);
                }
            } catch (error) {
                console.error('[Auth] 讀取使用者設定檔失敗:', error);
            }

            // 強制設定 admin@hospital.com 為系統管理員
            if (user.email === 'admin@hospital.com') {
                profile.role = CONSTANTS.ROLES.ADMIN;
                console.log('[Auth] 偵測到系統管理員帳號，強制賦予 Admin 權限');
            }

            this.currentUser = profile;
            Storage.set(CONSTANTS.STORAGE_KEYS.USER, this.currentUser);
            
        } else {
            this.currentUser = null;
            Storage.remove(CONSTANTS.STORAGE_KEYS.USER);
        }

        this.notifyListeners(this.currentUser);
    },

    async createUserProfile(profile) {
        try {
            const safeProfile = JSON.parse(JSON.stringify(profile));
            await FirebaseService.addDocument('users', safeProfile, profile.uid);
        } catch (e) {
            console.error('[Auth] 建立使用者檔案失敗', e);
        }
    },

    async login(email, password) {
        try {
            if (!this.authInstance) throw new Error('Auth not initialized');
            const userCredential = await signInWithEmailAndPassword(this.authInstance, email, password);
            return userCredential.user;
        } catch (error) {
            console.error('[Auth] 登入失敗:', error.code);
            throw error;
        }
    },

    async logout() {
        try {
            if (!this.authInstance) return;
            await signOut(this.authInstance);
            Storage.clear(); 
            window.location.href = 'login.html';
        } catch (error) {
            console.error('[Auth] 登出失敗:', error);
            throw error;
        }
    },

    isAuthenticated() {
        return !!this.currentUser;
    },

    getCurrentUser() {
        return this.currentUser;
    },

    getUserRole() {
        return this.currentUser?.role || CONSTANTS.ROLES.USER;
    },

    // 🔥 新增：判斷是否為系統管理員
    isAdmin() {
        return this.getUserRole() === CONSTANTS.ROLES.ADMIN;
    },

    // 🔥 新增：判斷是否為單位管理者 (包含 Admin，因為 Admin 權限大於 Manager)
    isManager() {
        const role = this.getUserRole();
        return role === CONSTANTS.ROLES.MANAGER || role === CONSTANTS.ROLES.ADMIN;
    },

    async getToken() {
        if (!this.authInstance?.currentUser) return null;
        return await this.authInstance.currentUser.getIdToken();
    },

    onAuthStateChanged(callback) {
        if (typeof callback === 'function') {
            this.listeners.push(callback);
            if (this.currentUser) {
                callback(this.currentUser);
            }
        }
    },

    notifyListeners(user) {
        this.listeners.forEach(listener => listener(user));
    }
};
