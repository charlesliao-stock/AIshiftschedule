/**
 * js/services/unit.service.js
 * 單位管理服務 (Firebase Firestore 版) - 完整修復版
 */

import { FIREBASE_CONFIG } from '../config/firebase.config.js';
import { Auth } from '../core/auth.js';

export const UnitService = {

    /**
     * 取得所有單位列表
     */
    async getAllUnits() {
        console.log('[UnitService] 取得所有單位...');
        try {
            const snapshot = await window.firebase.firestore()
                .collection('units')
                .orderBy('created_at', 'desc') // 改依建立時間排序
                .get();

            const units = [];
            snapshot.forEach(doc => {
                units.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            // 移除預設假資料，讓列表真實反映資料庫狀態
            // 如果需要測試，可手動新增
            return units;
        } catch (error) {
            console.error('[UnitService] 取得單位失敗:', error);
            return [];
        }
    },

    /**
     * [新增] 取得單一單位詳細資料
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
     * 建立新單位
     */
    async createUnit(unitData) {
        try {
            if (!Auth.isAdmin()) {
                throw new Error('權限不足');
            }

            // 準備資料結構，包含預設的人員陣列
            const newUnit = {
                ...unitData,
                status: 'active', // 預設啟用
                admin_users: unitData.admin_email ? [unitData.admin_email] : [],
                scheduler_users: [],
                viewer_users: [],
                created_at: window.firebase.firestore.FieldValue.serverTimestamp(),
                updated_at: window.firebase.firestore.FieldValue.serverTimestamp()
            };

            const docRef = await window.firebase.firestore()
                .collection('units')
                .add(newUnit);
            
            return docRef.id;
        } catch (error) {
            console.error('[UnitService] 新增單位失敗:', error);
            throw error;
        }
    },

    /**
     * 更新單位資訊
     */
    async updateUnit(id, unitData) {
        try {
            if (!Auth.isAdmin()) {
                throw new Error('權限不足');
            }

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
     * 刪除單位
     */
    async deleteUnit(id) {
        try {
            if (!Auth.isAdmin()) {
                throw new Error('權限不足');
            }

            await window.firebase.firestore()
                .collection('units')
                .doc(id)
                .delete();
                
            return true;
        } catch (error) {
            console.error('[UnitService] 刪除單位失敗:', error);
            throw error;
        }
    },

    // ==================== 人員管理功能 (支援 UserAssignment) ====================

    /**
     * 取得單位內的所有人員
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
     */
    async addUserRole(unitId, email, role) {
        try {
            if (!Auth.isAdmin()) throw new Error('權限不足');
            
            const fieldName = `${role}_users`; // admin_users, scheduler_users...
            
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
     * 移除人員 (從所有角色中移除)
     */
    async removeUser(unitId, email) {
        try {
            if (!Auth.isAdmin()) throw new Error('權限不足');

            const unitRef = window.firebase.firestore().collection('units').doc(unitId);
            
            // 從三個陣列中同時移除，確保乾淨
            await unitRef.update({
                admin_users: window.firebase.firestore.FieldValue.arrayRemove(email),
                scheduler_users: window.firebase.firestore.FieldValue.arrayRemove(email),
                viewer_users: window.firebase.firestore.FieldValue.arrayRemove(email),
                updated_at: window.firebase.firestore.FieldValue.serverTimestamp()
            });
        } catch (error) {
            console.error('[UnitService] 移除人員失敗:', error);
            throw error;
        }
    }
};
