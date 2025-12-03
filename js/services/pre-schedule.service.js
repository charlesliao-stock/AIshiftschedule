/**
 * js/services/pre-schedule.service.js
 * 預班管理服務 (修正版 - 對接 Google Sheets API)
 */

import { API_CONFIG } from '../config/api.config.js';
import { SheetsService } from './sheets.service.js';
import { Auth } from '../core/auth.js';

export const PreScheduleService = {
    
    /**
     * 取得預班表資料
     */
    async getPreSchedule(unitId, month) {
        try {
            // 對應 api-endpoints.gs 的路由 logic
            const response = await SheetsService.post(API_CONFIG.ENDPOINTS.PRE_SCHEDULE.GET, {
                unit_id: unitId,
                month: month
            });
            
            if (response.success) {
                return response.data;
            }
            return null;
        } catch (error) {
            console.error('[PreScheduleService] 讀取失敗:', error);
            throw error;
        }
    },

    /**
     * 取得預班設定
     */
    async getPreScheduleConfig(month) {
        try {
            const unit = Auth.getUserUnit();
            if (!unit) return null;

            // 若 API_CONFIG 未定義 GET_CONFIG，則使用 'get-status'
            const action = API_CONFIG.ENDPOINTS.PRE_SCHEDULE.GET_CONFIG || 'get-status';
            
            const response = await SheetsService.post(action, {
                unit_id: unit.id,
                month: month
            });

            if (response.success) {
                return response.data;
            }
            return null;
        } catch (error) {
            console.error('[PreScheduleService] 取得設定失敗:', error);
            // 回傳安全預設值
            return { status: 'draft', isOpen: false };
        }
    },

    /**
     * 儲存預班設定 (狀態)
     */
    async savePreScheduleConfig(configData) {
        try {
            const unit = Auth.getUserUnit();
            // 對應 pre-schedule-api.gs -> setPreScheduleStatus
            const response = await SheetsService.post('set-status', {
                unit_id: unit.id,
                month: configData.month,
                status: configData.status,
                open_date: configData.openDate,
                close_date: configData.closeDate,
                timestamp: new Date().toISOString()
            });

            if (!response.success) throw new Error(response.message);
            return true;
        } catch (error) {
            console.error('[PreScheduleService] 儲存設定失敗:', error);
            throw error;
        }
    },

    /**
     * 提交預班
     */
    async submitPreSchedule(params) {
        try {
            const response = await SheetsService.post(API_CONFIG.ENDPOINTS.PRE_SCHEDULE.SAVE, {
                unit_id: params.unitId,
                month: params.month,
                staff_id: params.staffId,
                schedule: params.data,
                is_extra: false,
                timestamp: new Date().toISOString()
            });

            if (!response.success) throw new Error(response.message);
            return true;
        } catch (error) {
            console.error('[PreScheduleService] 提交失敗:', error);
            throw error;
        }
    },

    /**
     * 新增額外預班
     */
    async addExtraPreSchedule(params) {
        try {
            // 轉換為後端需要的單一更新格式
            const scheduleData = {};
            scheduleData[params.date] = {
                shift: params.shift,
                is_extra: true,
                reason: params.reason
            };

            const response = await SheetsService.post(API_CONFIG.ENDPOINTS.PRE_SCHEDULE.SAVE, {
                unit_id: params.unitId,
                month: params.month,
                staff_id: params.staffId,
                schedule: scheduleData,
                is_extra: true,
                timestamp: new Date().toISOString()
            });

            if (!response.success) throw new Error(response.message);
            return true;
        } catch (error) {
            console.error('[PreScheduleService] 新增額外預班失敗:', error);
            throw error;
        }
    },
    
    /**
     * 檢查衝突
     */
    async checkPreScheduleConflicts(unitId, month) {
        try {
            const response = await SheetsService.post('check-conflicts', {
                unit_id: unitId,
                month: month
            });
            return response.success ? response.data : [];
        } catch (error) {
            return [];
        }
    },

    /**
     * 取得統計
     */
    async getPreScheduleStatistics(month) {
        try {
            const unit = Auth.getUserUnit();
            const response = await SheetsService.post('get-stats', {
                unit_id: unit.id,
                month: month
            });
            return response.success ? response.data : {};
        } catch (error) {
            return {};
        }
    }
};
