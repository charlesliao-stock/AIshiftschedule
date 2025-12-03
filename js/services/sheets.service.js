/**
 * js/services/sheets.service.js
 * Google Sheets 服務 (ES Module 版 - 修正版)
 */

import { API_CONFIG } from '../config/api.config.js';
import { Utils } from '../core/utils.js';

export const SheetsService = {
    baseUrl: API_CONFIG.BASE_URL,
    requestCache: new Map(),
    cacheTimeout: 5 * 60 * 1000, 
    
    // 統一入口：直接呼叫 GAS Web App
    async request(action, data = {}, options = {}) {
        const {
            useCache = false,
            timeout = API_CONFIG.REQUEST?.TIMEOUT || 30000
        } = options;
        
        // 檢查必要參數
        if (!action) {
            console.error('[Sheets] 請求錯誤: action 為空');
            throw new Error('Action is required');
        }

        const cacheKey = action + ':' + JSON.stringify(data);
        if (useCache) {
            const cached = this.getCache(cacheKey);
            if (cached) return cached;
        }
        
        try {
            // 建構 Payload
            const payload = {
                action: action, // 關鍵：確保 action 存在
                ...data
            };
            
            console.log(`[Sheets] 發送請求: ${action}`, payload);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' }, // 避開 CORS option request
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            // 處理 GAS 回傳的錯誤
            if (result.status === 'error' || result.success === false) {
                throw new Error(result.message || result.error || 'GAS Error');
            }
            
            if (useCache) this.setCache(cacheKey, result);
            
            return result;
            
        } catch (error) {
            console.error(`[Sheets] 請求失敗 (${action}):`, error);
            // 包裝錯誤訊息以便前端顯示
            if (error.name === 'AbortError') throw new Error('請求逾時');
            throw error;
        }
    },
    
    // 簡化呼叫
    async post(action, data = {}) {
        return await this.request(action, data);
    },
    
    // ... (Cache 相關方法保持不變，請保留原檔的 getCache, setCache) ...
    getCache(key) {
        const cached = this.requestCache.get(key);
        if (!cached) return null;
        if (Date.now() - cached.timestamp > this.cacheTimeout) {
            this.requestCache.delete(key);
            return null;
        }
        return cached.data;
    },
    
    setCache(key, result) {
        this.requestCache.set(key, {
            data: result,
            timestamp: Date.now()
        });
    },

    clearCache(prefix = null) {
        if (prefix) {
            for (const key of this.requestCache.keys()) {
                if (key.includes(prefix)) this.requestCache.delete(key);
            }
        } else {
            this.requestCache.clear();
        }
    }
};
