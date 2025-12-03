/**
 * js/services/schedule.service.js
 * 排班資料服務 (含自動化分散備份邏輯)
 */
import { FirebaseService } from './firebase.service.js';
import { SheetsService } from './sheets.service.js';
import { UnitService } from './unit.service.js'; // 需要讀寫單位資料

export const ScheduleService = {
    
    // ... (getSchedule, saveSchedule 保持不變，請沿用上一段提供的代碼) ...

    async getSchedule(unitId, month) {
        // ... (同前次提供之代碼) ...
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
        // ... (同前次提供之代碼) ...
        const docId = scheduleData.id || `${scheduleData.month}_${scheduleData.unitId}`;
        await FirebaseService.setDocument('schedules', docId, scheduleData);
        return true;
    },

    /**
     * 🔥 核心修改：智慧型備份
     * 自動判斷是否需要建立新檔案
     */
    async backupToSheets(scheduleData) {
        try {
            console.log(`[Schedule] 準備備份 ${scheduleData.unitId} 的 ${scheduleData.month} 班表...`);
            
            // 1. 先取得該單位的設定，看有沒有備份檔案 ID
            const unit = await UnitService.getUnitById(scheduleData.unitId);
            let sheetId = unit.backupSheetId;
            let isNewFile = false;

            // 2. 如果沒有 ID，代表是第一次備份，呼叫 GAS 建立新檔案
            if (!sheetId) {
                console.log('[Schedule] 該單位尚無備份檔案，請求 GAS 建立...');
                const createResult = await SheetsService.post({
                    action: 'createBackupFile', // 對應後端新功能
                    fileName: `${unit.name}_排班備份` // 檔名：例如 "第一加護病房_排班備份"
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
                spreadsheetId: sheetId, // 指定寫入這個單位的專屬檔案
                month: scheduleData.month,
                unitId: scheduleData.unitId, // 這裡僅作標記用
                data: scheduleData.shifts
            });
            
            const msg = isNewFile ? '已建立新備份檔並完成備份' : '備份成功';
            return { success: true, message: msg };

        } catch (error) {
            console.error('[Schedule] 備份流程失敗:', error);
            // 這裡回傳 false 讓前端可以顯示 "備份失敗，請稍後再試"
            return { success: false, message: error.message };
        }
    }
};
