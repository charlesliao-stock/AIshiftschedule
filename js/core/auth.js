/**
 * js/core/auth.js
 * 認證管理 (ES Module 版)
 */

import { FIREBASE_CONFIG } from '../config/firebase.config.js';
import { CONSTANTS } from '../config/constants.js';
import { Storage } from './storage.js';
import { Utils } from './utils.js';

export const Auth = {
    currentUser: null,
    authStateChangedCallbacks: [],
    
    // ==================== 初始化 ====================
    
    async init() {
        console.log('[Auth] 初始化認證系統...');
        
        // 檢查本地儲存的使用者
        const storedUser = Storage.getUser();
        if (storedUser) {
            this.currentUser = storedUser;
            console.log('[Auth] 從本地儲存載入使用者:', storedUser.email);
            this.notifyAuthStateChanged();
        }
        
        // 如果使用 Firebase，監聽認證狀態變化
        // 注意：window.firebase 由 HTML 的 compat SDK 提供
        if (FIREBASE_CONFIG.demo?.enabled === false && window.firebase) {
            window.firebase.auth().onAuthStateChanged(async (firebaseUser) => {
                if (firebaseUser) {
                    // 如果本地沒有使用者資料，或者 UID 不匹配，才從 Firebase 重新載入
                    // 避免重複讀取 Firestore 浪費流量
                    if (!this.currentUser || this.currentUser.uid !== firebaseUser.uid) {
                         await this.loadUserFromFirebase(firebaseUser);
                    }
                } else {
                    this.currentUser = null;
                    Storage.removeUser();
                    this.notifyAuthStateChanged();
                }
            });
        }
    },
    
    // ==================== 登入 ====================
    
    async login(email, password) {
        console.log('[Auth] 嘗試登入:', email);
        
        try {
            // Demo 模式
            if (FIREBASE_CONFIG.demo?.enabled) {
                return await this.loginDemo(email, password);
            }
            
            // Firebase 認證
            if (window.firebase) {
                const userCredential = await window.firebase.auth()
                    .signInWithEmailAndPassword(email, password);
                return await this.loadUserFromFirebase(userCredential.user);
            }
            
            throw new Error('認證服務未初始化');
            
        } catch (error) {
            console.error('[Auth] 登入失敗:', error);
            throw this.handleAuthError(error);
        }
    },
    
    async loginDemo(email, password) {
        await Utils.sleep(800);
        
        const demoUser = FIREBASE_CONFIG.demo.users.find(
            u => u.email.toLowerCase() === email.toLowerCase()
        );
        
        if (!demoUser) {
            throw new Error('帳號不存在');
        }
        
        const user = {
            uid: 'demo_' + demoUser.email.split('@')[0],
            email: demoUser.email,
            displayName: demoUser.displayName,
            role: demoUser.role,
            unit_id: demoUser.unit_id,
            unit_name: demoUser.unit_name,
            permissions: demoUser.permissions,
            createdAt: new Date().toISOString(),
            lastLogin: new Date().toISOString()
        };
        
        this.currentUser = user;
        Storage.saveUser(user);
        this.notifyAuthStateChanged();
        
        return user;
    },
    
async loadUserFromFirebase(firebaseUser) {
        try {
            const userRef = window.firebase.firestore()
                .collection(FIREBASE_CONFIG.collections.USERS)
                .doc(firebaseUser.uid);

            const userDoc = await userRef.get();
            
            let userData;

            if (!userDoc.exists) {
                console.warn('[Auth] Firestore 中找不到使用者資料，正在自動建立預設資料...');

                // 自動判斷：如果是 admin 帳號，直接給予 admin 權限
                const isDefaultAdmin = firebaseUser.email === 'admin@hospital.com';
                
                // 準備預設資料
                userData = {
                    email: firebaseUser.email,
                    displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
                    role: isDefaultAdmin ? 'admin' : 'viewer', // 自動給予權限
                    unit_id: 'default',
                    unit_name: '預設單位',
                    permissions: {
                        // 預設給予基本查看權限
                        can_view_schedule: true,
                        can_export_data: isDefaultAdmin
                    },
                    created_at: window.firebase.firestore.FieldValue.serverTimestamp(),
                    last_login: window.firebase.firestore.FieldValue.serverTimestamp()
                };

                // 將新資料寫入 Firestore
                await userRef.set(userData);
                console.log('[Auth] 預設使用者資料已建立');

            } else {
                // 資料存在，直接讀取
                userData = userDoc.data();
                
                // 更新最後登入時間
                await userRef.update({ 
                    last_login: window.firebase.firestore.FieldValue.serverTimestamp() 
                });
            }

            // 組合最終回傳的物件
            const user = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: userData.displayName || firebaseUser.displayName,
                role: userData.role,
                unit_id: userData.unit_id,
                unit_name: userData.unit_name,
                permissions: userData.permissions || {},
                createdAt: userData.created_at, // 注意：剛建立時這可能是 serverTimestamp 物件，下次讀取才會是時間
                lastLogin: new Date().toISOString()
            };
            
            this.currentUser = user;
            Storage.saveUser(user);
            this.notifyAuthStateChanged();
            
            return user;
            
        } catch (error) {
            console.error('[Auth] 載入使用者資料失敗:', error);
            throw error;
        }
    },
    
    // ==================== 登出 ====================
    
    async logout() {
        console.log('[Auth] 使用者登出');
        try {
            if (window.firebase && !FIREBASE_CONFIG.demo?.enabled) {
                await window.firebase.auth().signOut();
            }
            
            this.currentUser = null;
            Storage.removeUser();
            // Storage.removeToken(); // Token 暫時不需手動移除，依賴 Storage 管理
            
            this.notifyAuthStateChanged();
            
            if (!window.location.pathname.includes('login.html')) {
                window.location.href = 'login.html';
            }
            
        } catch (error) {
            console.error('[Auth] 登出失敗:', error);
            throw error;
        }
    },
    
    // ==================== 使用者資訊 ====================
    
    getCurrentUser() {
        return this.currentUser;
    },
    
    isAuthenticated() {
        return this.currentUser !== null;
    },
    
    getUserRole() {
        return this.currentUser ? this.currentUser.role : null;
    },
    
    getUserUnit() {
        if (!this.currentUser) return null;
        return {
            id: this.currentUser.unit_id,
            name: this.currentUser.unit_name
        };
    },
    
    // ==================== 權限檢查 ====================
    
    isAdmin() {
        return this.currentUser?.role === CONSTANTS.ROLES?.ADMIN;
    },
    
    isScheduler() {
        return this.currentUser?.role === CONSTANTS.ROLES?.SCHEDULER;
    },
    
    isViewer() {
        return this.currentUser?.role === CONSTANTS.ROLES?.VIEWER;
    },
    
    hasPermission(permission) {
        if (!this.currentUser) return false;
        if (this.isAdmin()) return true;
        return this.currentUser.permissions?.[permission] === true;
    },
    
    hasAllPermissions(permissions) {
        return permissions.every(p => this.hasPermission(p));
    },
    
    hasAnyPermission(permissions) {
        return permissions.some(p => this.hasPermission(p));
    },
    
    requirePermission(permissions) {
        const perms = Array.isArray(permissions) ? permissions : [permissions];
        if (!this.hasAllPermissions(perms)) {
            throw new Error('您沒有權限執行此操作');
        }
    },
    
    // ==================== 認證狀態監聽 ====================
    
    onAuthStateChanged(callback) {
        this.authStateChangedCallbacks.push(callback);
        if (this.currentUser) {
            callback(this.currentUser);
        }
    },
    
    notifyAuthStateChanged() {
        this.authStateChangedCallbacks.forEach(callback => {
            try {
                callback(this.currentUser);
            } catch (error) {
                console.error('[Auth] 回調錯誤:', error);
            }
        });
    },
    
    // ==================== 錯誤處理 ====================
    
    handleAuthError(error) {
        const errorMessages = {
            'auth/user-not-found': '帳號不存在',
            'auth/wrong-password': '密碼錯誤',
            'auth/email-already-in-use': '此電子郵件已被使用',
            'auth/weak-password': '密碼強度不足 (至少 6 個字元)',
            'auth/invalid-email': '電子郵件格式錯誤',
            'auth/user-disabled': '此帳號已被停用',
            'auth/too-many-requests': '嘗試次數過多，請稍後再試',
            'auth/network-request-failed': '網路連線錯誤'
        };
        
        const message = errorMessages[error.code] || error.message || '登入失敗';
        return new Error(message);
    },
    
    // ==================== 輔助方法 ====================
    
    requireAuth() {
        if (!this.isAuthenticated()) {
            console.log('[Auth] 未登入，導向登入頁');
            if (!window.location.pathname.includes('login.html')) {
                window.location.href = 'login.html';
            }
        }
    },
    
    requireRole(roles) {
        const roleList = Array.isArray(roles) ? roles : [roles];
        const userRole = this.getUserRole();
        
        if (!roleList.includes(userRole)) {
            throw new Error('您沒有權限存取此功能');
        }
    },
    
    async updateUser(updates) {
        if (!this.currentUser) {
            throw new Error('未登入');
        }
        
        try {
            this.currentUser = { ...this.currentUser, ...updates };
            Storage.saveUser(this.currentUser);
            
            if (!FIREBASE_CONFIG.demo?.enabled && window.firebase) {
                await window.firebase.firestore()
                    .collection(FIREBASE_CONFIG.collections.USERS)
                    .doc(this.currentUser.uid)
                    .update(updates);
            }
            
            this.notifyAuthStateChanged();
            console.log('[Auth] 使用者資料已更新');
            
        } catch (error) {
            console.error('[Auth] 更新使用者資料失敗:', error);
            throw error;
        }
    }
};