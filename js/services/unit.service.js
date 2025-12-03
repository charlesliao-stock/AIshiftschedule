/**
 * js/services/unit.service.js
 * 單位管理服務 (修正版 - 支援細部權限管理)
 */

import { FIREBASE_CONFIG } from '../config/firebase.config.js';
import { API_CONFIG } from '../config/api.config.js';
import { Auth } from '../core/auth.js';
import { SheetsService } from './sheets.service.js';

export const UnitService = {

    // ... (保留 getAllUnits, getUnit, createUnit, updateUnit, deleteUnit 保持不變) ...
    // 為節省篇幅，請保留上述方法，僅更新以下人員相關方法

    /**
     * 取得單位內的所有人員 (Email 列表)
     */
    async getUnitUsers(unitId) {
        try {
            const unit = await this.getUnit(unitId);
            return {
                adminUsers: unit.admin_users || [],
                schedulerUsers: unit.scheduler_users || [],
                viewerUsers: unit.viewer_users || []
            };
        } catch (error) {
            console.error('[UnitService] 取得人員失敗:', error);
            throw error;
        }
    },

    /**
     * 新增人員到特定角色
     * @param {string} unitId 單位ID
     * @param {string} email 電子郵件
     * @param {string} role 角色 ('admin', 'scheduler', 'viewer')
     */
    async addUserRole(unitId, email, role) {
        try {
            // 權限檢查由 UI 層或 Firestore Rules 把關，這裡做基本檢查
            const currentUser = Auth.getCurrentUser();
            if (!currentUser) throw new Error('未登入');

            const fieldName = `${role}_users`; 
            
            await window.firebase.firestore()
                .collection('units')
                .doc(unitId)
                .update({
                    [fieldName]: window.firebase.firestore.FieldValue.arrayUnion(email),
                    updated_at: window.firebase.firestore.FieldValue.serverTimestamp()
                });
        } catch (error) {
            console.error('[UnitService] 新增人員失敗:', error);
            throw error;
        }
    },

    /**
     * 移除人員 (指定角色)
     * @param {string} unitId 單位ID
     * @param {string} email 電子郵件
     * @param {string} role 要移除的角色 ('admin', 'scheduler')
     */
    async removeUserFromRole(unitId, email, role) {
        try {
            const currentUser = Auth.getCurrentUser();
            if (!currentUser) throw new Error('未登入');

            // 單位管理者不能移除其他單位管理者 (除非是系統管理員)
            if (role === 'admin' && !Auth.isAdmin()) {
                throw new Error('權限不足：只有系統管理者可以移除單位管理者');
            }

            const fieldName = `${role}_users`;

            await window.firebase.firestore()
                .collection('units')
                .doc(unitId)
                .update({
                    [fieldName]: window.firebase.firestore.FieldValue.arrayRemove(email),
                    updated_at: window.firebase.firestore.FieldValue.serverTimestamp()
                });
        } catch (error) {
            console.error('[UnitService] 移除人員失敗:', error);
            throw error;
        }
    }
};
