/**
 * js/services/settings.service.js
 * 系統設定服務 (Firestore 重構版 - 最終修正版)
 */
import { FirebaseService } from './firebase.service.js';
import { Auth } from '../core/auth.js';
import { 
    collection, doc, runTransaction, writeBatch 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const PATHS = {
    GLOBAL_SETTINGS: 'system_config',
    UNITS: 'units',
    STAFF: 'users'
};

export const SettingsService = {
    
    // ==================== 班別設定 ====================
    
    async getShifts(unitId = null) {
        try {
            if (unitId) {
                const unitDoc = await FirebaseService.getDocument(PATHS.UNITS, unitId);
                if (unitDoc && unitDoc.settings && unitDoc.settings.shifts) {
                    return unitDoc.settings.shifts;
                }
            }
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
                await FirebaseService.setDocument(PATHS.UNITS, unitId, {
                    settings: { shifts: shifts }
                }, true);
            } else {
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

    // ==================== 人員設定 ====================
    
    async getStaff(unitId) {
        try {
            // 🔥 重要修正：防呆檢查
            if (!unitId) {
                console.warn('[Settings] getStaff 被呼叫但未提供 unitId，回傳空陣列');
                return [];
            }

            const { query, where, getDocs, collection } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            const db = FirebaseService.db;
            
            // 執行查詢
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
            const id = staffData.id || staffData.employeeId;
            await FirebaseService.setDocument(PATHS.STAFF, id, staffData, true);
        } catch (error) {
            console.error('[Settings] 儲存人員失敗:', error);
            throw error;
        }
    },

    async batchSaveStaff(staffList, unitId) {
        if (!Auth.isManager()) throw new Error('權限不足');
        const db = FirebaseService.db;
        
        try {
            const batch = writeBatch(db);
            staffList.forEach(staff => {
                const data = { ...staff, unitId: unitId };
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
         await FirebaseService.setDocument(PATHS.STAFF, staffId, { status: 'inactive' }, true);
    },

    // ==================== 組別 (Groups) ====================
    
    async getGroups() {
        // 簡化實作：假設組別存在全域設定或單位設定中
        // 實際應參照 getShifts 邏輯
        return []; 
    },
    
    // ... 其他方法保持不變或留空待實作
};
