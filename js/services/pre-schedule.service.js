/**
 * js/services/pre-schedule.service.js
 * 預班管理服務 - 負責與 Firebase Firestore 進行資料交互
 */

import { FIREBASE_CONFIG } from '../config/firebase.config.js';
import { Auth } from '../core/auth.js'; 

export const PreScheduleService = {
    
    /**
     * 取得指定年份與月份的預班資料
     */
    async getPreSchedule(year, month) {
        console.log(`[PreScheduleService] 載入預班資料: ${year}-${month}`);
        
        try {
            if (!window.firebase) throw new Error("Firebase 未初始化");

            const unit = Auth.getUserUnit();
            const unitId = unit ? unit.id : null;

            let query = window.firebase.firestore()
                .collection('pre_schedules')
                .where('year', '==', parseInt(year))
                .where('month', '==', parseInt(month));

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
            return []; 
        }
    },

    /**
     * [新增] 取得預班設定 (規則、班別定義等)
     * 修復: PreScheduleService.getPreScheduleConfig is not a function
     */
    async getPreScheduleConfig() {
        console.log('[PreScheduleService] 載入預班設定...');
        try {
            // 嘗試從資料庫讀取設定 (假設存放在 settings/pre_schedule)
            const doc = await window.firebase.firestore()
                .collection('settings')
                .doc('pre_schedule')
                .get();

            if (doc.exists) {
                return doc.data();
            } 
            
            // 如果資料庫沒設定，回傳「預設值」讓畫面能正常顯示
            // 這樣就不會報錯了
            console.warn('[PreScheduleService] 找不到設定，使用預設值');
            return {
                isOpen: true,           // 是否開放預班
                deadlineDay: 25,        // 每月截止日
                maxRequests: 5,         // 每人最多預選數
                shifts: [               // 可選班別定義
                    { id: 'D', name: '白班', color: '#ffedc4' },
                    { id: 'E', name: '小夜', color: '#ffd1d1' },
                    { id: 'N', name: '大夜', color: '#d1e7ff' },
                    { id: 'OFF', name: '預休', color: '#e0e0e0' }
                ]
            };

        } catch (error) {
            console.error('[PreScheduleService] 取得設定失敗:', error);
            // 發生錯誤時回傳空物件，避免崩潰
            return { isOpen: true, shifts: [] };
        }
    },

    /**
     * 儲存或更新預班申請
     */
    async savePreSchedule(data) {
        console.log('[PreScheduleService] 儲存預班申請:', data);
        try {
            const collectionRef = window.firebase.firestore().collection('pre_schedules');
            const unit = Auth.getUserUnit();
            const payload = {
                ...data,
                unit_id: data.unit_id || (unit ? unit.id : 'default'),
                unit_name: data.unit_name || (unit ? unit.name : '預設單位')
            };

            if (payload.id) {
                await collectionRef.doc(payload.id).update({
                    ...payload,
                    updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
                });
                return payload.id;
            } else {
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
