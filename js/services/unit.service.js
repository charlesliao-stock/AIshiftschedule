/**
 * js/services/unit.service.js (Firebase First 版)
 */
import { FirebaseService } from './firebase.service.js';

export const UnitService = {
    async getAllUnits() {
        return await FirebaseService.getCollection('units');
    },

    async getUnitById(unitId) {
        return await FirebaseService.getDocument('units', unitId);
    },

    async saveUnit(unitData) {
        const unitId = unitData.id || unitData.code;
        await FirebaseService.setDocument('units', unitId, unitData);
        return unitId;
    },
    
    async updateUnit(unitId, data) {
        await FirebaseService.setDocument('units', unitId, data, true);
    },

    // 取得該單位人員
    async getUnitStaff(unitId) {
        return await FirebaseService.queryDocuments('users', 'unitId', '==', unitId);
    }
};
