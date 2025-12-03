/**
 * js/services/firebase.service.js
 * Firebase 核心服務 (v2.0 Firebase First 架構)
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getFirestore, collection, doc, getDoc, getDocs, 
    addDoc, setDoc, updateDoc, query, where, 
    serverTimestamp, enableIndexedDbPersistence 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { FIREBASE_CONFIG } from '../config/firebase.config.js';

let app = null;
let db = null;
let auth = null;

export const FirebaseService = {
    initialized: false,

    async init() {
        if (this.initialized) return;
        try {
            console.log('[Firebase] 初始化...');
            app = initializeApp(FIREBASE_CONFIG.config || FIREBASE_CONFIG);
            db = getFirestore(app);
            auth = getAuth(app);
            
            // 嘗試啟用離線快取
            try { await enableIndexedDbPersistence(db); } catch (e) { /* 忽略環境不支援錯誤 */ }
            
            this.initialized = true;
            console.log('[Firebase] 初始化完成');
        } catch (error) {
            console.error('[Firebase] 初始化失敗:', error);
        }
    },

    get db() { return db; },
    get auth() { return auth; },

    // --- 通用 CRUD 封裝 (含錯誤處理) ---

    async getDocument(collectionName, docId) {
        if (!db) return null;
        try {
            const docSnap = await getDoc(doc(db, collectionName, docId));
            return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
        } catch (error) {
            console.error(`[Firebase] Get ${collectionName}/${docId} Error:`, error);
            return null; // UX: 失敗回傳 null 而不是 throw
        }
    },

    async getCollection(collectionName) {
        if (!db) return [];
        try {
            const querySnapshot = await getDocs(collection(db, collectionName));
            const results = [];
            querySnapshot.forEach(doc => results.push({ id: doc.id, ...doc.data() }));
            return results;
        } catch (error) {
            console.error(`[Firebase] Get Collection ${collectionName} Error:`, error);
            return []; // UX: 失敗回傳空陣列
        }
    },

    async setDocument(collectionName, docId, data, merge = true) {
        if (!db) throw new Error("DB Offline");
        const payload = { ...data, updated_at: serverTimestamp() };
        if (!data.created_at) payload.created_at = serverTimestamp();
        
        await setDoc(doc(db, collectionName, docId), payload, { merge });
        return docId;
    }
};
