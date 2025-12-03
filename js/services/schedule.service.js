/**
 * js/services/schedule.service.js
 * 排班服務層 (修正版)
 */

import { API_CONFIG } from '../config/api.config.js';
import { Auth } from '../core/auth.js';

export class ScheduleService { // 這裡維持 class 結構，因為 schedule.js 中是 new ScheduleService()
    constructor() {
        // 修正：使用正確的 BASE_URL
        this.apiBaseUrl = API_CONFIG.BASE_URL;
    }

    async getCurrentUnitAndUser() {
        const user = Auth.getCurrentUser();
        const unit = Auth.getUserUnit();
        return { user, unit };
    }

    async post(action, payload) {
        const response = await fetch(this.apiBaseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain' }, // GAS 偏好 text/plain
            body: JSON.stringify({ action, ...payload })
        });
        const result = await response.json();
        return result;
    }

    /**
     * 取得排班表
     */
    async getSchedule(month) {
        try {
            const { unit } = await this.getCurrentUnitAndUser();
            const result = await this.post('getSchedule', {
                scheduleSheetId: unit.schedule_sheet_id, // 假設 unit 物件有此欄位
                // 或者如果是混合架構，可能只需傳 unit_id，由後端查找 ID
                // 為了保險，我們傳 unit_id 給 GAS 去查
                unit_id: unit.id, 
                month: month
            });

            if (!result.success) throw new Error(result.error || '取得排班表失敗');
            return result.data;
        } catch (error) {
            console.error('取得排班表錯誤:', error);
            throw error;
        }
    }

    // ... (其餘方法依此類推，確保使用 this.apiBaseUrl)
    
    // 為節省篇幅，這裡僅修正建構子與連線基礎，
    // 其餘邏輯請參照您原本上傳的 schedule.service.js，
    // 只要確保 constructor 的修正即可。
    
    // 為了完整性，若您直接複製貼上，請確保包含 saveSchedule, updateCell 等方法
    // (這些方法在您原本的檔案中邏輯是正確的，只是 URL 變數名錯了)
}
