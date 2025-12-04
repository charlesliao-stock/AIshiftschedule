/**
 * js/services/unit.service.js (最終修正版)
 */
import { FirebaseService } from './firebase.service.js';

export const UnitService = {
    async getAllUnits() {
        return await FirebaseService.getCollection('units');
    },

    async getUnitById(unitId) {
        return await FirebaseService.getDocument('units', unitId);
    },

    // 別名方法，兼容不同模組的呼叫習慣
    async getUnit(unitId) {
        return this.getUnitById(unitId);
    },

    async saveUnit(unitData) {
        const unitId = unitData.id || unitData.unit_code || 'unit_' + Date.now();
        await FirebaseService.setDocument('units', unitId, unitData);
        return unitId;
    },
    
    async createUnit(unitData) {
        // 確保有 ID
        if (!unitData.id && unitData.unit_code) {
            unitData.id = unitData.unit_code;
        }
        return this.saveUnit({
            ...unitData,
            status: 'active',
            createdAt: new Date().toISOString()
        });
    },

    async updateUnit(unitId, data) {
        await FirebaseService.setDocument('units', unitId, data, true);
    },
    
    async deleteUnit(unitId) {
        // 軟刪除 (標記為 inactive) 或 實作 deleteDocument
        await this.updateUnit(unitId, { status: 'inactive' });
    },

    // 取得該單位人員 (Full Staff Objects)
    async getUnitStaff(unitId) {
        // 假設 FirebaseService 有實作 queryDocuments
        // 若無，可改用 getCollection('users') 後 filter
        if (FirebaseService.queryDocuments) {
            return await FirebaseService.queryDocuments('users', 'unitId', '==', unitId);
        } else {
            const allUsers = await FirebaseService.getCollection('users');
            return allUsers.filter(u => u.unitId === unitId || u.unit_id === unitId);
        }
    },

    // 取得該單位的使用者權限清單 (Admin/Scheduler List)
    async getUnitUsers(unitId) {
        const unit = await this.getUnitById(unitId);
        return {
            adminUsers: unit?.adminUsers || [],
            schedulerUsers: unit?.schedulerUsers || []
        };
    },

    async addUserRole(unitId, email, role) {
        const unit = await this.getUnitById(unitId);
        if (!unit) throw new Error('單位不存在');

        const targetArray = role === 'admin' ? 'adminUsers' : 'schedulerUsers';
        const currentList = unit[targetArray] || [];

        if (!currentList.includes(email)) {
            currentList.push(email);
            await this.updateUnit(unitId, { [targetArray]: currentList });
        }
    },

    async removeUserFromRole(unitId, email, role) {
        const unit = await this.getUnitById(unitId);
        if (!unit) throw new Error('單位不存在');

        const targetArray = role === 'admin' ? 'adminUsers' : 'schedulerUsers';
        const currentList = unit[targetArray] || [];

        const newList = currentList.filter(e => e !== email);
        await this.updateUnit(unitId, { [targetArray]: newList });
    }
};
