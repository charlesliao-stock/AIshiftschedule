/**
 * js/services/settings.service.js
 * 系統設定服務 (Firebase Firestore 版) - 整合所有設定 CRUD
 */

import { Auth } from '../core/auth.js';

export const SettingsService = {
    
    // ==================== 班別設定 (Shifts) ====================
    async getShifts() {
        try {
            const snapshot = await window.firebase.firestore().collection('settings').doc('shifts').get();
            return snapshot.exists && snapshot.data().items ? snapshot.data().items : [];
        } catch (error) {
            console.error('取得班別失敗:', error);
            return [];
        }
    },

    async saveShift(shiftData) {
        try {
            if (!Auth.isAdmin()) throw new Error('權限不足');
            const db = window.firebase.firestore();
            const ref = db.collection('settings').doc('shifts');
            
            // 使用 Transaction 確保資料一致性
            await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(ref);
                let items = doc.exists && doc.data().items ? doc.data().items : [];
                
                // 檢查是否為更新
                const index = items.findIndex(i => i.id === shiftData.id);
                if (index > -1) {
                    items[index] = shiftData;
                } else {
                    items.push(shiftData);
                }
                
                transaction.set(ref, { items }, { merge: true });
            });
        } catch (error) {
            throw error;
        }
    },

    async deleteShift(shiftId) {
        try {
            if (!Auth.isAdmin()) throw new Error('權限不足');
            const db = window.firebase.firestore();
            const ref = db.collection('settings').doc('shifts');
            
            await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(ref);
                if (!doc.exists) return;
                
                const items = doc.data().items.filter(i => i.id !== shiftId);
                transaction.set(ref, { items }, { merge: true });
            });
        } catch (error) {
            throw error;
        }
    },

    // ==================== 組別設定 (Groups) ====================
    async getGroups() {
        try {
            const snapshot = await window.firebase.firestore().collection('settings').doc('groups').get();
            return snapshot.exists && snapshot.data().items ? snapshot.data().items : [];
        } catch (error) {
            console.error('取得組別失敗:', error);
            return [];
        }
    },

    async saveGroups(groups) {
        try {
            if (!Auth.isAdmin()) throw new Error('權限不足');
            await window.firebase.firestore().collection('settings').doc('groups').set({ items: groups }, { merge: true });
        } catch (error) {
            throw error;
        }
    },

    // ==================== 人員設定 (Staff) ====================
    async getStaff() {
        try {
            const snapshot = await window.firebase.firestore().collection('staff').get();
            const staff = [];
            snapshot.forEach(doc => staff.push({ id: doc.id, ...doc.data() }));
            return staff;
        } catch (error) {
            console.error('取得人員失敗:', error);
            return [];
        }
    },

    async saveStaff(staffData) {
        try {
            if (!Auth.isAdmin()) throw new Error('權限不足');
            const db = window.firebase.firestore();
            
            if (staffData.id) {
                await db.collection('staff').doc(staffData.id).set(staffData, { merge: true });
            } else {
                const newRef = db.collection('staff').doc();
                await newRef.set({ ...staffData, id: newRef.id });
            }
        } catch (error) {
            throw error;
        }
    },

    async deleteStaff(staffId) {
        try {
            if (!Auth.isAdmin()) throw new Error('權限不足');
            await window.firebase.firestore().collection('staff').doc(staffId).delete();
        } catch (error) {
            throw error;
        }
    },

    // ==================== 假日設定 (Holidays) ====================
    async getHolidays(year) {
        try {
            let query = window.firebase.firestore().collection('settings').doc('holidays');
            const snapshot = await query.get();
            let holidays = snapshot.exists && snapshot.data().items ? snapshot.data().items : [];
            
            // 如果指定年份，進行篩選
            if (year) {
                holidays = holidays.filter(h => h.applicableYear === 'all' || h.applicableYear == year);
            }
            return holidays;
        } catch (error) {
            return [];
        }
    },

    async saveHolidays(holidays) {
        try {
            if (!Auth.isAdmin()) throw new Error('權限不足');
            await window.firebase.firestore().collection('settings').doc('holidays').set({ items: holidays }, { merge: true });
        } catch (error) {
            throw error;
        }
    },

    // ==================== 勞基法設定 (Labor Rules) ====================
    async getLaborLawSettings() {
        try {
            const doc = await window.firebase.firestore().collection('settings').doc('labor_rules').get();
            return doc.exists ? doc.data() : {};
        } catch (error) {
            return {};
        }
    },

    async saveLaborLawSettings(settings) {
        try {
            if (!Auth.isAdmin()) throw new Error('權限不足');
            await window.firebase.firestore().collection('settings').doc('labor_rules').set(settings, { merge: true });
        } catch (error) {
            throw error;
        }
    }
};
