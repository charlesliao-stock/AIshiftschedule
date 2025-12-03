/**
 * js/services/sheets.service.js
 * Google Sheets 服務 (角色轉型：備份與匯出專用)
 */
import { API_CONFIG } from '../config/api.config.js';
import { Auth } from '../core/auth.js';

export const SheetsService = {
    /**
     * 發送請求到 GAS (用於備份或匯出)
     */
    async post(payload) {
        // 從 Config 或 Auth 取得設定的備份試算表 ID
        // 如果沒有設定，使用預設值
        const targetSheetId = API_CONFIG.TEST_SHEET_ID; 

        const requestData = {
            ...payload,
            spreadsheetId: targetSheetId, // 告訴 GAS 要寫去哪本試算表
            user: Auth.getCurrentUser()?.email,
            token: await Auth.getToken()
        };

        try {
            // 使用 text/plain 避免 CORS preflight 問題 (GAS 常見技巧)
            const response = await fetch(API_CONFIG.BASE_URL, {
                method: 'POST',
                body: JSON.stringify(requestData)
            });

            const result = await response.json();
            if (result.status === 'error') throw new Error(result.message);
            return result.data;
        } catch (error) {
            console.error('[Sheets] 備份/匯出請求失敗:', error);
            throw error; // 備份失敗需要讓使用者知道
        }
    }
};
