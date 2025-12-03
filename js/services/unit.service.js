/**
 * js/services/unit.service.js
 * 單位管理服務 (ES Module 完整版 - 含 CRUD 與 權限管理)
 */

import { FIREBASE_CONFIG } from '../config/firebase.config.js';
import { API_CONFIG } from '../config/api.config.js';
import { Auth } from '../core/auth.js';
import { SheetsService } from './sheets.service.js';

export const UnitService = {

    /**
     * 取得所有單位列表 (從 Firestore 讀取)
     */
    async getAllUnits() {
        try {
            const snapshot = await window.firebase.firestore()
                .collection('units')
                .orderBy('created_at', 'desc')
                .get();

            const units = [];
            snapshot.forEach(doc => {
                units.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            return units;
        } catch (error) {
            console.error('[UnitService] 取得單位失敗:', error);
            throw error;
        }
    },

    /**
     * 取得單一單位詳細資料
     */
    async getUnit(id) {
        try {
            const doc = await window.firebase.firestore()
                .collection('units')
                .doc(id)
                .get();

            if (doc.exists) {
                return { id: doc.id, ...doc.data() };
            } else {
                throw new Error('找不到該單位');
            }
        } catch (error) {
            console.error('[UnitService] 取得單位失敗:', error);
            throw error;
        }
    },

    /**
     * 建立新單位 (混合架構：GAS 建檔 + Firestore 存資料)
     */
    async createUnit(unitData) {
        try {
            if (!Auth.isAdmin()) throw new Error('權限不足');

            console.log('[UnitService] 步驟 1/2: 呼叫 GAS 建立試算表...');
            
            // 1. 呼叫 GAS API 建立 Sheets
            const gasResponse = await SheetsService.post(API_CONFIG.ENDPOINTS.UNIT.CREATE, {
                unit_code: unitData.unit_code, 
                unit_name: unitData.unit_name,
                admin_email: unitData.admin_email
            });

            if (!gasResponse.success) {
                throw new Error('GAS 建立試算表失敗: ' + (gasResponse.error || gasResponse.message));
            }

            const gasData = gasResponse.data;
            console.log('[UnitService] GAS 回傳資料:', gasData);

            // 2. 準備寫入 Firestore 的資料
            const firestoreData = {
                unit_code: unitData.unit_code,
                unit_name: unitData.unit_name,
                description: unitData.description || '',
                status: 'active',
                
                // Sheet 連結資訊 (來自 GAS)
                settings_sheet_id: gasData.settings_sheet_id,
                settings_sheet_url: gasData.settings_sheet_url,
                pre_schedule_sheet_id: gasData.pre_schedule_sheet_id,
                pre_schedule_sheet_url: gasData.pre_schedule_sheet_url,
                schedule_sheet_id: gasData.schedule_sheet_id,
                schedule_sheet_url: gasData.schedule_sheet_url,

                // 人員權限
                admin_users: unitData.admin_email ? [unitData.admin_email] : [],
                scheduler_users: [],
                viewer_users: [],
                
                created_at: window.firebase.firestore.FieldValue.serverTimestamp(),
                updated_at: window.firebase.firestore.FieldValue.serverTimestamp()
            };

            console.log('[UnitService] 步驟 2/2: 寫入 Firestore...');
            const docRef = await window.firebase.firestore()
                .collection('units')
                .add(firestoreData);
            
            return docRef.id;

        } catch (error) {
            console.error('[UnitService] 新增單位失敗:', error);
            throw error;
        }
    },

    /**
     * 更新單位資訊 (只更新 Firestore)
     */
    async updateUnit(id, unitData) {
        try {
            if (!Auth.isAdmin()) throw new Error('權限不足');

            await window.firebase.firestore()
                .collection('units')
                .doc(id)
                .update({
                    ...unitData,
                    updated_at: window.firebase.firestore.FieldValue.serverTimestamp()
                });
            return true;
        } catch (error) {
            console.error('[UnitService] 更新單位失敗:', error);
            throw error;
        }
    },

    /**
     * 刪除單位 (只刪除 Firestore)
     */
    async deleteUnit(id) {
        try {
            if (!Auth.isAdmin()) throw new Error('權限不足');
            await window.firebase.firestore().collection('units').doc(id).delete();
            return true;
        } catch (error) {
            console.error('[UnitService] 刪除單位失敗:', error);
            throw error;
        }
    },

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
