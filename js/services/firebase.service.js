/**
 * js/services/firebase.service.js
 * Firebase 服務 (ES Module 版)
 */

import { FIREBASE_CONFIG } from '../config/firebase.config.js';
import { Utils } from '../core/utils.js';

export const FirebaseService = {
    initialized: false,
    app: null,
    auth: null,
    firestore: null,
    
    async init() {
        if (this.initialized) return;
        console.log('[Firebase] 初始化...');
        
        // Demo 模式跳過
        if (FIREBASE_CONFIG.demo?.enabled) {
            console.log('[Firebase] Demo 模式啟用');
            this.initialized = true;
            return;
        }
        
        if (!window.firebase) throw new Error('Firebase SDK 未載入');
        
        try {
            // 使用 config.config 因為您的結構是 FIREBASE_CONFIG.config
            this.app = window.firebase.initializeApp(FIREBASE_CONFIG.config);
            this.auth = window.firebase.auth();
            this.firestore = window.firebase.firestore();
            
            // 嘗試啟用離線持久化 (非必須)
            try {
                await this.firestore.enablePersistence();
            } catch (err) {
                console.warn('[Firebase] 離線持久化未啟用:', err.code);
            }
            
            this.initialized = true;
            console.log('[Firebase] 初始化完成');
        } catch (error) {
            console.error('[Firebase] 初始化失敗:', error);
            // 不拋出錯誤，避免阻擋 App 載入
        }
    },
    
    // ==================== Firestore 操作 ====================
    
    async getDocument(collection, docId) {
        if (!this.initialized || FIREBASE_CONFIG.demo?.enabled) return null;
        try {
            const doc = await this.firestore.collection(collection).doc(docId).get();
            return doc.exists ? { id: doc.id, ...doc.data() } : null;
        } catch (error) {
            console.error('[Firebase] 取得文件失敗:', error);
            throw error;
        }
    },
    
    async addDocument(collection, data, docId = null) {
        if (!this.initialized || FIREBASE_CONFIG.demo?.enabled) return 'demo_id';
        try {
            const timestamp = window.firebase.firestore.FieldValue.serverTimestamp();
            const payload = { ...data, created_at: timestamp, updated_at: timestamp };
            
            if (docId) {
                await this.firestore.collection(collection).doc(docId).set(payload);
                return docId;
            } else {
                const docRef = await this.firestore.collection(collection).add(payload);
                return docRef.id;
            }
        } catch (error) {
            console.error('[Firebase] 新增文件失敗:', error);
            throw error;
        }
    },
    
    async updateDocument(collection, docId, data) {
        if (!this.initialized || FIREBASE_CONFIG.demo?.enabled) return;
        try {
            const timestamp = window.firebase.firestore.FieldValue.serverTimestamp();
            await this.firestore.collection(collection).doc(docId).update({
                ...data,
                updated_at: timestamp
            });
        } catch (error) {
            console.error('[Firebase] 更新文件失敗:', error);
            throw error;
        }
    }
    // ... 其他方法可依此類推
};