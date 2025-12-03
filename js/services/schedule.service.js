/**
 * js/services/schedule.service.js
 * 排班資料服務 (含自動化分散備份邏輯)
 */
import { FirebaseService } from './firebase.service.js';
import { SheetsService } from './sheets.service.js';
import { UnitService } from './unit.service.js';
import { CONSTANTS } from '../config/constants.js';
import { Notification } from '../components/notification.js';

export const ScheduleService = {
    
    // ==================== 基本讀寫操作 ====================

    async getSchedule(unitId, month) {
        const docId = `${month}_${unitId}`;
        const schedule = await FirebaseService.getDocument('schedules', docId);
        if (!schedule) {
            return {
                id: docId,
                month: month,
                unitId: unitId,
                status: 'draft',
                shifts: {},
                requests: {}
            };
        }
        return schedule;
    },

    async saveSchedule(scheduleData) {
        const docId = scheduleData.id || `${scheduleData.month}_${scheduleData.unitId}`;
        await FirebaseService.setDocument('schedules', docId, scheduleData);
        return true;
    },

    // ==================== 備份功能 (Sheets Integration) ====================

    /**
     * 智慧型備份：自動判斷是否需要建立新檔案
     * @param {object} scheduleData 班表資料物件
     */
    async backupToSheets(scheduleData) {
        try {
            console.log(`[Schedule] 準備備份 ${scheduleData.unitId} 的 ${scheduleData.month} 班表...`);
            
            // 1. 先取得該單位的設定，看有沒有備份檔案 ID
            const unit = await UnitService.getUnitById(scheduleData.unitId);
            if (!unit) throw new Error('找不到單位資料');

            let sheetId = unit.backupSheetId;
            let isNewFile = false;

            // 2. 如果沒有 ID，代表是第一次備份，呼叫 GAS 建立新檔案
            if (!sheetId) {
                console.log('[Schedule] 該單位尚無備份檔案，請求 GAS 建立...');
                const createResult = await SheetsService.post({
                    action: 'createBackupFile', 
                    fileName: `${unit.name}_排班備份` 
                });

                sheetId = createResult.spreadsheetId;
                isNewFile = true;

                // 3. 將新產生的 ID 存回 Firestore Unit 資料，永久綁定
                await UnitService.updateUnit(unit.id, { backupSheetId: sheetId });
                console.log(`[Schedule] 新檔案已建立 (ID: ...${sheetId.slice(-6)}) 並綁定至單位`);
            }

            // 4. 執行備份寫入 (寫入特定的 sheetId)
            await SheetsService.post({
                action: 'backupSchedule',
                spreadsheetId: sheetId,
                month: scheduleData.month,
                unitId: scheduleData.unitId,
                data: scheduleData.shifts
            });
            
            const msg = isNewFile ? '已建立新備份檔並完成備份' : '備份成功';
            return { success: true, message: msg };

        } catch (error) {
            console.error('[Schedule] 備份流程失敗:', error);
            return { success: false, message: error.message };
        }
    },

    /**
     * 🔥 自動備份檢查與執行
     * 在 Admin 登入時呼叫，檢查是否需要備份上個月的班表
     */
    async checkAndRunAutoBackup() {
        try {
            // 1. 計算「上個月」是哪個月 (Target Month)
            const today = new Date();
            const currentDay = today.getDate();
            const backupDay = CONSTANTS.SYSTEM_CONFIG?.AUTO_BACKUP_DAY || 5;

            // 如果今天還沒到備份日 (例如 1 號)，跳過
            if (currentDay < backupDay) return;

            // 計算上個月的 YYYY-MM
            // new Date(年, 月-1, 1) -> JS 的月份是 0-11，所以 today.getMonth() 就是當月
            // 我們要找上個月，就是 today.getMonth() - 1
            const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const targetMonth = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;

            // 2. 檢查系統紀錄，看 Target Month 是否已經備份過
            const logDoc = await FirebaseService.getDocument('system_settings', 'backup_logs');
            const logs = logDoc?.history || {};

            if (logs[targetMonth] === true) {
                // 已備份過，安靜退出
                return;
            }

            // 3. 開始執行備份
            console.log(`[AutoBackup] 啟動自動備份任務：目標月份 ${targetMonth}`);
            Notification.info(`正在背景備份 ${targetMonth} 班表...`);

            const units = await UnitService.getAllUnits();
            let successCount = 0;

            const backupPromises = units.map(async (unit) => {
                try {
                    // 讀取該單位上個月的班表
                    const schedule = await this.getSchedule(unit.id, targetMonth);
                    
                    // 只有當班表有實質內容時才備份 (避免備份一堆空殼)
                    // 簡單判斷: 有 shifts 資料
                    if (schedule && schedule.shifts && Object.keys(schedule.shifts).length > 0) {
                        await this.backupToSheets(schedule);
                        successCount++;
                    }
                } catch (err) {
                    console.error(`[AutoBackup] 單位 ${unit.name} 備份失敗:`, err);
                }
            });

            await Promise.all(backupPromises);

            // 4. 寫入完成紀錄
            await FirebaseService.setDocument('system_settings', 'backup_logs', {
                history: {
                    ...logs,
                    [targetMonth]: true
                },
                last_run: new Date().toISOString()
            }, true); // merge

            if (successCount > 0) {
                Notification.success(`自動備份完成！已處理 ${successCount} 個單位的 ${targetMonth} 班表。`);
            } else {
                console.log(`[AutoBackup] ${targetMonth} 無有效班表需備份。`);
                // 即使沒東西備份，也標記為已處理，避免下次登入一直跑
                 await FirebaseService.setDocument('system_settings', 'backup_logs', {
                    history: { ...logs, [targetMonth]: true }
                }, true);
            }

        } catch (error) {
            console.error('[AutoBackup] 自動備份流程錯誤:', error);
        }
    }
};
