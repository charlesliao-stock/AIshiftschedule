/**
 * 認證管理
 * 處理使用者登入、登出、權限檢查
 */

const Auth = {
    currentUser: null,
    authStateChangedCallbacks: [],
    
    // ==================== 初始化 ====================
    
    /**
     * 初始化認證系統
     */
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
        if (FIREBASE_CONFIG.demo.enabled === false && window.firebase) {
            firebase.auth().onAuthStateChanged(async (firebaseUser) => {
                if (firebaseUser) {
                    await this.loadUserFromFirebase(firebaseUser);
                } else {
                    this.currentUser = null;
                    Storage.removeUser();
                    this.notifyAuthStateChanged();
                }
            });
        }
    },
    
    // ==================== 登入 ====================
    
    /**
     * 使用者登入
     * @param {string} email - 電子郵件
     * @param {string} password - 密碼
     * @returns {Promise<Object>} 使用者物件
     */
    async login(email, password) {
        console.log('[Auth] 嘗試登入:', email);
        
        try {
            // Demo 模式
            if (FIREBASE_CONFIG.demo.enabled) {
                return await this.loginDemo(email, password);
            }
            
            // Firebase 認證
            if (window.firebase) {
                const userCredential = await firebase.auth()
                    .signInWithEmailAndPassword(email, password);
                return await this.loadUserFromFirebase(userCredential.user);
            }
            
            throw new Error('認證服務未初始化');
            
        } catch (error) {
            console.error('[Auth] 登入失敗:', error);
            throw this.handleAuthError(error);
        }
    },
    
    /**
     * Demo 模式登入
     * @param {string} email - 電子郵件
     * @param {string} password - 密碼
     * @returns {Promise<Object>}
     */
    async loginDemo(email, password) {
        // 模擬網路延遲
        await Utils.sleep(800);
        
        // 查找 Demo 使用者
        const demoUser = FIREBASE_CONFIG.demo.users.find(
            u => u.email.toLowerCase() === email.toLowerCase()
        );
        
        if (!demoUser) {
            throw new Error('帳號不存在');
        }
        
        // Demo 模式不檢查密碼，任何密碼都可以
        // 實際使用時會檢查
        
        // 建立使用者物件
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
        
        // 儲存到本地
        this.currentUser = user;
        Storage.saveUser(user);
        
        // 通知狀態變化
        this.notifyAuthStateChanged();
        
        console.log('[Auth] Demo 登入成功:', user.email);
        return user;
    },
    
    /**
     * 從 Firebase 載入使用者資料
     * @param {Object} firebaseUser - Firebase 使用者
     * @returns {Promise<Object>}
     */
    async loadUserFromFirebase(firebaseUser) {
        try {
            // 從 Firestore 取得完整使用者資料
            const userDoc = await firebase.firestore()
                .collection(FIREBASE_CONFIG.collections.USERS)
                .doc(firebaseUser.uid)
                .get();
            
            if (!userDoc.exists) {
                throw new Error('使用者資料不存在');
            }
            
            const userData = userDoc.data();
            const user = {
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: userData.displayName || firebaseUser.displayName,
                role: userData.role,
                unit_id: userData.unit_id,
                unit_name: userData.unit_name,
                permissions: userData.permissions,
                createdAt: userData.created_at,
                lastLogin: new Date().toISOString()
            };
            
            // 更新最後登入時間
            await firebase.firestore()
                .collection(FIREBASE_CONFIG.collections.USERS)
                .doc(firebaseUser.uid)
                .update({ last_login: firebase.firestore.FieldValue.serverTimestamp() });
            
            // 儲存到本地
            this.currentUser = user;
            Storage.saveUser(user);
            
            // 通知狀態變化
            this.notifyAuthStateChanged();
            
            console.log('[Auth] Firebase 登入成功:', user.email);
            return user;
            
        } catch (error) {
            console.error('[Auth] 載入使用者資料失敗:', error);
            throw error;
        }
    },
    
    // ==================== 登出 ====================
    
    /**
     * 使用者登出
     */
    async logout() {
        console.log('[Auth] 使用者登出');
        
        try {
            // Firebase 登出
            if (window.firebase && !FIREBASE_CONFIG.demo.enabled) {
                await firebase.auth().signOut();
            }
            
            // 清除本地資料
            this.currentUser = null;
            Storage.removeUser();
            Storage.removeToken();
            
            // 通知狀態變化
            this.notifyAuthStateChanged();
            
            // 導向登入頁
            window.location.href = 'login.html';
            
        } catch (error) {
            console.error('[Auth] 登出失敗:', error);
            throw error;
        }
    },
    
    // ==================== 使用者資訊 ====================
    
    /**
     * 取得當前使用者
     * @returns {Object|null}
     */
    getCurrentUser() {
        return this.currentUser;
    },
    
    /**
     * 檢查是否已登入
     * @returns {boolean}
     */
    isAuthenticated() {
        return this.currentUser !== null;
    },
    
    /**
     * 取得使用者角色
     * @returns {string|null}
     */
    getUserRole() {
        return this.currentUser ? this.currentUser.role : null;
    },
    
    /**
     * 取得使用者單位
     * @returns {Object|null}
     */
    getUserUnit() {
        if (!this.currentUser) return null;
        return {
            id: this.currentUser.unit_id,
            name: this.currentUser.unit_name
        };
    },
    
    // ==================== 權限檢查 ====================
    
    /**
     * 檢查是否為管理者
     * @returns {boolean}
     */
    isAdmin() {
        return this.currentUser?.role === CONSTANTS.ROLES.ADMIN;
    },
    
    /**
     * 檢查是否為排班者
     * @returns {boolean}
     */
    isScheduler() {
        return this.currentUser?.role === CONSTANTS.ROLES.SCHEDULER;
    },
    
    /**
     * 檢查是否為一般使用者
     * @returns {boolean}
     */
    isViewer() {
        return this.currentUser?.role === CONSTANTS.ROLES.VIEWER;
    },
    
    /**
     * 檢查是否有特定權限
     * @param {string} permission - 權限名稱
     * @returns {boolean}
     */
    hasPermission(permission) {
        if (!this.currentUser) return false;
        
        // 管理者擁有所有權限
        if (this.isAdmin()) return true;
        
        // 檢查使用者的權限
        return this.currentUser.permissions?.[permission] === true;
    },
    
    /**
     * 檢查是否有多個權限 (需全部符合)
     * @param {Array<string>} permissions - 權限陣列
     * @returns {boolean}
     */
    hasAllPermissions(permissions) {
        return permissions.every(p => this.hasPermission(p));
    },
    
    /**
     * 檢查是否有任一權限
     * @param {Array<string>} permissions - 權限陣列
     * @returns {boolean}
     */
    hasAnyPermission(permissions) {
        return permissions.some(p => this.hasPermission(p));
    },
    
    /**
     * 要求特定權限 (沒有權限則拋出錯誤)
     * @param {string|Array<string>} permissions - 權限
     * @throws {Error}
     */
    requirePermission(permissions) {
        const perms = Array.isArray(permissions) ? permissions : [permissions];
        
        if (!this.hasAllPermissions(perms)) {
            throw new Error('您沒有權限執行此操作');
        }
    },
    
    // ==================== 認證狀態監聽 ====================
    
    /**
     * 監聽認證狀態變化
     * @param {Function} callback - 回調函式
     */
    onAuthStateChanged(callback) {
        this.authStateChangedCallbacks.push(callback);
        
        // 立即執行一次 (如果已有使用者)
        if (this.currentUser) {
            callback(this.currentUser);
        }
    },
    
    /**
     * 通知所有監聽器認證狀態已變化
     */
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
    
    /**
     * 處理認證錯誤
     * @param {Error} error - 錯誤物件
     * @returns {Error}
     */
    handleAuthError(error) {
        // Firebase 錯誤代碼對應
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
    
    /**
     * 要求已登入 (未登入則導向登入頁)
     */
    requireAuth() {
        if (!this.isAuthenticated()) {
            console.log('[Auth] 未登入，導向登入頁');
            window.location.href = 'login.html';
        }
    },
    
    /**
     * 要求特定角色
     * @param {string|Array<string>} roles - 角色
     * @throws {Error}
     */
    requireRole(roles) {
        const roleList = Array.isArray(roles) ? roles : [roles];
        const userRole = this.getUserRole();
        
        if (!roleList.includes(userRole)) {
            throw new Error('您沒有權限存取此功能');
        }
    },
    
    /**
     * 更新使用者資料
     * @param {Object} updates - 更新的資料
     */
    async updateUser(updates) {
        if (!this.currentUser) {
            throw new Error('未登入');
        }
        
        try {
            // 更新本地資料
            this.currentUser = { ...this.currentUser, ...updates };
            Storage.saveUser(this.currentUser);
            
            // 更新 Firebase (如果不是 Demo 模式)
            if (!FIREBASE_CONFIG.demo.enabled && window.firebase) {
                await firebase.firestore()
                    .collection(FIREBASE_CONFIG.collections.USERS)
                    .doc(this.currentUser.uid)
                    .update(updates);
            }
            
            // 通知狀態變化
            this.notifyAuthStateChanged();
            
            console.log('[Auth] 使用者資料已更新');
            
        } catch (error) {
            console.error('[Auth] 更新使用者資料失敗:', error);
            throw error;
        }
    }
};

// 讓認證管理可在全域使用
if (typeof window !== 'undefined') {
    window.Auth = Auth;
}