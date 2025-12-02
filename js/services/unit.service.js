/**
 * js/services/unit.service.js
 * 單位管理服務 (Firebase Firestore 版)
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
                .orderBy('name', 'asc') // 依照名稱排序
                .get();

            const units = [];
            snapshot.forEach(doc => {
                units.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            // 如果資料庫是空的，回傳一個預設範例，方便 UI 顯示
            if (units.length === 0) {
                console.warn('[UnitService] 無單位資料，回傳預設值');
                return [
                    { id: 'default', name: '內科加護病房', code: 'ICU', created_at: new Date().toISOString() },
                    { id: 'demo_unit', name: '普通病房', code: 'WARD', created_at: new Date().toISOString() }
                ];
            }

            return units;
        } catch (error) {
            console.error('[UnitService] 取得單位失敗:', error);
            // 發生錯誤時回傳空陣列，避免畫面崩潰
            return [];
        }
    },

    /**
     * 新增單位
     */
    async addUnit(unitData) {
        try {
            // 檢查權限 (只有管理員能新增)
            if (!Auth.isAdmin()) {
                throw new Error('權限不足：僅管理員可執行此操作');
            }

            const docRef = await window.firebase.firestore()
                .collection('units')
                .add({
                    ...unitData,
                    created_at: window.firebase.firestore.FieldValue.serverTimestamp(),
                    updated_at: window.firebase.firestore.FieldValue.serverTimestamp()
                });
            
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
    }
};
