/**
 * js/services/pre-schedule.service.js
 * 預班管理服務 (Firestore 重構版)
 * 負責：預班資料的 CRUD、狀態管理、衝突檢查
 */
import { FirebaseService } from './firebase.service.js';
import { Auth } from '../core/auth.js';

const COLLECTION_NAME = 'pre_schedules';

export const PreScheduleService = {
    
    /**
     * 取得預班表資料 (讀取 Firestore)
     * Doc ID 格式: YYYYMM_unitId
     */
    async getPreSchedule(unitId, month) {
        try {
            const docId = `${month}_${unitId}`;
            const docData = await FirebaseService.getDocument(COLLECTION_NAME, docId);
            
            if (docData) {
                return {
                    month: docData.yearMonth,
                    unit_id: docData.unitId,
                    status: docData.status || 'open',
                    open_date: docData.openDate,
                    close_date: docData.closeDate,
                    staff_schedules: docData.schedules || {}
                };
            }
            
            // 若無資料，回傳預設空結構
            return {
                month: month,
                unit_id: unitId,
                status: 'open',
                staff_schedules: {}
            };
        } catch (error) {
            console.error('[PreSchedule] 讀取失敗:', error);
            throw error;
        }
    },

    /**
     * 取得預班設定與狀態
     */
    async getPreScheduleConfig(month) {
        try {
            const unit = Auth.getUserUnit(); // 需確保 Auth 能取得單位資訊
            if (!unit) return null;
            
            const data = await this.getPreSchedule(unit.id, month);
            return {
                status: data.status,
                isOpen: data.status === 'open',
                openDate: data.open_date,
                closeDate: data.close_date
            };
        } catch (error) {
            console.error('[PreSchedule] 取得設定失敗:', error);
            return { status: 'draft', isOpen: false };
        }
    },

    /**
     * 儲存預班設定 (狀態/日期)
     */
    async savePreScheduleConfig(configData) {
        try {
            const unit = Auth.getUserUnit();
            if (!unit) throw new Error('無法確認使用者單位');

            const docId = `${configData.month}_${unit.id}`;
            const updateData = {
                yearMonth: configData.month,
                unitId: unit.id,
                unitName: unit.name || '',
                status: configData.status,
                openDate: configData.openDate,
                closeDate: configData.closeDate,
                updatedAt: new Date().toISOString(),
                updatedBy: Auth.getCurrentUser()?.email
            };

            await FirebaseService.setDocument(COLLECTION_NAME, docId, updateData, true); // Merge
            return true;
        } catch (error) {
            console.error('[PreSchedule] 儲存設定失敗:', error);
            throw error;
        }
    },

    /**
     * 提交個人預班資料
     */
    async submitPreSchedule(params) {
        try {
            const docId = `${params.month}_${params.unitId}`;
            const staffId = params.staffId;
            
            // 1. 先取得現有文件，避免覆蓋其他人資料
            // 注意：Firestore 的 update 支援 dot notation (e.g. "schedules.staffId") 
            // 這樣可以只更新該員工的資料而不需要讀取整份文件
            const fieldPath = `schedules.${staffId}`;
            
            const updatePayload = {
                [fieldPath]: {
                    name: params.staffName || '', // 建議傳入姓名
                    shifts: this._formatShiftsForStorage(params.data), // 轉換格式
                    updatedAt: new Date().toISOString()
                }
            };

            // 使用 setDocument 的 merge 選項，或直接 updateDoc
            // 這裡為了確保文件存在，先做一次 set merge
            await FirebaseService.setDocument(COLLECTION_NAME, docId, updatePayload, true);
            return true;
        } catch (error) {
            console.error('[PreSchedule] 提交失敗:', error);
            throw error;
        }
    },

    /**
     * 新增額外預班 (Manager/Admin 功能)
     */
    async addExtraPreSchedule(params) {
        try {
            const docId = `${params.month}_${params.unitId}`;
            const staffId = params.staffId;
            
            // 取得現有資料以進行合併
            const currentData = await this.getPreSchedule(params.unitId, params.month);
            const staffSchedule = currentData.staff_schedules[staffId] || { shifts: [] };
            
            // 加入新的額外班別
            const newShift = {
                date: params.date,
                shift: params.shift,
                isExtra: true,
                reason: params.reason || ''
            };
            
            // 簡單的陣列操作：移除同日期的舊資料，加入新資料
            let updatedShifts = (staffSchedule.shifts || []).filter(s => s.date !== params.date);
            updatedShifts.push(newShift);

            const fieldPath = `schedules.${staffId}`;
            await FirebaseService.setDocument(COLLECTION_NAME, docId, {
                [fieldPath]: {
                    ...staffSchedule,
                    shifts: updatedShifts
                }
            }, true);

            return true;
        } catch (error) {
            console.error('[PreSchedule] 新增額外預班失敗:', error);
            throw error;
        }
    },

    // --- 內部 Helper ---
    
    /**
     * 將前端 { '2025-01-01': { shift: 'D' } } 格式轉為陣列儲存
     * Firestore 儲存陣列較易於查詢和索引
     */
    _formatShiftsForStorage(scheduleData) {
        if (!scheduleData) return [];
        return Object.entries(scheduleData).map(([date, info]) => ({
            date: date,
            shift: info.shift,
            isExtra: info.is_extra || false
        }));
    }
};
