/**
 * js/services/schedule.service.js
 * 排班資料服務 (Firebase Core + Sheets Backup)
 */
import { FirebaseService } from './firebase.service.js';
import { SheetsService } from './sheets.service.js';

export const ScheduleService = {
    
    /**
     * 取得指定月份的班表
     * ID 格式: YYYY-MM_UnitID
     */
    async getSchedule(unitId, month) {
        const docId = `${month}_${unitId}`;
        const schedule = await FirebaseService.getDocument('schedules', docId);

        // UX: 如果沒資料，回傳一個基本的空結構，而不是 null 或報錯
        if (!schedule) {
            console.log(`[Schedule] 查無 ${docId} 資料，回傳初始結構`);
            return {
                id: docId,
                month: month,
                unitId: unitId,
                status: 'draft', // 草稿狀態
                shifts: {},      // 正式班表
                requests: {}     // 預班需求
            };
        }
        return schedule;
    },

    /**
     * 儲存班表 (寫入 Firebase)
     */
    async saveSchedule(scheduleData) {
        const docId = scheduleData.id || `${scheduleData.month}_${scheduleData.unitId}`;
        
        // 1. 寫入 Firebase (當作主要儲存)
        await FirebaseService.setDocument('schedules', docId, scheduleData);
        console.log('[Schedule] Firebase 儲存成功');

        return true;
    },

    /**
     * 備份班表到 Google Sheets
     * 說明：這會呼叫後端 GAS，GAS 會檢查該試算表是否有對應月份的分頁，沒有則自動建立。
     */
    async backupToSheets(scheduleData) {
        try {
            console.log('[Schedule] 開始備份至 Google Sheets...');
            
            await SheetsService.post({
                action: 'backupSchedule', // 對應 GAS 後端的 function
                month: scheduleData.month,
                unitId: scheduleData.unitId,
                data: scheduleData.shifts // 只備份正式班表
            });
            
            console.log('[Schedule] 備份成功');
            return true;
        } catch (error) {
            console.error('[Schedule] 備份失敗 (不影響主流程):', error);
            return false;
        }
    }
};
