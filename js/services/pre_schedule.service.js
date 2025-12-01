/**
 * 預班服務層
 * 處理所有預班相關的 API 呼叫
 */

import { API_CONFIG } from '../config/api.config.js';
import { getCurrentUser, getCurrentUnit } from '../core/auth.js';

class PreScheduleService {
    constructor() {
        this.apiBaseUrl = API_CONFIG.preScheduleApiUrl;
    }

    /**
     * 取得預班設定
     */
    async getPreScheduleConfig(month) {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'getPreScheduleConfig',
                    preScheduleSheetId: unit.pre_schedule_sheet_id,
                    month: month
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '取得預班設定失敗');
            }

            return result.data;

        } catch (error) {
            console.error('取得預班設定錯誤:', error);
            throw error;
        }
    }

    /**
     * 儲存預班設定
     */
    async savePreScheduleConfig(config) {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'savePreScheduleConfig',
                    preScheduleSheetId: unit.pre_schedule_sheet_id,
                    config: config
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '儲存預班設定失敗');
            }

            return result.data;

        } catch (error) {
            console.error('儲存預班設定錯誤:', error);
            throw error;
        }
    }

    /**
     * 取得員工預班
     */
    async getStaffPreSchedule(month, staffId) {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'getStaffPreSchedule',
                    preScheduleSheetId: unit.pre_schedule_sheet_id,
                    month: month,
                    staffId: staffId
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '取得員工預班失敗');
            }

            return result.data;

        } catch (error) {
            console.error('取得員工預班錯誤:', error);
            throw error;
        }
    }

    /**
     * 提交預班
     */
    async submitPreSchedule(preScheduleData) {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'submitPreSchedule',
                    preScheduleSheetId: unit.pre_schedule_sheet_id,
                    data: preScheduleData
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '提交預班失敗');
            }

            return result.data;

        } catch (error) {
            console.error('提交預班錯誤:', error);
            throw error;
        }
    }

    /**
     * 取得額外預班列表
     */
    async getExtraPreSchedules(month) {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'getExtraPreSchedules',
                    preScheduleSheetId: unit.pre_schedule_sheet_id,
                    month: month
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '取得額外預班失敗');
            }

            return result.data;

        } catch (error) {
            console.error('取得額外預班錯誤:', error);
            throw error;
        }
    }

    /**
     * 新增額外預班
     */
    async addExtraPreSchedule(extraData) {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'addExtraPreSchedule',
                    preScheduleSheetId: unit.pre_schedule_sheet_id,
                    data: extraData
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '新增額外預班失敗');
            }

            return result.data;

        } catch (error) {
            console.error('新增額外預班錯誤:', error);
            throw error;
        }
    }

    /**
     * 移除額外預班
     */
    async removeExtraPreSchedule(month, staffId, date) {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'removeExtraPreSchedule',
                    preScheduleSheetId: unit.pre_schedule_sheet_id,
                    month: month,
                    staffId: staffId,
                    date: date
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '移除額外預班失敗');
            }

            return result.data;

        } catch (error) {
            console.error('移除額外預班錯誤:', error);
            throw error;
        }
    }

    /**
     * 取得每日預班人數
     */
    async getDailyPreScheduleCount(month, date) {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'getDailyPreScheduleCount',
                    preScheduleSheetId: unit.pre_schedule_sheet_id,
                    month: month,
                    date: date
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '取得每日預班人數失敗');
            }

            return result.data.count;

        } catch (error) {
            console.error('取得每日預班人數錯誤:', error);
            throw error;
        }
    }

    /**
     * 取得預班統計
     */
    async getPreScheduleStatistics(month) {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'getPreScheduleStatistics',
                    preScheduleSheetId: unit.pre_schedule_sheet_id,
                    month: month
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '取得預班統計失敗');
            }

            return result.data;

        } catch (error) {
            console.error('取得預班統計錯誤:', error);
            throw error;
        }
    }

    /**
     * 開放預班
     */
    async openPreSchedule(month) {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'openPreSchedule',
                    preScheduleSheetId: unit.pre_schedule_sheet_id,
                    month: month
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '開放預班失敗');
            }

            return result.data;

        } catch (error) {
            console.error('開放預班錯誤:', error);
            throw error;
        }
    }

    /**
     * 截止預班
     */
    async closePreSchedule(month) {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'closePreSchedule',
                    preScheduleSheetId: unit.pre_schedule_sheet_id,
                    month: month
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '截止預班失敗');
            }

            return result.data;

        } catch (error) {
            console.error('截止預班錯誤:', error);
            throw error;
        }
    }

    /**
     * 重新開放預班
     */
    async reopenPreSchedule(month) {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'reopenPreSchedule',
                    preScheduleSheetId: unit.pre_schedule_sheet_id,
                    month: month
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '重新開放預班失敗');
            }

            return result.data;

        } catch (error) {
            console.error('重新開放預班錯誤:', error);
            throw error;
        }
    }

    /**
     * 鎖定預班
     */
    async lockPreSchedule(month) {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'lockPreSchedule',
                    preScheduleSheetId: unit.pre_schedule_sheet_id,
                    month: month
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '鎖定預班失敗');
            }

            return result.data;

        } catch (error) {
            console.error('鎖定預班錯誤:', error);
            throw error;
        }
    }

    /**
     * 取得可用班別列表
     */
    async getAvailableShifts() {
        try {
            // 從設定檔讀取班別定義
            const unit = await getCurrentUnit();
            
            const response = await fetch(API_CONFIG.settingsApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'getShifts',
                    settingsSheetId: unit.settings_sheet_id
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '取得班別列表失敗');
            }

            return result.data;

        } catch (error) {
            console.error('取得班別列表錯誤:', error);
            throw error;
        }
    }

    /**
     * 取得排班規則
     */
    async getRules() {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(API_CONFIG.settingsApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'getRules',
                    settingsSheetId: unit.settings_sheet_id
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '取得排班規則失敗');
            }

            return result.data;

        } catch (error) {
            console.error('取得排班規則錯誤:', error);
            throw error;
        }
    }

    /**
     * 取得員工資料
     */
    async getStaffData() {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(API_CONFIG.settingsApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'getStaff',
                    settingsSheetId: unit.settings_sheet_id
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '取得員工資料失敗');
            }

            return result.data;

        } catch (error) {
            console.error('取得員工資料錯誤:', error);
            throw error;
        }
    }

    /**
     * 取得人數需求
     */
    async getRequirements(month) {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(API_CONFIG.settingsApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'getRequirements',
                    settingsSheetId: unit.settings_sheet_id,
                    month: month
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '取得人數需求失敗');
            }

            return result.data;

        } catch (error) {
            console.error('取得人數需求錯誤:', error);
            throw error;
        }
    }

    /**
     * 取得前月排班資料（用於顯示前6天）
     */
    async getPreviousMonthSchedule(month) {
        try {
            const unit = await getCurrentUnit();
            
            // 計算前一個月
            const year = parseInt(month.substring(0, 4));
            const monthNum = parseInt(month.substring(4, 6));
            const prevYear = monthNum === 1 ? year - 1 : year;
            const prevMonth = monthNum === 1 ? 12 : monthNum - 1;
            const prevMonthStr = `${prevYear}${prevMonth.toString().padStart(2, '0')}`;
            
            const response = await fetch(API_CONFIG.scheduleApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'getSchedule',
                    scheduleSheetId: unit.schedule_sheet_id,
                    month: prevMonthStr
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                // 如果前月沒有排班資料，返回空物件
                return {};
            }

            // 只返回最後6天的資料
            const scheduleData = result.data;
            const lastSixDays = {};
            
            const daysInPrevMonth = new Date(prevYear, prevMonth, 0).getDate();
            for (let day = daysInPrevMonth - 5; day <= daysInPrevMonth; day++) {
                const dateKey = `${prevMonthStr}${day.toString().padStart(2, '0')}`;
                if (scheduleData[dateKey]) {
                    lastSixDays[dateKey] = scheduleData[dateKey];
                }
            }

            return lastSixDays;

        } catch (error) {
            console.error('取得前月排班資料錯誤:', error);
            return {};
        }
    }
}

// 匯出
export { PreScheduleService };