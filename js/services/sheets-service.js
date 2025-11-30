/**
 * Google Sheets 服務
 * 與 Google Apps Script API 溝通
 */

const SheetsService = {
    baseUrl: API_CONFIG.baseUrl,
    requestCache: new Map(),
    cacheTimeout: 5 * 60 * 1000, // 5 分鐘快取
    
    // ==================== 基礎請求方法 ====================
    
    /**
     * 發送請求到 Apps Script
     * @param {string} endpoint - API 端點
     * @param {Object} data - 請求資料
     * @param {Object} options - 選項
     * @returns {Promise<Object>}
     */
    async request(endpoint, data = {}, options = {}) {
        const {
            method = 'POST',
            useCache = false,
            timeout = API_CONFIG.request.timeout
        } = options;
        
        // Demo 模式
        if (API_CONFIG.demo.enabled) {
            return await this.mockRequest(endpoint, data);
        }
        
        // 檢查快取
        if (useCache && method === 'GET') {
            const cached = this.getCache(endpoint, data);
            if (cached) {
                console.log('[Sheets] 使用快取:', endpoint);
                return cached;
            }
        }
        
        try {
            const url = this.baseUrl + endpoint;
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
            const response = await fetch(url, {
                method,
                headers: API_CONFIG.request.headers,
                body: method === 'POST' ? JSON.stringify(data) : undefined,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            // 檢查 Apps Script 回傳的錯誤
            if (result.error) {
                throw new Error(result.error);
            }
            
            // 儲存快取
            if (useCache && method === 'GET') {
                this.setCache(endpoint, data, result);
            }
            
            return result;
            
        } catch (error) {
            console.error('[Sheets] 請求失敗:', error);
            
            if (error.name === 'AbortError') {
                throw new Error('請求逾時，請稍後再試');
            }
            
            throw error;
        }
    },
    
    /**
     * GET 請求
     * @param {string} endpoint - API 端點
     * @param {Object} params - 查詢參數
     * @returns {Promise<Object>}
     */
    async get(endpoint, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return await this.request(url, {}, { method: 'GET', useCache: true });
    },
    
    /**
     * POST 請求
     * @param {string} endpoint - API 端點
     * @param {Object} data - 請求資料
     * @returns {Promise<Object>}
     */
    async post(endpoint, data = {}) {
        return await this.request(endpoint, data, { method: 'POST' });
    },
    
    // ==================== 快取管理 ====================
    
    /**
     * 取得快取
     * @param {string} endpoint - 端點
     * @param {Object} data - 資料
     * @returns {Object|null}
     */
    getCache(endpoint, data = {}) {
        const key = this.getCacheKey(endpoint, data);
        const cached = this.requestCache.get(key);
        
        if (!cached) return null;
        
        // 檢查是否過期
        if (Date.now() - cached.timestamp > this.cacheTimeout) {
            this.requestCache.delete(key);
            return null;
        }
        
        return cached.data;
    },
    
    /**
     * 設定快取
     * @param {string} endpoint - 端點
     * @param {Object} data - 資料
     * @param {Object} result - 結果
     */
    setCache(endpoint, data, result) {
        const key = this.getCacheKey(endpoint, data);
        this.requestCache.set(key, {
            data: result,
            timestamp: Date.now()
        });
    },
    
    /**
     * 清除快取
     * @param {string} endpoint - 端點 (選填，不提供則清除所有)
     */
    clearCache(endpoint = null) {
        if (endpoint) {
            // 清除特定端點的所有快取
            for (const key of this.requestCache.keys()) {
                if (key.startsWith(endpoint)) {
                    this.requestCache.delete(key);
                }
            }
        } else {
            // 清除所有快取
            this.requestCache.clear();
        }
    },
    
    /**
     * 取得快取鍵值
     * @param {string} endpoint - 端點
     * @param {Object} data - 資料
     * @returns {string}
     */
    getCacheKey(endpoint, data) {
        return endpoint + ':' + JSON.stringify(data);
    },
    
    // ==================== Demo 模式模擬 ====================
    
    /**
     * 模擬 API 請求 (Demo 模式)
     * @param {string} endpoint - 端點
     * @param {Object} data - 資料
     * @returns {Promise<Object>}
     */
    async mockRequest(endpoint, data) {
        console.log('[Sheets] Demo 模式請求:', endpoint, data);
        
        // 模擬網路延遲
        await Utils.sleep(API_CONFIG.demo.mockDelay);
        
        // 根據端點返回模擬資料
        if (endpoint.includes('/unit/create')) {
            return this.mockCreateUnit(data);
        }
        
        if (endpoint.includes('/unit/list')) {
            return this.mockListUnits();
        }
        
        if (endpoint.includes('/unit/update')) {
            return this.mockUpdateUnit(data);
        }
        
        if (endpoint.includes('/unit/delete')) {
            return this.mockDeleteUnit(data);
        }
        
        // 設定相關
        if (endpoint.includes('/settings/')) {
            return this.mockSettingsRequest(endpoint, data);
        }
        
        // 預設回應
        return {
            success: true,
            message: 'Demo 模式操作成功',
            data: null
        };
    },
    
    /**
     * 模擬創建單位
     */
    async mockCreateUnit(data) {
        const unitId = 'unit_' + Utils.generateId();
        
        return {
            success: true,
            message: '單位創建成功',
            data: {
                unit_id: unitId,
                unit_code: data.unit_code,
                unit_name: data.unit_name,
                settings_sheet_id: 'sheet_' + Utils.generateId(),
                settings_sheet_url: 'https://docs.google.com/spreadsheets/d/demo_settings',
                pre_schedule_sheet_id: 'sheet_' + Utils.generateId(),
                pre_schedule_sheet_url: 'https://docs.google.com/spreadsheets/d/demo_pre_schedule',
                schedule_sheet_id: 'sheet_' + Utils.generateId(),
                schedule_sheet_url: 'https://docs.google.com/spreadsheets/d/demo_schedule',
                created_at: new Date().toISOString()
            }
        };
    },
    
    /**
     * 模擬列出單位
     */
    async mockListUnits() {
        const demoUnits = [
            {
                unit_id: 'unit_9b',
                unit_code: '9B',
                unit_name: '9B病房',
                total_staff: 20,
                admin_users: ['admin@hospital.com'],
                scheduler_users: ['scheduler@hospital.com'],
                settings_sheet_url: 'https://docs.google.com/spreadsheets/d/demo_9b_settings',
                status: 'active',
                created_at: '2024-01-01T00:00:00.000Z'
            },
            {
                unit_id: 'unit_8a',
                unit_code: '8A',
                unit_name: '8A病房',
                total_staff: 18,
                admin_users: ['admin@hospital.com'],
                scheduler_users: ['scheduler2@hospital.com'],
                settings_sheet_url: 'https://docs.google.com/spreadsheets/d/demo_8a_settings',
                status: 'active',
                created_at: '2024-02-01T00:00:00.000Z'
            },
            {
                unit_id: 'unit_7c',
                unit_code: '7C',
                unit_name: '7C病房',
                total_staff: 22,
                admin_users: ['admin@hospital.com'],
                scheduler_users: ['scheduler3@hospital.com'],
                settings_sheet_url: 'https://docs.google.com/spreadsheets/d/demo_7c_settings',
                status: 'active',
                created_at: '2024-03-01T00:00:00.000Z'
            }
        ];
        
        return {
            success: true,
            data: demoUnits
        };
    },
    
    /**
     * 模擬更新單位
     */
    async mockUpdateUnit(data) {
        return {
            success: true,
            message: '單位更新成功',
            data: {
                ...data,
                updated_at: new Date().toISOString()
            }
        };
    },
    
    /**
     * 模擬刪除單位
     */
    async mockDeleteUnit(data) {
        return {
            success: true,
            message: '單位刪除成功'
        };
    },
    
    /**
     * 模擬設定請求
     */
    async mockSettingsRequest(endpoint, data) {
        // 如果是讀取
        if (endpoint.includes('get') || !data || Object.keys(data).length === 0) {
            if (endpoint.includes('shifts')) {
                return {
                    success: true,
                    data: CONSTANTS.DEFAULT_SHIFTS
                };
            }
            
            if (endpoint.includes('groups')) {
                return {
                    success: true,
                    data: CONSTANTS.DEFAULT_GROUPS
                };
            }
            
            if (endpoint.includes('rules')) {
                return {
                    success: true,
                    data: CONSTANTS.DEFAULT_RULES
                };
            }
            
            if (endpoint.includes('staff')) {
                return {
                    success: true,
                    data: [
                        {
                            id: 1,
                            employee_id: '930462',
                            name: '廖苡凱',
                            level: 'N4',
                            shifts: ['大', '小', '白'],
                            group: '資深組',
                            max_consecutive_days: 6,
                            is_package: true,
                            package_type: '大夜',
                            email: 'staff1@hospital.com',
                            status: '在職'
                        },
                        {
                            id: 2,
                            employee_id: '830330',
                            name: '鍾淑英',
                            level: 'N3',
                            shifts: ['大', '小', '白', 'DL'],
                            group: '資深組',
                            max_consecutive_days: 6,
                            is_package: false,
                            package_type: '',
                            email: 'staff2@hospital.com',
                            status: '在職'
                        }
                    ]
                };
            }
        }
        
        // 如果是儲存
        return {
            success: true,
            message: '設定儲存成功'
        };
    },
    
    // ==================== 重試機制 ====================
    
    /**
     * 帶重試的請求
     * @param {Function} requestFn - 請求函式
     * @param {number} maxRetries - 最大重試次數
     * @returns {Promise<Object>}
     */
    async requestWithRetry(requestFn, maxRetries = API_CONFIG.request.retryTimes) {
        let lastError;
        
        for (let i = 0; i <= maxRetries; i++) {
            try {
                return await requestFn();
            } catch (error) {
                lastError = error;
                
                if (i < maxRetries) {
                    console.log(`[Sheets] 請求失敗，重試 ${i + 1}/${maxRetries}...`);
                    await Utils.sleep(API_CONFIG.request.retryDelay * (i + 1));
                }
            }
        }
        
        throw lastError;
    },
    
    // ==================== 批次請求 ====================
    
    /**
     * 批次請求 (並行)
     * @param {Array} requests - 請求陣列 [{endpoint, data}, ...]
     * @returns {Promise<Array>}
     */
    async batchRequest(requests) {
        const promises = requests.map(req => 
            this.request(req.endpoint, req.data, req.options)
        );
        
        try {
            return await Promise.all(promises);
        } catch (error) {
            console.error('[Sheets] 批次請求失敗:', error);
            throw error;
        }
    },
    
    /**
     * 批次請求 (順序)
     * @param {Array} requests - 請求陣列
     * @returns {Promise<Array>}
     */
    async sequentialRequest(requests) {
        const results = [];
        
        for (const req of requests) {
            try {
                const result = await this.request(req.endpoint, req.data, req.options);
                results.push(result);
            } catch (error) {
                console.error('[Sheets] 順序請求失敗:', error);
                results.push({ error: error.message });
            }
        }
        
        return results;
    }
};

// 讓 Sheets 服務可在全域使用
if (typeof window !== 'undefined') {
    window.SheetsService = SheetsService;
}