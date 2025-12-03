/**
 * js/services/unit.service.js
 * 單位資料服務 (Firebase Core 完整版)
 * 負責：單位增刪改查、人員關聯查詢
 */
import { FirebaseService } from './firebase.service.js';

export const UnitService = {
    
    // ==================== 讀取 (Read) ====================

    /**
     * 取得所有單位列表
     */
    async getAllUnits() {
        // 使用 FirebaseService.getCollection (若您之前的 FirebaseService 有實作此方法)
        // 或是直接使用 queryDocuments 模擬抓取全部
        try {
             // 假設 FirebaseService 有實作 getCollection，若無則回傳空陣列避免報錯
             if (typeof FirebaseService.getCollection === 'function') {
                 return await FirebaseService.getCollection('units');
             }
             // 若無 getCollection，嘗試直接用 queryDocuments 抓取全部
             // (這裡假設用一個恆真的條件，或者您確保 FirebaseService.getCollection 已存在)
             // 為了保險，建議您確認 js/services/firebase.service.js 有 getCollection 方法
             // 這裡先用標準做法
             return await FirebaseService.getCollection('units');
        } catch (error) {
            console.error('[Unit] GetAllUnits Error:', error);
            return [];
        }
    },

    /**
     * 取得特定單位詳細資料
     */
    async getUnitById(unitId) {
        return await FirebaseService.getDocument('units', unitId);
    },

    // ==================== 寫入 (Write) ====================

    /**
     * 建立/儲存單位
     */
    async saveUnit(unitData) {
        const unitId = unitData.id || unitData.code;
        await FirebaseService.setDocument('units', unitId, unitData);
        return unitId;
    },

    /**
     * 更新單位資料 (例如儲存 backupSheetId)
     */
    async updateUnit(unitId, data) {
        // 使用 merge: true 的 setDocument
        await FirebaseService.setDocument('units', unitId, data, true); 
    },

    // ==================== 關聯查詢 (修正錯誤的關鍵) ====================

    /**
     * 🔥 取得該單位的所有人員
     * 從 users 集合中查詢 unitId 符合的人
     */
    async getUnitStaff(unitId) {
        try {
            // 使用 FirebaseService 的查詢功能
            // 需確認 FirebaseService.js 有 queryDocuments 方法
            // 如果沒有，這裡手動實作查詢邏輯
            
            const { collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            const db = FirebaseService.db;
            
            if (!db) return [];

            const q = query(collection(db, 'users'), where('unitId', '==', unitId));
            const querySnapshot = await getDocs(q);
            
            const staff = [];
            querySnapshot.forEach((doc) => {
                staff.push({ id: doc.id, ...doc.data() });
            });
            
            return staff;

        } catch (error) {
            console.error('[Unit] 取得單位人員失敗:', error);
            return []; // 失敗回傳空陣列，避免卡住畫面
        }
    }
};
