/**
 * js/services/pre-schedule.service.js
 * 預班管理服務 - 負責與 Firebase Firestore 進行資料交互
 */

import { FIREBASE_CONFIG } from '../config/firebase.config.js';
import { Auth } from '../core/auth.js'; // ✅ 修正：引用整個 Auth 物件

export const PreScheduleService = {
    
    /**
     * 取得指定年份與月份的預班資料
     * @param {number} year 
     * @param {number} month 
     * @returns {Promise<Array>}
     */
    async getPreSchedule(year, month) { // ✅ 修正：名稱改為單數 (去掉 s)
        console.log(`[PreScheduleService] 載入預班資料: ${year}-${month}`);
        
        try {
            if (!window.firebase) throw new Error("Firebase 未初始化");

            // ✅ 修正：使用正確的方法取得單位資訊
            const unit = Auth.getUserUnit();
            const unitId = unit ? unit.id : null;

            // 建立查詢
            let query = window.firebase.firestore()
                .collection('pre_schedules') // 若您的集合名稱不同，請在此修改
                .where('year', '==', parseInt(year))
                .where('month', '==', parseInt(month));

            // 如果有單位 ID，則只撈取該單位的資料 (可選)
            if (unitId) {
                query = query.where('unit_id', '==', unitId);
            }

            const snapshot = await query.get();

            const schedules = [];
            snapshot.forEach(doc => {
                schedules.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            console.log(`[PreScheduleService] 成功載入 ${schedules.length} 筆資料`);
            return schedules;

        } catch (error) {
            console.error('[PreScheduleService] 載入失敗:', error);
            // 為了不讓畫面卡死，發生錯誤時回傳空陣列，但會在 Console 留紀錄
            return []; 
        }
    },

    /**
     * 儲存或更新預班申請
     * @param {Object} data 
     * @returns {Promise<string>} docId
     */
    async savePreSchedule(data) {
        console.log('[PreScheduleService] 儲存預班申請:', data);
        
        try {
            const collectionRef = window.firebase.firestore().collection('pre_schedules');
            
            // 確保資料包含單位資訊
            const unit = Auth.getUserUnit();
            const payload = {
                ...data,
                unit_id: data.unit_id || (unit ? unit.id : 'default'),
                unit_name: data.unit_name || (unit ? unit.name : '預設單位')
            };

            // 如果有 ID 則更新，否則新增
            if (payload.id) {
                await collectionRef.doc(payload.id).update({
                    ...payload,
                    updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
                });
                return payload.id;
            } else {
                // 新增時加入建立時間
                const docRef = await collectionRef.add({
                    ...payload,
                    createdAt: window.firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
                });
                return docRef.id;
            }
        } catch (error) {
            console.error('[PreScheduleService] 儲存失敗:', error);
            throw error;
        }
    },

    /**
     * 刪除預班申請
     * @param {string} id 
     */
    async deletePreSchedule(id) {
        try {
            await window.firebase.firestore()
                .collection('pre_schedules')
                .doc(id)
                .delete();
            console.log(`[PreScheduleService] 已刪除: ${id}`);
        } catch (error) {
            console.error('[PreScheduleService] 刪除失敗:', error);
            throw error;
        }
    }
};
