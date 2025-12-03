/**
 * js/modules/schedule/schedule-check.js
 * 排班規則檢查器
 * 負責檢查班表是否符合勞基法與醫院規則
 */

// ✅ 修正點：加上大括號 { } 改為具名匯入
import { Notification } from '../../components/notification.js';
import { CONSTANTS } from '../../config/constants.js';

export const ScheduleCheck = {
    /**
     * 檢查單一使用者的班表規則
     * @param {object} userShifts 該使用者的所有班別 { "01": "D", "02": "N" ... }
     * @param {object} rules 該單位的排班規則
     */
    validateUserSchedule(userShifts, rules = {}) {
        const errors = [];
        const warnings = [];
        
        // --- 範例檢查邏輯 ---
        
        // 1. 檢查連續上班天數 (範例：不可超過 6 天)
        // 這只是簡單示範，實際邏輯需依照您的規則擴充
        let consecutiveDays = 0;
        const maxConsecutive = rules.maxConsecutiveWork || 6;

        for (let day = 1; day <= 31; day++) {
            const dateKey = String(day).padStart(2, '0');
            const shift = userShifts[dateKey];

            if (shift && shift !== 'OFF') {
                consecutiveDays++;
            } else {
                consecutiveDays = 0;
            }

            if (consecutiveDays > maxConsecutive) {
                const msg = `第 ${day} 天：連續上班超過 ${maxConsecutive} 天`;
                errors.push(msg);
                // 這裡可以安全地呼叫 Notification，因為引用已修正
                // Notification.warning(msg); 
            }
        }

        return { errors, warnings };
    },

    /**
     * 檢查整體班表 (每日人力需求)
     * @param {object} dailyStaffCounts 每日各班別的人數統計
     * @param {object} requirements 每日人力需求設定
     */
    validateDailyCoverage(dailyStaffCounts, requirements) {
        const errors = [];
        
        // 範例：檢查每一天的人力是否足夠
        // ... (邏輯待實作)

        return errors;
    }
};
