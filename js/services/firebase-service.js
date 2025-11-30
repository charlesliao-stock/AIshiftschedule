/**
 * Firebase 服務
 * 初始化 Firebase 並提供基礎服務
 */

const FirebaseService = {
    initialized: false,
    app: null,
    auth: null,
    firestore: null,
    
    // ==================== 初始化 ====================
    
    /**
     * 初始化 Firebase
     */
    async init() {
        if (this.initialized) {
            console.log('[Firebase] 已經初始化');
            return;
        }
        
        console.log('[Firebase] 初始化 Firebase...');
        
        try {
            // Demo 模式
            if (FIREBASE_CONFIG.demo.enabled) {
                console.log('[Firebase] Demo 模式啟用，跳過 Firebase 初始化');
                this.initialized = true;
                return;
            }
            
            // 檢查 Firebase SDK
            if (!window.firebase) {
                throw new Error('Firebase SDK 未載入');
            }
            
            // 初始化 Firebase App
            this.app = firebase.initializeApp(FIREBASE_CONFIG.config);
            
            // 取得服務實例
            this.auth = firebase.auth();
            this.firestore = firebase.firestore();
            
            // 設定 Firestore 持久化
            this.firestore.enablePersistence()
                .catch((err) => {
                    if (err.code === 'failed-precondition') {
                        console.warn('[Firebase] 多個分頁開啟，無法啟用離線持久化');
                    } else if (err.code === 'unimplemented') {
                        console.warn('[Firebase] 瀏覽器不支援離線持久化');
                    }
                });
            
            this.initialized = true;
            console.log('[Firebase] 初始化完成');
            
        } catch (error) {
            console.error('[Firebase] 初始化失敗:', error);
            throw error;
        }
    },
    
    // ==================== Firestore 操作 ====================
    
    /**
     * 取得文件
     * @param {string} collection - 集合名稱
     * @param {string} docId - 文件 ID
     * @returns {Promise<Object|null>}
     */
    async getDocument(collection, docId) {
        if (!this.initialized || FIREBASE_CONFIG.demo.enabled) {
            console.warn('[Firebase] Demo 模式或未初始化');
            return null;
        }
        
        try {
            const doc = await this.firestore
                .collection(collection)
                .doc(docId)
                .get();
            
            if (!doc.exists) {
                return null;
            }
            
            return {
                id: doc.id,
                ...doc.data()
            };
        } catch (error) {
            console.error('[Firebase] 取得文件失敗:', error);
            throw error;
        }
    },
    
    /**
     * 新增文件
     * @param {string} collection - 集合名稱
     * @param {Object} data - 資料
     * @param {string} docId - 文件 ID (選填)
     * @returns {Promise<string>} 文件 ID
     */
    async addDocument(collection, data, docId = null) {
        if (!this.initialized || FIREBASE_CONFIG.demo.enabled) {
            console.warn('[Firebase] Demo 模式或未初始化');
            return 'demo_' + Utils.generateId();
        }
        
        try {
            const timestamp = firebase.firestore.FieldValue.serverTimestamp();
            const dataWithTimestamp = {
                ...data,
                created_at: timestamp,
                updated_at: timestamp
            };
            
            if (docId) {
                await this.firestore
                    .collection(collection)
                    .doc(docId)
                    .set(dataWithTimestamp);
                return docId;
            } else {
                const docRef = await this.firestore
                    .collection(collection)
                    .add(dataWithTimestamp);
                return docRef.id;
            }
        } catch (error) {
            console.error('[Firebase] 新增文件失敗:', error);
            throw error;
        }
    },
    
    /**
     * 更新文件
     * @param {string} collection - 集合名稱
     * @param {string} docId - 文件 ID
     * @param {Object} data - 更新的資料
     */
    async updateDocument(collection, docId, data) {
        if (!this.initialized || FIREBASE_CONFIG.demo.enabled) {
            console.warn('[Firebase] Demo 模式或未初始化');
            return;
        }
        
        try {
            const dataWithTimestamp = {
                ...data,
                updated_at: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            await this.firestore
                .collection(collection)
                .doc(docId)
                .update(dataWithTimestamp);
        } catch (error) {
            console.error('[Firebase] 更新文件失敗:', error);
            throw error;
        }
    },
    
    /**
     * 刪除文件
     * @param {string} collection - 集合名稱
     * @param {string} docId - 文件 ID
     */
    async deleteDocument(collection, docId) {
        if (!this.initialized || FIREBASE_CONFIG.demo.enabled) {
            console.warn('[Firebase] Demo 模式或未初始化');
            return;
        }
        
        try {
            await this.firestore
                .collection(collection)
                .doc(docId)
                .delete();
        } catch (error) {
            console.error('[Firebase] 刪除文件失敗:', error);
            throw error;
        }
    },
    
    /**
     * 查詢文件
     * @param {string} collection - 集合名稱
     * @param {Array} filters - 過濾條件 [[field, operator, value], ...]
     * @param {Object} options - 選項 { orderBy, limit }
     * @returns {Promise<Array>}
     */
    async queryDocuments(collection, filters = [], options = {}) {
        if (!this.initialized || FIREBASE_CONFIG.demo.enabled) {
            console.warn('[Firebase] Demo 模式或未初始化');
            return [];
        }
        
        try {
            let query = this.firestore.collection(collection);
            
            // 套用過濾條件
            filters.forEach(([field, operator, value]) => {
                query = query.where(field, operator, value);
            });
            
            // 套用排序
            if (options.orderBy) {
                const [field, direction = 'asc'] = Array.isArray(options.orderBy) 
                    ? options.orderBy 
                    : [options.orderBy];
                query = query.orderBy(field, direction);
            }
            
            // 套用限制
            if (options.limit) {
                query = query.limit(options.limit);
            }
            
            const snapshot = await query.get();
            
            return snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
        } catch (error) {
            console.error('[Firebase] 查詢文件失敗:', error);
            throw error;
        }
    },
    
    /**
     * 監聽文件變化
     * @param {string} collection - 集合名稱
     * @param {string} docId - 文件 ID
     * @param {Function} callback - 回調函式
     * @returns {Function} 取消監聽的函式
     */
    onDocumentChange(collection, docId, callback) {
        if (!this.initialized || FIREBASE_CONFIG.demo.enabled) {
            console.warn('[Firebase] Demo 模式或未初始化');
            return () => {};
        }
        
        try {
            return this.firestore
                .collection(collection)
                .doc(docId)
                .onSnapshot(doc => {
                    if (doc.exists) {
                        callback({
                            id: doc.id,
                            ...doc.data()
                        });
                    } else {
                        callback(null);
                    }
                }, error => {
                    console.error('[Firebase] 監聽錯誤:', error);
                });
        } catch (error) {
            console.error('[Firebase] 設定監聽失敗:', error);
            return () => {};
        }
    },
    
    /**
     * 監聽查詢變化
     * @param {string} collection - 集合名稱
     * @param {Array} filters - 過濾條件
     * @param {Function} callback - 回調函式
     * @returns {Function} 取消監聽的函式
     */
    onQueryChange(collection, filters = [], callback) {
        if (!this.initialized || FIREBASE_CONFIG.demo.enabled) {
            console.warn('[Firebase] Demo 模式或未初始化');
            return () => {};
        }
        
        try {
            let query = this.firestore.collection(collection);
            
            filters.forEach(([field, operator, value]) => {
                query = query.where(field, operator, value);
            });
            
            return query.onSnapshot(snapshot => {
                const docs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                callback(docs);
            }, error => {
                console.error('[Firebase] 監聽錯誤:', error);
            });
        } catch (error) {
            console.error('[Firebase] 設定監聽失敗:', error);
            return () => {};
        }
    },
    
    // ==================== 批次操作 ====================
    
    /**
     * 批次寫入
     * @param {Array} operations - 操作陣列
     * @returns {Promise}
     */
    async batchWrite(operations) {
        if (!this.initialized || FIREBASE_CONFIG.demo.enabled) {
            console.warn('[Firebase] Demo 模式或未初始化');
            return;
        }
        
        try {
            const batch = this.firestore.batch();
            
            operations.forEach(({ type, collection, docId, data }) => {
                const docRef = this.firestore.collection(collection).doc(docId);
                
                switch (type) {
                    case 'set':
                        batch.set(docRef, data);
                        break;
                    case 'update':
                        batch.update(docRef, data);
                        break;
                    case 'delete':
                        batch.delete(docRef);
                        break;
                }
            });
            
            await batch.commit();
        } catch (error) {
            console.error('[Firebase] 批次寫入失敗:', error);
            throw error;
        }
    },
    
    // ==================== 工具方法 ====================
    
    /**
     * 產生時間戳
     * @returns {Object} Firebase Timestamp
     */
    timestamp() {
        if (!this.initialized || FIREBASE_CONFIG.demo.enabled) {
            return new Date();
        }
        return firebase.firestore.FieldValue.serverTimestamp();
    },
    
    /**
     * 取得當前時間
     * @returns {Date}
     */
    now() {
        return new Date();
    },
    
    /**
     * 檢查是否已初始化
     * @returns {boolean}
     */
    isInitialized() {
        return this.initialized;
    }
};

// 讓 Firebase 服務可在全域使用
if (typeof window !== 'undefined') {
    window.FirebaseService = FirebaseService;
}