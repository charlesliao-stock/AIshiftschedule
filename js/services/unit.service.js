/**
 * js/services/unit.service.js
 * 單位資料服務 (Firebase Core)
 */
import { FirebaseService } from './firebase.service.js';

export const UnitService = {
    /**
     * 取得所有單位
     * UX: 無資料時回傳 []，不報錯
     */
    async getAllUnits() {
        // 直接使用封裝好的 getCollection，它內部已處理 try-catch 回傳 []
        return await FirebaseService.getCollection('units');
    },

    /**
     * 取得特定單位
     */
    async getUnitById(unitId) {
        return await FirebaseService.getDocument('units', unitId);
    },

    /**
     * 建立/更新單位
     */
    async saveUnit(unitData) {
        const unitId = unitData.id || unitData.code; // 確保有 ID
        await FirebaseService.setDocument('units', unitId, unitData);
        return unitId;
    }
};
