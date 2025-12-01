/**
 * js/services/sheets.service.js
 * Google Sheets 服務 (ES Module 版)
 */

import { API_CONFIG } from '../config/api.config.js';
import { CONSTANTS } from '../config/constants.js'; // 假設 demo data 在這裡或直接寫死
import { Utils } from '../core/utils.js';

export const SheetsService = {
    // 引用 API_CONFIG.BASE_URL
    baseUrl: API_CONFIG.BASE_URL,
    requestCache: new Map(),
    cacheTimeout: 5 * 60 * 1000, // 5 分鐘快取
    
    // ==================== 基礎請求方法 ====================
    
    async request(endpoint, data = {}, options = {}) {
        const {
            method = 'POST',
            useCache = false,
            timeout = API_CONFIG.REQUEST?.TIMEOUT || 30000
        } = options;
        
        // Demo 模式
        if (API_CONFIG.DEMO?.ENABLED) {
            return await this.mockRequest(endpoint, data);
        }
        
        // 檢查快取 (僅限 action 請求且明確要求快取)
        const cacheKey = this.getCacheKey(endpoint, data);
        if (useCache && method === 'POST') { // GAS 統一用 POST
            const cached = this.getCache(cacheKey);
            if (cached) {
                console.log('[Sheets] 使用快取:', endpoint);
                return cached;
            }
        }
        
        try {
            // GAS 只有一個網址，endpoint 其實是 action 參數
            // 我們將 endpoint 視為 action 塞入 payload
            const payload = {
                action: endpoint,
                ...data
            };
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            const response = await fetch(this.baseUrl, {
                method: 'POST',
                headers: API_CONFIG.REQUEST?.HEADERS || { 'Content-Type': 'text/plain' },
                body: JSON.stringify(payload),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            // 檢查業務邏輯錯誤
            if (result.status === 'error' || result.success === false) {
                throw new Error(result.message || result.error || 'Unknown Error');
            }
            
            // 儲存快取
            if (useCache) {
                this.setCache(cacheKey, result);
            }
            
            return result;
            
        } catch (error) {
            console.error('[Sheets] 請求失敗:', error);
            if (error.name === 'AbortError') throw new Error('請求逾時，請稍後再試');
            throw error;
        }
    },
    
    // 簡化介面：直接呼叫 post (因為 GAS Web App 主要是 POST)
    async post(action, data = {}) {
        return await this.request(action, data, { method: 'POST' });
    },
    
    // ==================== 快取管理 ====================
    
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
    },
    
    getCacheKey(endpoint, data) {
        return endpoint + ':' + JSON.stringify(data);
    },
    
    // ==================== Demo 模式模擬 ====================
    
    async mockRequest(action, data) {
        console.log('[Sheets] Demo 模式請求:', action, data);
        await Utils.sleep(API_CONFIG.DEMO?.MOCK_DELAY || 500);
        
        // 簡單的路由模擬
        if (action.includes('Unit')) return this.mockUnitRequest(action, data);
        if (action.includes('Settings')) return { success: true, message: '設定儲存成功' };
        
        return { success: true, message: 'Demo 模式操作成功', data: null };
    },
    
    async mockUnitRequest(action, data) {
        if (action === 'getUnitList') {
            return {
                success: true,
                data: [
                    { unit_id: 'unit_9b', unit_name: '9B病房', unit_code: '9B' },
                    { unit_id: 'unit_8a', unit_name: '8A病房', unit_code: '8A' }
                ]
            };
        }
        return { success: true, message: '操作成功' };
    }
};