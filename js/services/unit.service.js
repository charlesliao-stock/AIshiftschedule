/**
 * js/services/unit.service.js
 * 單位服務 (ES Module 版)
 */

import { SheetsService } from './sheets.service.js';
import { API_CONFIG } from '../config/api.config.js';
import { FIREBASE_CONFIG } from '../config/firebase.config.js';
import { Utils } from '../core/utils.js';

export const UnitService = {
    
    // ==================== 單位操作 ====================
    
    async getAllUnits() {
        try {
            console.log('[Unit] 取得所有單位');
            // 使用 API_CONFIG.ENDPOINTS 對應 Action
            const action = API_CONFIG.ENDPOINTS.UNIT.LIST;
            const result = await SheetsService.post(action);
            return result.data || [];
        } catch (error) {
            console.error('[Unit] 取得單位列表失敗:', error);
            throw error;
        }
    },
    
    async getUnit(unitId) {
        try {
            const units = await this.getAllUnits();
            const unit = units.find(u => u.unit_id === unitId);
            if (!unit) throw new Error('找不到指定的單位');
            return unit;
        } catch (error) {
            console.error('[Unit] 取得單位失敗:', error);
            throw error;
        }
    },
    
    async createUnit(unitData) {
        try {
            console.log('[Unit] 創建單位:', unitData);
            this.validateUnitData(unitData);
            
            const action = API_CONFIG.ENDPOINTS.UNIT.CREATE;
            const result = await SheetsService.post(action, unitData);
            
            SheetsService.clearCache('getUnitList');
            return result.data;
        } catch (error) {
            console.error('[Unit] 創建單位失敗:', error);
            throw error;
        }
    },
    
    async updateUnit(unitId, updates) {
        try {
            const action = API_CONFIG.ENDPOINTS.UNIT.UPDATE;
            const result = await SheetsService.post(action, { unit_id: unitId, ...updates });
            SheetsService.clearCache('getUnitList');
            return result.data;
        } catch (error) {
            console.error('[Unit] 更新單位失敗:', error);
            throw error;
        }
    },
    
    async deleteUnit(unitId) {
        try {
            const action = API_CONFIG.ENDPOINTS.UNIT.DELETE;
            await SheetsService.post(action, { unit_id: unitId });
            SheetsService.clearCache('getUnitList');
        } catch (error) {
            console.error('[Unit] 刪除單位失敗:', error);
            throw error;
        }
    },
    
    // ==================== 驗證 ====================
    
    validateUnitData(unitData) {
        const errors = [];
        if (!unitData.unit_code?.trim()) errors.push('請輸入單位代碼');
        if (!unitData.unit_name?.trim()) errors.push('請輸入單位名稱');
        if (unitData.admin_email && !Utils.isValidEmail(unitData.admin_email)) {
            errors.push('管理員 Email 格式錯誤');
        }
        if (errors.length > 0) throw new Error(errors.join('、'));
    },
    
    // ==================== 使用者分配 (Firebase) ====================
    
    async assignUser(unitId, userId, role) {
        try {
            console.log('[Unit] 分配使用者:', unitId, userId, role);
            
            if (!FIREBASE_CONFIG.demo?.enabled && window.firebase) {
                await window.firebase.firestore()
                    .collection(FIREBASE_CONFIG.collections.USERS)
                    .doc(userId)
                    .update({
                        unit_id: unitId,
                        role: role,
                        updated_at: window.firebase.firestore.FieldValue.serverTimestamp()
                    });
            }
            // 更新 Sheet
            // 實務上這部分可能由後端同步，或這裡再次呼叫 updateUnit
        } catch (error) {
            console.error('[Unit] 分配使用者失敗:', error);
            throw error;
        }
    },
    
    async removeUser(unitId, userId) {
        try {
            if (!FIREBASE_CONFIG.demo?.enabled && window.firebase) {
                await window.firebase.firestore()
                    .collection(FIREBASE_CONFIG.collections.USERS)
                    .doc(userId)
                    .update({
                        unit_id: null,
                        updated_at: window.firebase.firestore.FieldValue.serverTimestamp()
                    });
            }
        } catch (error) {
            console.error('[Unit] 移除使用者失敗:', error);
            throw error;
        }
    },

    // ==================== 輔助方法 ====================
    
    async getUnitSheets(unitId) {
        const unit = await this.getUnit(unitId);
        return {
            settings: unit.settings_sheet_url,
            preSchedule: unit.pre_schedule_sheet_url,
            schedule: unit.schedule_sheet_url
        };
    }
};