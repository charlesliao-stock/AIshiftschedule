/**
 * js/services/firebase.service.js
 * Firebase 核心服務 (ES Module / Modular SDK v10.7.1)
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
    serverTimestamp,
    enableIndexedDbPersistence 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { FIREBASE_CONFIG } from '../config/firebase.config.js';

// 私有變數，避免全域汙染
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
        
        // Demo 模式檢查
        if (FIREBASE_CONFIG.demo?.enabled) {
            console.log('[Firebase] Demo 模式啟用 (Mock)');
            this.initialized = true;
            return;
        }

        try {
            console.log('[Firebase] 初始化...');
            
            // 1. 初始化 App
            app = initializeApp(FIREBASE_CONFIG.config || FIREBASE_CONFIG);
            
            // 2. 初始化 Firestore
            db = getFirestore(app);
            
            // 3. 初始化 Auth
            auth = getAuth(app);

            // 4. 嘗試啟用離線持久化 (選擇性)
            try {
                // 注意: enableIndexedDbPersistence 在某些新版 SDK 已被棄用，改用 initializeFirestore 設定 cache
                // 但為了相容性，若不報錯則保留
                await enableIndexedDbPersistence(db).catch(err => {
                    if (err.code == 'failed-precondition') {
                         console.warn('[Firebase] 多個分頁開啟，無法啟用持久化');
                    } else if (err.code == 'unimplemented') {
                         console.warn('[Firebase] 瀏覽器不支援持久化');
                    }
                });
            } catch (e) {
                // 忽略持久化錯誤
            }
            
            this.initialized = true;
            console.log('[Firebase] 初始化完成');

        } catch (error) {
            console.error('[Firebase] 初始化失敗:', error);
            throw error;
        }
    },

    /**
     * 公開資料庫實體 (Getter)
     * 這是 config.service.js 能夠運作的關鍵
     */
    get db() {
        if (!db && !this.initialized) {
            console.warn('[Firebase] 警告：嘗試在初始化前存取 DB');
        }
        return db;
    },

    /**
     * 公開 Auth 實體
     */
    get auth() {
        return auth;
    },
    
    // ==================== Firestore 通用操作封裝 (Modular Syntax) ====================
    
    /**
     * 取得單一文件
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
     * 新增文件 (自動 ID 或指定 ID)
     */
    async addDocument(collectionName, data, docId = null) {
        if (!this.initialized || !db) return 'offline_id';
        try {
            // 加入時間戳記
            const payload = { 
                ...data, 
                created_at: serverTimestamp(), 
                updated_at: serverTimestamp() 
            };
            
            if (docId) {
                // 指定 ID: 使用 setDoc
                const docRef = doc(db, collectionName, docId);
                await setDoc(docRef, payload);
                return docId;
            } else {
                // 自動 ID: 使用 addDoc
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
    }
};
