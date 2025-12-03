/**
 * js/services/firebase.service.js
 * Firebase 核心服務 (ES Module / Modular SDK v10.7.1)
 * 提供初始化、認證與 Firestore 資料庫操作封裝
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    getDoc, 
    addDoc, 
    setDoc, 
    updateDoc, 
    query,
    where,
    getDocs,
    serverTimestamp,
    enableIndexedDbPersistence 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { FIREBASE_CONFIG } from '../config/firebase.config.js';

// 模組層級變數 (Private)
let app = null;
let db = null;
let auth = null;

export const FirebaseService = {
    initialized: false,

    /**
     * 初始化 Firebase
     */
    async init() {
        if (this.initialized) return;
        
        // Demo 模式檢查 (若 config 中有開啟)
        if (FIREBASE_CONFIG.demo?.enabled) {
            console.log('[Firebase] Demo 模式啟用 (Mock)');
            this.initialized = true;
            return;
        }

        try {
            console.log('[Firebase] 初始化...');
            
            // 1. 初始化 App
            // 相容處理：檢查傳入的是 config 物件本身還是包含 config 屬性的物件
            const config = FIREBASE_CONFIG.config || FIREBASE_CONFIG;
            app = initializeApp(config);
            
            // 2. 初始化 Firestore
            db = getFirestore(app);
            
            // 3. 初始化 Auth
            auth = getAuth(app);

            // 4. 嘗試啟用離線持久化 (選擇性)
            // 注意: 在某些瀏覽器環境或多視窗下可能會失敗，失敗則忽略
            try {
                 await enableIndexedDbPersistence(db).catch((err) => {
                    if (err.code === 'failed-precondition') {
                        console.warn('[Firebase] 多個分頁開啟，無法啟用持久化');
                    } else if (err.code === 'unimplemented') {
                        console.warn('[Firebase] 瀏覽器不支援持久化');
                    }
                });
            } catch (e) {
                // 忽略錯誤
            }
            
            this.initialized = true;
            console.log('[Firebase] 初始化完成');

        } catch (error) {
            console.error('[Firebase] 初始化失敗:', error);
            // 這裡不拋出錯誤，避免阻擋整個 App 渲染，但功能會受限
        }
    },

    /**
     * 公開資料庫實體 (Getter) - 關鍵修正
     */
    get db() {
        if (!db && !this.initialized) {
            console.warn('[Firebase] 警告：嘗試在初始化前存取 DB');
        }
        return db;
    },

    /**
     * 公開 Auth 實體 (Getter)
     */
    get auth() {
        return auth;
    },
    
    // ==================== Firestore 操作封裝 (Modular Syntax) ====================
    // 這些方法是為了相容您原本系統中其他 Service 的呼叫方式
    
    /**
     * 取得單一文件
     * @param {string} collectionName 集合名稱
     * @param {string} docId 文件 ID
     */
    async getDocument(collectionName, docId) {
        if (!this.initialized || !db) return null;
        try {
            const docRef = doc(db, collectionName, docId);
            const docSnap = await getDoc(docRef);
            return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
        } catch (error) {
            console.error(`[Firebase] Get ${collectionName}/${docId} Error:`, error);
            throw error;
        }
    },
    
    /**
     * 新增文件
     * @param {string} collectionName 集合名稱
     * @param {object} data 資料
     * @param {string|null} docId 指定 ID (可選)
     */
    async addDocument(collectionName, data, docId = null) {
        if (!this.initialized || !db) return 'offline_id';
        try {
            // 加入標準時間戳記
            const payload = { 
                ...data, 
                created_at: serverTimestamp(), 
                updated_at: serverTimestamp() 
            };
            
            if (docId) {
                // 指定 ID 使用 setDoc
                const docRef = doc(db, collectionName, docId);
                await setDoc(docRef, payload);
                return docId;
            } else {
                // 自動 ID 使用 addDoc
                const colRef = collection(db, collectionName);
                const docRef = await addDoc(colRef, payload);
                return docRef.id;
            }
        } catch (error) {
            console.error(`[Firebase] Add to ${collectionName} Error:`, error);
            throw error;
        }
    },
    
    /**
     * 更新文件
     * @param {string} collectionName 集合名稱
     * @param {string} docId 文件 ID
     * @param {object} data 更新資料
     */
    async updateDocument(collectionName, docId, data) {
        if (!this.initialized || !db) return;
        try {
            const docRef = doc(db, collectionName, docId);
            await updateDoc(docRef, {
                ...data,
                updated_at: serverTimestamp()
            });
        } catch (error) {
            console.error(`[Firebase] Update ${collectionName}/${docId} Error:`, error);
            throw error;
        }
    },

    /**
     * 簡單查詢 (範例：查詢某個欄位等於某個值)
     */
    async queryDocuments(collectionName, field, operator, value) {
        if (!this.initialized || !db) return [];
        try {
            const q = query(collection(db, collectionName), where(field, operator, value));
            const querySnapshot = await getDocs(q);
            const results = [];
            querySnapshot.forEach((doc) => {
                results.push({ id: doc.id, ...doc.data() });
            });
            return results;
        } catch (error) {
            console.error(`[Firebase] Query ${collectionName} Error:`, error);
            throw error;
        }
    }
};
