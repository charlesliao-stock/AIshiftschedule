/**
 * 排班服務層
 * 處理所有排班相關的 API 呼叫
 */

import { API_CONFIG } from '../config/api.config.js';
import { getCurrentUser, getCurrentUnit } from '../core/auth.js';

class ScheduleService {
    constructor() {
        this.apiBaseUrl = API_CONFIG.scheduleApiUrl;
    }

    /**
     * 取得排班表
     */
    async getSchedule(month) {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'getSchedule',
                    scheduleSheetId: unit.schedule_sheet_id,
                    month: month
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '取得排班表失敗');
            }

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
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'getStaffSchedule',
                    scheduleSheetId: unit.schedule_sheet_id,
                    month: month,
                    staffId: staffId
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '取得員工排班失敗');
            }

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
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'saveSchedule',
                    scheduleSheetId: unit.schedule_sheet_id,
                    month: month,
                    scheduleData: scheduleData
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '儲存排班表失敗');
            }

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
            const unit = await getCurrentUnit();
            const user = await getCurrentUser();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'updateCell',
                    scheduleSheetId: unit.schedule_sheet_id,
                    month: month,
                    staffId: staffId,
                    date: date,
                    shift: shift,
                    updatedBy: user.displayName
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '更新排班失敗');
            }

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
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'getScheduleStatistics',
                    scheduleSheetId: unit.schedule_sheet_id,
                    month: month,
                    staffId: staffId
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '取得排班統計失敗');
            }

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
            const unit = await getCurrentUnit();
            const user = await getCurrentUser();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'publishSchedule',
                    scheduleSheetId: unit.schedule_sheet_id,
                    month: month,
                    publishedBy: user.displayName
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '公告排班表失敗');
            }

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
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'getChangeHistory',
                    scheduleSheetId: unit.schedule_sheet_id,
                    month: month,
                    staffId: staffId
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '取得異動記錄失敗');
            }

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
            const unit = await getCurrentUnit();
            const user = await getCurrentUser();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'logChange',
                    scheduleSheetId: unit.schedule_sheet_id,
                    month: month,
                    changeData: {
                        ...changeData,
                        changedBy: user.displayName,
                        changedAt: new Date().toISOString()
                    }
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '記錄異動失敗');
            }

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
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'clearSchedule',
                    scheduleSheetId: unit.schedule_sheet_id,
                    month: month
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '清空排班表失敗');
            }

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
            const unit = await getCurrentUnit();
            
            // 計算上月
            const year = parseInt(month.substring(0, 4));
            const monthNum = parseInt(month.substring(4, 6));
            const prevYear = monthNum === 1 ? year - 1 : year;
            const prevMonth = monthNum === 1 ? 12 : monthNum - 1;
            const prevMonthStr = `${prevYear}${prevMonth.toString().padStart(2, '0')}`;
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'copySchedule',
                    scheduleSheetId: unit.schedule_sheet_id,
                    sourceMonth: prevMonthStr,
                    targetMonth: month
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '複製上月排班失敗');
            }

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
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'exportSchedule',
                    scheduleSheetId: unit.schedule_sheet_id,
                    month: month,
                    format: format
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '匯出排班表失敗');
            }

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
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'checkConflicts',
                    scheduleSheetId: unit.schedule_sheet_id,
                    settingsSheetId: unit.settings_sheet_id,
                    month: month,
                    scheduleData: scheduleData
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '檢查排班衝突失敗');
            }

            return result.data;

        } catch (error) {
            console.error('檢查排班衝突錯誤:', error);
            throw error;
        }
    }

    /**
     * 計算班別工時
     */
    calculateShiftHours(shift) {
        // 班別工時對照表
        const shiftHours = {
            '大': 10,    // 大夜 22:00-08:00
            '小': 8,     // 小夜 14:00-22:00
            '白': 8,     // 白班 08:00-16:00
            'DL': 8,     // DL 14:00-22:00
            'FF': 0      // 休假
        };

        return shiftHours[shift] || 0;
    }

    /**
     * 檢查是否為接班順序
     */
    isValidShiftOrder(prevShift, currentShift) {
        // 接班順序規則: FF -> 大 -> 白 -> 小/DL
        const shiftOrder = {
            'FF': 1,
            '大': 2,
            '白': 3,
            '小': 4,
            'DL': 4
        };

        const prevOrder = shiftOrder[prevShift] || 0;
        const currentOrder = shiftOrder[currentShift] || 0;

        // FF 後可以接任何班別
        if (prevShift === 'FF') return true;

        // 同班別或順向接班
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
        const counts = {
            'FF': 0,
            '大': 0,
            '小': 0,
            '白': 0,
            'DL': 0,
            '總工作天數': 0,
            '假日上班': 0
        };

        scheduleArray.forEach(shift => {
            if (shift) {
                counts[shift] = (counts[shift] || 0) + 1;
                if (shift !== 'FF') {
                    counts['總工作天數']++;
                }
            }
        });

        return counts;
    }

    /**
     * 格式化日期
     */
    formatDate(dateStr) {
        if (dateStr.length !== 8) return dateStr;
        
        const year = dateStr.substring(0, 4);
        const month = dateStr.substring(4, 6);
        const day = dateStr.substring(6, 8);
        
        return `${year}/${month}/${day}`;
    }

    /**
     * 取得月份天數
     */
    getDaysInMonth(month) {
        const year = parseInt(month.substring(0, 4));
        const monthNum = parseInt(month.substring(4, 6));
        return new Date(year, monthNum, 0).getDate();
    }

    /**
     * 取得星期幾
     */
    getDayOfWeek(dateStr) {
        const year = parseInt(dateStr.substring(0, 4));
        const month = parseInt(dateStr.substring(4, 6)) - 1;
        const day = parseInt(dateStr.substring(6, 8));
        return new Date(year, month, day).getDay();
    }
}

// 匯出
export { ScheduleService };