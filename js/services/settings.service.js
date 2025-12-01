/**
 * 設定服務層
 * 處理所有設定相關的 API 呼叫
 */

import { API_CONFIG } from '../config/api.config.js';
import { getCurrentUnit } from '../core/auth.js';

class SettingsService {
    constructor() {
        this.apiBaseUrl = API_CONFIG.settingsApiUrl;
    }

    /**
     * 取得班別列表
     */
    async getShifts() {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
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
     * 儲存班別
     */
    async saveShift(shift) {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'saveShift',
                    settingsSheetId: unit.settings_sheet_id,
                    shift: shift
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '儲存班別失敗');
            }

            return result.data;

        } catch (error) {
            console.error('儲存班別錯誤:', error);
            throw error;
        }
    }

    /**
     * 刪除班別
     */
    async deleteShift(shiftId) {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'deleteShift',
                    settingsSheetId: unit.settings_sheet_id,
                    shiftId: shiftId
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '刪除班別失敗');
            }

            return result.data;

        } catch (error) {
            console.error('刪除班別錯誤:', error);
            throw error;
        }
    }

    /**
     * 取得組別列表
     */
    async getGroups() {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'getGroups',
                    settingsSheetId: unit.settings_sheet_id
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '取得組別列表失敗');
            }

            return result.data;

        } catch (error) {
            console.error('取得組別列表錯誤:', error);
            throw error;
        }
    }

    /**
     * 儲存組別
     */
    async saveGroup(group) {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'saveGroup',
                    settingsSheetId: unit.settings_sheet_id,
                    group: group
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '儲存組別失敗');
            }

            return result.data;

        } catch (error) {
            console.error('儲存組別錯誤:', error);
            throw error;
        }
    }

    /**
     * 刪除組別
     */
    async deleteGroup(groupId) {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'deleteGroup',
                    settingsSheetId: unit.settings_sheet_id,
                    groupId: groupId
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '刪除組別失敗');
            }

            return result.data;

        } catch (error) {
            console.error('刪除組別錯誤:', error);
            throw error;
        }
    }

    /**
     * 取得員工列表
     */
    async getStaff() {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
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
                throw new Error(result.error || '取得員工列表失敗');
            }

            return result.data;

        } catch (error) {
            console.error('取得員工列表錯誤:', error);
            throw error;
        }
    }

    /**
     * 儲存員工
     */
    async saveStaff(staff) {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'saveStaff',
                    settingsSheetId: unit.settings_sheet_id,
                    staff: staff
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '儲存員工失敗');
            }

            return result.data;

        } catch (error) {
            console.error('儲存員工錯誤:', error);
            throw error;
        }
    }

    /**
     * 批次匯入員工
     */
    async importStaff(staffList) {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'importStaff',
                    settingsSheetId: unit.settings_sheet_id,
                    staffList: staffList
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '批次匯入員工失敗');
            }

            return result.data;

        } catch (error) {
            console.error('批次匯入員工錯誤:', error);
            throw error;
        }
    }

    /**
     * 刪除員工
     */
    async deleteStaff(staffId) {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'deleteStaff',
                    settingsSheetId: unit.settings_sheet_id,
                    staffId: staffId
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '刪除員工失敗');
            }

            return result.data;

        } catch (error) {
            console.error('刪除員工錯誤:', error);
            throw error;
        }
    }

    /**
     * 取得排班規則
     */
    async getRules() {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
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
     * 儲存排班規則
     */
    async saveRules(rules) {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'saveRules',
                    settingsSheetId: unit.settings_sheet_id,
                    rules: rules
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '儲存排班規則失敗');
            }

            return result.data;

        } catch (error) {
            console.error('儲存排班規則錯誤:', error);
            throw error;
        }
    }

    /**
     * 取得週間人數需求
     */
    async getRequirements() {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'getRequirements',
                    settingsSheetId: unit.settings_sheet_id
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '取得週間人數需求失敗');
            }

            return result.data;

        } catch (error) {
            console.error('取得週間人數需求錯誤:', error);
            throw error;
        }
    }

    /**
     * 儲存週間人數需求
     */
    async saveRequirements(requirements) {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'saveRequirements',
                    settingsSheetId: unit.settings_sheet_id,
                    requirements: requirements
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '儲存週間人數需求失敗');
            }

            return result.data;

        } catch (error) {
            console.error('儲存週間人數需求錯誤:', error);
            throw error;
        }
    }

    /**
     * 取得假日設定
     */
    async getHolidays() {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'getHolidays',
                    settingsSheetId: unit.settings_sheet_id
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '取得假日設定失敗');
            }

            return result.data;

        } catch (error) {
            console.error('取得假日設定錯誤:', error);
            throw error;
        }
    }

    /**
     * 儲存假日設定
     */
    async saveHoliday(holiday) {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'saveHoliday',
                    settingsSheetId: unit.settings_sheet_id,
                    holiday: holiday
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '儲存假日設定失敗');
            }

            return result.data;

        } catch (error) {
            console.error('儲存假日設定錯誤:', error);
            throw error;
        }
    }

    /**
     * 刪除假日設定
     */
    async deleteHoliday(holidayId) {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'deleteHoliday',
                    settingsSheetId: unit.settings_sheet_id,
                    holidayId: holidayId
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '刪除假日設定失敗');
            }

            return result.data;

        } catch (error) {
            console.error('刪除假日設定錯誤:', error);
            throw error;
        }
    }

    /**
     * 取得勞基法規範設定
     */
    async getLaborLawSettings() {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'getLaborLawSettings',
                    settingsSheetId: unit.settings_sheet_id
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '取得勞基法規範設定失敗');
            }

            return result.data;

        } catch (error) {
            console.error('取得勞基法規範設定錯誤:', error);
            throw error;
        }
    }

    /**
     * 儲存勞基法規範設定
     */
    async saveLaborLawSettings(settings) {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'saveLaborLawSettings',
                    settingsSheetId: unit.settings_sheet_id,
                    settings: settings
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '儲存勞基法規範設定失敗');
            }

            return result.data;

        } catch (error) {
            console.error('儲存勞基法規範設定錯誤:', error);
            throw error;
        }
    }

    /**
     * 取得通知設定
     */
    async getNotificationSettings() {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'getNotificationSettings',
                    settingsSheetId: unit.settings_sheet_id
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '取得通知設定失敗');
            }

            return result.data;

        } catch (error) {
            console.error('取得通知設定錯誤:', error);
            throw error;
        }
    }

    /**
     * 儲存通知設定
     */
    async saveNotificationSettings(settings) {
        try {
            const unit = await getCurrentUnit();
            
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'saveNotificationSettings',
                    settingsSheetId: unit.settings_sheet_id,
                    settings: settings
                })
            });

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '儲存通知設定失敗');
            }

            return result.data;

        } catch (error) {
            console.error('儲存通知設定錯誤:', error);
            throw error;
        }
    }

    /**
     * 檢查某個日期是否為假日
     */
    async isHoliday(date) {
        try {
            const holidays = await this.getHolidays();
            
            // 檢查國定假日
            const dateStr = this.formatDate(date);
            if (holidays.some(h => h.date === dateStr && h.enabled)) {
                return true;
            }

            // 檢查週末
            const dayOfWeek = new Date(date).getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                return holidays.some(h => 
                    h.type === '固定週期' && 
                    h.enabled &&
                    ((dayOfWeek === 0 && h.name === '週末') || (dayOfWeek === 6 && h.name === '週末'))
                );
            }

            return false;

        } catch (error) {
            console.error('檢查假日錯誤:', error);
            return false;
        }
    }

    /**
     * 格式化日期為 YYYY-MM-DD
     */
    formatDate(date) {
        if (typeof date === 'string' && date.length === 8) {
            // YYYYMMDD 格式
            return `${date.substring(0, 4)}-${date.substring(4, 6)}-${date.substring(6, 8)}`;
        }
        
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
}

// 匯出
export { SettingsService };