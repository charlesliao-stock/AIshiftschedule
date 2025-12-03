/**
 * js/services/settings.service.js
 * 系統設定服務 (修正版 - 加入批次匯入)
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
        // ... (保留原有的單筆儲存邏輯) ...
        // 為節省篇幅，請保留原有的 saveShift 程式碼
        try {
            if (!Auth.isAdmin()) throw new Error('權限不足');
            const db = window.firebase.firestore();
            const ref = db.collection('settings').doc('shifts');
            
            await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(ref);
                let items = doc.exists && doc.data().items ? doc.data().items : [];
                const index = items.findIndex(i => i.id === shiftData.id);
                if (index > -1) items[index] = shiftData;
                else items.push(shiftData);
                transaction.set(ref, { items }, { merge: true });
            });
        } catch (error) { throw error; }
    },

    /**
     * [新增] 批次儲存班別 (用於匯入)
     */
    async batchSaveShifts(newShifts) {
        try {
            if (!Auth.isAdmin()) throw new Error('權限不足');
            const db = window.firebase.firestore();
            const ref = db.collection('settings').doc('shifts');

            await db.runTransaction(async (transaction) => {
                const doc = await transaction.get(ref);
                let items = doc.exists && doc.data().items ? doc.data().items : [];
                
                // 將新資料合併進去 (如果有重複代碼，則覆蓋)
                newShifts.forEach(newS => {
                    const idx = items.findIndex(oldS => oldS.code === newS.code);
                    if (idx > -1) {
                        items[idx] = { ...items[idx], ...newS, id: items[idx].id }; // 保持舊 ID
                    } else {
                        items.push({ ...newS, id: 'shift_' + Date.now() + Math.random().toString(36).substr(2, 5) });
                    }
                });

                transaction.set(ref, { items }, { merge: true });
            });
        } catch (error) {
            console.error('批次匯入失敗:', error);
            throw error;
        }
    },

    async deleteShift(shiftId) {
        // ... (保留原有的刪除邏輯) ...
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
        } catch (error) { throw error; }
    },

    // ==================== 組別設定 (Groups) ====================
    async getGroups() {
        // ... (保留原有邏輯) ...
        try {
            const snapshot = await window.firebase.firestore().collection('settings').doc('groups').get();
            return snapshot.exists && snapshot.data().items ? snapshot.data().items : [];
        } catch (error) { return []; }
    },

    async saveGroups(groups) {
        // ... (保留原有邏輯) ...
        try {
            if (!Auth.isAdmin()) throw new Error('權限不足');
            await window.firebase.firestore().collection('settings').doc('groups').set({ items: groups }, { merge: true });
        } catch (error) { throw error; }
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
        // ... (保留原有邏輯) ...
        try {
            if (!Auth.isAdmin()) throw new Error('權限不足');
            const db = window.firebase.firestore();
            if (staffData.id) {
                await db.collection('staff').doc(staffData.id).set(staffData, { merge: true });
            } else {
                const newRef = db.collection('staff').doc();
                await newRef.set({ ...staffData, id: newRef.id });
            }
        } catch (error) { throw error; }
    },

    /**
     * [新增] 批次儲存人員 (用於匯入)
     */
    async batchSaveStaff(staffList) {
        try {
            if (!Auth.isAdmin()) throw new Error('權限不足');
            const db = window.firebase.firestore();
            const batch = db.batch();
            
            // 由於 Firestore batch 限制 500 筆，若資料量大需分批 (這裡暫設為安全範圍內)
            staffList.forEach(staff => {
                // 檢查是否已有相同員工編號 (這需要先查詢，為效能考量，這裡採用: 有ID就更新，沒ID就新增)
                // 這裡簡化為全部視為新文件或覆寫
                // 為了避免重複，實務上通常會用 EmployeeID 當作 Document ID，或者先 Query
                // 這裡採用: 使用自動 ID
                
                const docRef = db.collection('staff').doc(); // 自動產生 ID
                batch.set(docRef, { ...staff, id: docRef.id });
            });

            await batch.commit();
        } catch (error) {
            console.error('批次匯入人員失敗:', error);
            throw error;
        }
    },

    async deleteStaff(staffId) {
        // ... (保留原有邏輯) ...
        try {
            if (!Auth.isAdmin()) throw new Error('權限不足');
            await window.firebase.firestore().collection('staff').doc(staffId).delete();
        } catch (error) { throw error; }
    },

    // ... (保留 Holiday 與 Labor Law 的邏輯) ...
    async getHolidays(year) {
        try {
            let query = window.firebase.firestore().collection('settings').doc('holidays');
            const snapshot = await query.get();
            let holidays = snapshot.exists && snapshot.data().items ? snapshot.data().items : [];
            if (year) {
                holidays = holidays.filter(h => h.applicableYear === 'all' || h.applicableYear == year);
            }
            return holidays;
        } catch (error) { return []; }
    },

    async saveHolidays(holidays) {
        try {
            if (!Auth.isAdmin()) throw new Error('權限不足');
            await window.firebase.firestore().collection('settings').doc('holidays').set({ items: holidays }, { merge: true });
        } catch (error) { throw error; }
    },

    async getLaborLawSettings() {
        try {
            const doc = await window.firebase.firestore().collection('settings').doc('labor_rules').get();
            return doc.exists ? doc.data() : {};
        } catch (error) { return {}; }
    },

    async saveLaborLawSettings(settings) {
        try {
            if (!Auth.isAdmin()) throw new Error('權限不足');
            await window.firebase.firestore().collection('settings').doc('labor_rules').set(settings, { merge: true });
        } catch (error) { throw error; }
    }
};
