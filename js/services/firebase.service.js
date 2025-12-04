/**
 * js/services/firebase.service.js
 * Firebase 核心服務 (完整版)
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
            try { await enableIndexedDbPersistence(db); } catch (e) { /* 忽略 */ }
            this.initialized = true;
            console.log('[Firebase] 初始化完成');
        } catch (error) {
            console.error('[Firebase] 初始化失敗:', error);
        }
    },

    get db() { return db; },
    get auth() { return auth; },

    // --- CRUD ---
    async getDocument(collectionName, docId) {
        if (!db) return null;
        try {
            const docSnap = await getDoc(doc(db, collectionName, docId));
            return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
        } catch (error) {
            console.error(`[Firebase] Get ${collectionName}/${docId} Error:`, error);
            return null;
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
            return [];
        }
    },
    
    async queryDocuments(collectionName, field, op, value) {
        if (!db) return [];
        try {
            const q = query(collection(db, collectionName), where(field, op, value));
            const snap = await getDocs(q);
            const results = [];
            snap.forEach(doc => results.push({ id: doc.id, ...doc.data() }));
            return results;
        } catch (e) {
            console.error(`[Firebase] Query Error:`, e);
            return [];
        }
    },

    async setDocument(collectionName, docId, data, merge = true) {
        if (!db) throw new Error("DB Offline");
        const payload = { ...data, updated_at: serverTimestamp() };
        if (!data.created_at) payload.created_at = serverTimestamp();
        await setDoc(doc(db, collectionName, docId), payload, { merge });
        return docId;
    },
    
    async addDocument(collectionName, data) {
         if (!db) throw new Error("DB Offline");
         const payload = { ...data, created_at: serverTimestamp(), updated_at: serverTimestamp() };
         const ref = await addDoc(collection(db, collectionName), payload);
         return ref.id;
    }
};
