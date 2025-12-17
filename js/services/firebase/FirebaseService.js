// 引用剛才修正的設定檔
import { db, auth } from "../../config/firebase.config.js";

class FirebaseService {
    constructor() {
        // 直接使用從設定檔匯入的實體
        this.db = db;
        this.auth = auth;
        
        // 檢查是否成功取得
        this.isInitialized = !!(this.db && this.auth);
        
        if (this.isInitialized) {
            console.log("✅ FirebaseService Loaded (Shared Instance)");
        } else {
            console.error("❌ FirebaseService Error: DB or Auth is missing/undefined. Check firebase.config.js");
        }
    }

    /**
     * 初始化 Firebase (兼容舊代碼用，實際上 config 已完成初始化)
     */
    init() {
        if (!this.isInitialized) {
            console.warn("FirebaseService.init() called but instances are missing.");
        }
        return;
    }

    /**
     * 取得 Firestore 資料庫實體
     */
    getDb() {
        if (!this.db) {
            console.error("Attempted to access uninitialized DB");
            return db; // 嘗試回傳原始匯入
        }
        return this.db;
    }

    /**
     * 取得 Auth 驗證實體
     */
    getAuth() {
        if (!this.auth) {
            console.error("Attempted to access uninitialized Auth");
            return auth; // 嘗試回傳原始匯入
        }
        return this.auth;
    }
}

// 匯出單例
export const firebaseService = new FirebaseService();
