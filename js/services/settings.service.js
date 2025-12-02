/**
 * js/services/settings.service.js
 * 系統設定服務
 */

import { FIREBASE_CONFIG } from '../config/firebase.config.js';
import { Auth } from '../core/auth.js'; // ✅ 確保引用正確

export const SettingsService = {
    
    /**
     * [新增] 取得班別設定
     * 修復: SettingsService.getShifts is not a function
     */
    async getShifts() {
        console.log('[SettingsService] 載入班別設定...');
        try {
            // 嘗試從資料庫讀取
            const doc = await window.firebase.firestore()
                .collection('settings')
                .doc('shifts')
                .get();

            if (doc.exists && doc.data().items) {
                return doc.data().items;
            }

            // 如果資料庫沒資料，回傳預設班別
            console.warn('[SettingsService] 找不到班別設定，使用預設值');
            return [
                { id: 'D', name: '白班', code: 'D', color: '#ffedc4', startTime: '08:00', endTime: '16:00' },
                { id: 'E', name: '小夜', code: 'E', color: '#ffd1d1', startTime: '16:00', endTime: '00:00' },
                { id: 'N', name: '大夜', code: 'N', color: '#d1e7ff', startTime: '00:00', endTime: '08:00' },
                { id: 'OFF', name: '預休', code: 'OFF', color: '#e0e0e0', startTime: '', endTime: '' }
            ];

        } catch (error) {
            console.error('[SettingsService] 載入班別失敗:', error);
            // 發生錯誤時回傳空陣列避免當機
            return [];
        }
    },

    /**
     * 取得一般系統設定
     */
    async getSettings() {
        try {
            const doc = await window.firebase.firestore()
                .collection('settings')
                .doc('general')
                .get();
                
            return doc.exists ? doc.data() : {};
        } catch (error) {
            console.error('[SettingsService] 載入設定失敗:', error);
            return {};
        }
    },

    /**
     * 儲存設定
     */
    async saveSettings(type, data) {
        try {
            // 檢查權限
            if (!Auth.isAdmin()) {
                throw new Error('只有管理員可以修改設定');
            }

            await window.firebase.firestore()
                .collection('settings')
                .doc(type)
                .set(data, { merge: true });
                
            console.log(`[SettingsService] 設定已儲存: ${type}`);
            return true;
        } catch (error) {
            console.error('[SettingsService] 儲存失敗:', error);
            throw error;
        }
    }
};
