/**
 * js/services/schedule.service.js
 * 排班服務層 (ES Module 版 - 完整修復版)
 */

import { API_CONFIG } from '../config/api.config.js';
import { Auth } from '../core/auth.js';

export class ScheduleService {
    constructor() {
        // ✅ 修正：使用正確的 API Config 屬性
        this.apiBaseUrl = API_CONFIG.BASE_URL;
    }

    async getCurrentUnitAndUser() {
        const user = Auth.getCurrentUser();
        const unit = Auth.getUserUnit();
        return { user, unit };
    }

    // 通用的 POST 請求封裝
    async post(action, payload) {
        try {
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' }, // GAS 偏好 text/plain 以避開 CORS 預檢
                body: JSON.stringify({ action, ...payload })
            });
            const result = await response.json();
            return result;
        } catch (error) {
            console.error(`[ScheduleService] API 請求失敗 (${action}):`, error);
            throw error;
        }
    }

    /**
     * 取得排班表
     */
    async getSchedule(month) {
        try {
            const { unit } = await this.getCurrentUnitAndUser();
            if (!unit) throw new Error('找不到所屬單位');

            const result = await this.post('getSchedule', {
                scheduleSheetId: unit.schedule_sheet_id, // 從單位資訊取得 Sheet ID
                unit_id: unit.id, // 雙重保險
                month: month
            });

            if (!result.success) throw new Error(result.error || '取得排班表失敗');
            return result.data;
        } catch (error) {
            console.error('取得排班表錯誤:', error);
            throw error;
        }
    }

    /**
     * 取得員工排班
     */
    async getStaffSchedule(month, staffId) {
        try {
            const { unit } = await this.getCurrentUnitAndUser();
            const result = await this.post('getStaffSchedule', {
                scheduleSheetId: unit.schedule_sheet_id,
                month: month,
                staffId: staffId
            });

            if (!result.success) throw new Error(result.error || '取得員工排班失敗');
            return result.data;
        } catch (error) {
            console.error('取得員工排班錯誤:', error);
            throw error;
        }
    }

    /**
     * 儲存排班表
     */
    async saveSchedule(month, scheduleData) {
        try {
            const { unit } = await this.getCurrentUnitAndUser();
            const result = await this.post('saveSchedule', {
                scheduleSheetId: unit.schedule_sheet_id,
                month: month,
                scheduleData: scheduleData
            });

            if (!result.success) throw new Error(result.error || '儲存排班表失敗');
            return result.data;
        } catch (error) {
            console.error('儲存排班表錯誤:', error);
            throw error;
        }
    }

    /**
     * 更新單一儲存格
     */
    async updateCell(month, staffId, date, shift) {
        try {
            const { unit, user } = await this.getCurrentUnitAndUser();
            const result = await this.post('updateCell', {
                scheduleSheetId: unit.schedule_sheet_id,
                month: month,
                staffId: staffId,
                date: date,
                shift: shift,
                updatedBy: user ? user.displayName : 'Unknown'
            });

            if (!result.success) throw new Error(result.error || '更新排班失敗');
            return result.data;
        } catch (error) {
            console.error('更新排班錯誤:', error);
            throw error;
        }
    }

    /**
     * 取得排班統計
     */
    async getScheduleStatistics(month, staffId = null) {
        try {
            const { unit } = await this.getCurrentUnitAndUser();
            const result = await this.post('getScheduleStatistics', {
                scheduleSheetId: unit.schedule_sheet_id,
                month: month,
                staffId: staffId
            });

            if (!result.success) throw new Error(result.error || '取得排班統計失敗');
            return result.data;
        } catch (error) {
            console.error('取得排班統計錯誤:', error);
            throw error;
        }
    }

    /**
     * 公告排班表
     */
    async publishSchedule(month) {
        try {
            const { unit, user } = await this.getCurrentUnitAndUser();
            const result = await this.post('publishSchedule', {
                scheduleSheetId: unit.schedule_sheet_id,
                month: month,
                publishedBy: user.displayName
            });

            if (!result.success) throw new Error(result.error || '公告排班表失敗');
            return result.data;
        } catch (error) {
            console.error('公告排班表錯誤:', error);
            throw error;
        }
    }

    /**
     * 取得異動記錄
     */
    async getChangeHistory(month, staffId = null) {
        try {
            const { unit } = await this.getCurrentUnitAndUser();
            const result = await this.post('getChangeHistory', {
                scheduleSheetId: unit.schedule_sheet_id,
                month: month,
                staffId: staffId
            });

            if (!result.success) throw new Error(result.error || '取得異動記錄失敗');
            return result.data;
        } catch (error) {
            console.error('取得異動記錄錯誤:', error);
            throw error;
        }
    }

    /**
     * 記錄異動
     */
    async logChange(month, changeData) {
        try {
            const { unit, user } = await this.getCurrentUnitAndUser();
            const result = await this.post('logChange', {
                scheduleSheetId: unit.schedule_sheet_id,
                month: month,
                changeData: {
                    ...changeData,
                    changedBy: user.displayName,
                    changedAt: new Date().toISOString()
                }
            });

            if (!result.success) throw new Error(result.error || '記錄異動失敗');
            return result.data;
        } catch (error) {
            console.error('記錄異動錯誤:', error);
            throw error;
        }
    }

    /**
     * 清空排班表
     */
    async clearSchedule(month) {
        try {
            const { unit } = await this.getCurrentUnitAndUser();
            const result = await this.post('clearSchedule', {
                scheduleSheetId: unit.schedule_sheet_id,
                month: month
            });

            if (!result.success) throw new Error(result.error || '清空排班表失敗');
            return result.data;
        } catch (error) {
            console.error('清空排班表錯誤:', error);
            throw error;
        }
    }

    /**
     * 複製上月排班
     */
    async copyPreviousMonth(month) {
        try {
            const { unit } = await this.getCurrentUnitAndUser();
            
            // 計算上月
            const year = parseInt(month.substring(0, 4));
            const monthNum = parseInt(month.substring(4, 6));
            const prevYear = monthNum === 1 ? year - 1 : year;
            const prevMonth = monthNum === 1 ? 12 : monthNum - 1;
            const prevMonthStr = `${prevYear}${prevMonth.toString().padStart(2, '0')}`;
            
            const result = await this.post('copySchedule', {
                scheduleSheetId: unit.schedule_sheet_id,
                sourceMonth: prevMonthStr,
                targetMonth: month
            });

            if (!result.success) throw new Error(result.error || '複製上月排班失敗');
            return result.data;
        } catch (error) {
            console.error('複製上月排班錯誤:', error);
            throw error;
        }
    }

    /**
     * 匯出排班表
     */
    async exportSchedule(month, format = 'excel') {
        try {
            const { unit } = await this.getCurrentUnitAndUser();
            const result = await this.post('exportSchedule', {
                scheduleSheetId: unit.schedule_sheet_id,
                month: month,
                format: format
            });

            if (!result.success) throw new Error(result.error || '匯出排班表失敗');
            return result.data;
        } catch (error) {
            console.error('匯出排班表錯誤:', error);
            throw error;
        }
    }

    /**
     * 取得前月後6天資料（用於顯示）
     */
    async getPreviousMonthLastDays(month) {
        try {
            const year = parseInt(month.substring(0, 4));
            const monthNum = parseInt(month.substring(4, 6));
            const prevYear = monthNum === 1 ? year - 1 : year;
            const prevMonth = monthNum === 1 ? 12 : monthNum - 1;
            const prevMonthStr = `${prevYear}${prevMonth.toString().padStart(2, '0')}`;
            
            const scheduleData = await this.getSchedule(prevMonthStr);
            
            // 只返回最後6天
            const daysInPrevMonth = new Date(prevYear, prevMonth, 0).getDate();
            const lastSixDays = {};
            
            for (let day = daysInPrevMonth - 5; day <= daysInPrevMonth; day++) {
                const dateKey = `${prevMonthStr}${day.toString().padStart(2, '0')}`;
                if (scheduleData && scheduleData[dateKey]) {
                    lastSixDays[dateKey] = scheduleData[dateKey];
                }
            }
            
            return lastSixDays;
        } catch (error) {
            console.error('取得前月資料錯誤:', error);
            return {};
        }
    }

    /**
     * 檢查排班衝突
     */
    async checkConflicts(month, scheduleData) {
        try {
            const { unit } = await this.getCurrentUnitAndUser();
            const result = await this.post('checkConflicts', {
                scheduleSheetId: unit.schedule_sheet_id,
                settingsSheetId: unit.settings_sheet_id,
                month: month,
                scheduleData: scheduleData
            });

            if (!result.success) throw new Error(result.error || '檢查排班衝突失敗');
            return result.data;
        } catch (error) {
            console.error('檢查排班衝突錯誤:', error);
            throw error;
        }
    }

    /**
     * 計算班別工時 (純前端邏輯)
     */
    calculateShiftHours(shift) {
        const shiftHours = {
            '大': 10,
            '小': 8,
            '白': 8,
            'DL': 8,
            'FF': 0
        };
        return shiftHours[shift] || 0;
    }

    /**
     * 檢查是否為接班順序 (純前端邏輯)
     */
    isValidShiftOrder(prevShift, currentShift) {
        const shiftOrder = { 'FF': 1, '大': 2, '白': 3, '小': 4, 'DL': 4 };
        const prevOrder = shiftOrder[prevShift] || 0;
        const currentOrder = shiftOrder[currentShift] || 0;
        if (prevShift === 'FF') return true;
        return currentOrder >= prevOrder;
    }

    /**
     * 計算連續工作天數
     */
    calculateConsecutiveDays(scheduleArray) {
        let maxConsecutive = 0;
        let currentConsecutive = 0;
        scheduleArray.forEach(shift => {
            if (shift && shift !== 'FF') {
                currentConsecutive++;
                maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
            } else {
                currentConsecutive = 0;
            }
        });
        return maxConsecutive;
    }

    /**
     * 統計班別天數
     */
    countShifts(scheduleArray) {
        const counts = { 'FF': 0, '大': 0, '小': 0, '白': 0, 'DL': 0, '總工作天數': 0, '假日上班': 0 };
        scheduleArray.forEach(shift => {
            if (shift) {
                counts[shift] = (counts[shift] || 0) + 1;
                if (shift !== 'FF') counts['總工作天數']++;
            }
        });
        return counts;
    }

    formatDate(dateStr) {
        if (dateStr.length !== 8) return dateStr;
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        return `${year}/${month}/${day}`;
    }

    getDaysInMonth(month) {
        const year = parseInt(month.substring(0, 4));
        const monthNum = parseInt(month.substring(4, 6));
        return new Date(year, monthNum, 0).getDate();
    }

    getDayOfWeek(dateStr) {
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1;
        const day = parseInt(dateStr.substring(6, 8));
        return new Date(year, month, day).getDay();
    }
}
