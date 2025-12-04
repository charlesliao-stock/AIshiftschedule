/**
 * js/services/settings.service.js
 * 系統設定服務 (Firestore 重構版)
 * 負責：班別、組別、人員、規則的 CRUD
 */
import { FirebaseService } from './firebase.service.js';
import { Auth } from '../core/auth.js';
import { 
    collection, doc, runTransaction, writeBatch 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 定義集合路徑 (根據架構設計)
const PATHS = {
    GLOBAL_SETTINGS: 'system_config', // 存放全域預設值
    UNITS: 'units',                   // 存放單位特定設定
    STAFF: 'users'                    // 人員資料統一放在 users 集合
};

export const SettingsService = {
    
    // ==================== 班別設定 (Shifts) ====================
    
    /**
     * 取得班別設定 (優先讀取單位設定，若無則讀取系統預設)
     */
    async getShifts(unitId = null) {
        try {
            // 如果有指定單位，先嘗試讀取單位的設定
            if (unitId) {
                const unitDoc = await FirebaseService.getDocument(PATHS.UNITS, unitId);
                if (unitDoc && unitDoc.settings && unitDoc.settings.shifts) {
                    return unitDoc.settings.shifts;
                }
            }
            
            // 讀取全域預設值
            const globalDoc = await FirebaseService.getDocument(PATHS.GLOBAL_SETTINGS, 'default_settings');
            return globalDoc?.shifts || [];
        } catch (error) {
            console.error('[Settings] 取得班別失敗:', error);
            return [];
        }
    },

    async saveShifts(shifts, unitId = null) {
        if (!Auth.isManager()) throw new Error('權限不足');
        try {
            if (unitId) {
                // 儲存至單位設定
                await FirebaseService.setDocument(PATHS.UNITS, unitId, {
                    settings: { shifts: shifts }
                }, true);
            } else {
                // 儲存至全域預設
                await FirebaseService.setDocument(PATHS.GLOBAL_SETTINGS, 'default_settings', {
                    shifts: shifts
                }, true);
            }
            return true;
        } catch (error) {
            console.error('[Settings] 儲存班別失敗:', error);
            throw error;
        }
    },

    // ==================== 人員設定 (Staff / Users) ====================
    
    /**
     * 取得某單位的人員列表
     */
    async getStaff(unitId) {
        try {
            // 使用 query 查詢 unitId 符合的使用者
            // 需依賴 FirebaseService 的底層 db 進行 query
            const { query, where, getDocs, collection } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            const db = FirebaseService.db;
            
            const q = query(collection(db, PATHS.STAFF), where('unitId', '==', unitId));
            const snapshot = await getDocs(q);
            
            const staff = [];
            snapshot.forEach(doc => staff.push({ id: doc.id, ...doc.data() }));
            return staff;
        } catch (error) {
            console.error('[Settings] 取得人員失敗:', error);
            return [];
        }
    },

    async saveStaff(staffData) {
        if (!Auth.isManager()) throw new Error('權限不足');
        try {
            // 若有 ID 則更新，無 ID 則新增
            const id = staffData.id || staffData.employeeId; // 優先使用現有 ID 或員工編號
            await FirebaseService.setDocument(PATHS.STAFF, id, staffData, true);
        } catch (error) {
            console.error('[Settings] 儲存人員失敗:', error);
            throw error;
        }
    },

    /**
     * 批次匯入人員
     */
    async batchSaveStaff(staffList, unitId) {
        if (!Auth.isManager()) throw new Error('權限不足');
        const db = FirebaseService.db;
        
        try {
            const batch = writeBatch(db);
            
            staffList.forEach(staff => {
                // 確保有關聯到單位
                const data = { ...staff, unitId: unitId };
                // 使用員工編號作為 Document ID (若無則自動產生)
                const docRef = doc(db, PATHS.STAFF, staff.employeeId || FirebaseService.generateId()); 
                batch.set(docRef, data, { merge: true });
            });

            await batch.commit();
            console.log(`[Settings] 成功匯入 ${staffList.length} 筆人員資料`);
        } catch (error) {
            console.error('[Settings] 批次匯入失敗:', error);
            throw error;
        }
    },
    
    async deleteStaff(staffId) {
         if (!Auth.isManager()) throw new Error('權限不足');
         // 這裡需要實作刪除邏輯，或是將狀態改為 inactive
         await FirebaseService.setDocument(PATHS.STAFF, staffId, { status: 'inactive' }, true);
    }

    // ==================== 規則與組別 (簡化版) ====================
    // ... 組別 (Groups) 與 規則 (Rules) 的邏輯與 Shifts 類似，
    // 皆需判斷是儲存到 units/{id}/settings 還是 system_config/default_settings
};
