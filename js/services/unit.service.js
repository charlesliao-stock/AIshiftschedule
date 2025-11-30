/**
 * 單位服務
 * 處理單位的 CRUD 操作和 Sheets 建立
 */

const UnitService = {
    
    // ==================== 單位操作 ====================
    
    /**
     * 取得所有單位
     * @returns {Promise<Array>}
     */
    async getAllUnits() {
        try {
            console.log('[Unit] 取得所有單位');
            
            const result = await SheetsService.post(
                API_CONFIG.endpoints.unit.list
            );
            
            if (!result.success) {
                throw new Error(result.message || '取得單位列表失敗');
            }
            
            return result.data || [];
            
        } catch (error) {
            console.error('[Unit] 取得單位列表失敗:', error);
            throw error;
        }
    },
    
    /**
     * 取得單一單位
     * @param {string} unitId - 單位 ID
     * @returns {Promise<Object>}
     */
    async getUnit(unitId) {
        try {
            console.log('[Unit] 取得單位:', unitId);
            
            const units = await this.getAllUnits();
            const unit = units.find(u => u.unit_id === unitId);
            
            if (!unit) {
                throw new Error('找不到指定的單位');
            }
            
            return unit;
            
        } catch (error) {
            console.error('[Unit] 取得單位失敗:', error);
            throw error;
        }
    },
    
    /**
     * 創建新單位
     * @param {Object} unitData - 單位資料
     * @returns {Promise<Object>}
     */
    async createUnit(unitData) {
        try {
            console.log('[Unit] 創建單位:', unitData);
            
            // 驗證必填欄位
            this.validateUnitData(unitData);
            
            // 呼叫 Apps Script API 創建單位
            // Apps Script 會自動建立 3 個 Sheets 檔案
            const result = await SheetsService.post(
                API_CONFIG.endpoints.unit.create,
                unitData
            );
            
            if (!result.success) {
                throw new Error(result.message || '創建單位失敗');
            }
            
            // 清除快取
            SheetsService.clearCache('/unit/list');
            
            console.log('[Unit] 單位創建成功:', result.data);
            return result.data;
            
        } catch (error) {
            console.error('[Unit] 創建單位失敗:', error);
            throw error;
        }
    },
    
    /**
     * 更新單位
     * @param {string} unitId - 單位 ID
     * @param {Object} updates - 更新的資料
     * @returns {Promise<Object>}
     */
    async updateUnit(unitId, updates) {
        try {
            console.log('[Unit] 更新單位:', unitId, updates);
            
            const result = await SheetsService.post(
                API_CONFIG.endpoints.unit.update,
                {
                    unit_id: unitId,
                    ...updates
                }
            );
            
            if (!result.success) {
                throw new Error(result.message || '更新單位失敗');
            }
            
            // 清除快取
            SheetsService.clearCache('/unit/list');
            
            return result.data;
            
        } catch (error) {
            console.error('[Unit] 更新單位失敗:', error);
            throw error;
        }
    },
    
    /**
     * 刪除單位
     * @param {string} unitId - 單位 ID
     * @returns {Promise<void>}
     */
    async deleteUnit(unitId) {
        try {
            console.log('[Unit] 刪除單位:', unitId);
            
            const result = await SheetsService.post(
                API_CONFIG.endpoints.unit.delete,
                { unit_id: unitId }
            );
            
            if (!result.success) {
                throw new Error(result.message || '刪除單位失敗');
            }
            
            // 清除快取
            SheetsService.clearCache('/unit/list');
            
        } catch (error) {
            console.error('[Unit] 刪除單位失敗:', error);
            throw error;
        }
    },
    
    // ==================== 驗證 ====================
    
    /**
     * 驗證單位資料
     * @param {Object} unitData - 單位資料
     * @throws {Error}
     */
    validateUnitData(unitData) {
        const errors = [];
        
        // 單位代碼
        if (!unitData.unit_code || !unitData.unit_code.trim()) {
            errors.push('請輸入單位代碼');
        } else if (unitData.unit_code.length > 10) {
            errors.push('單位代碼不可超過 10 個字元');
        }
        
        // 單位名稱
        if (!unitData.unit_name || !unitData.unit_name.trim()) {
            errors.push('請輸入單位名稱');
        } else if (unitData.unit_name.length > 50) {
            errors.push('單位名稱不可超過 50 個字元');
        }
        
        // Email 驗證
        if (unitData.admin_email && !Utils.isValidEmail(unitData.admin_email)) {
            errors.push('管理員 Email 格式錯誤');
        }
        
        if (errors.length > 0) {
            throw new Error(errors.join('、'));
        }
    },
    
    // ==================== Sheets 操作 ====================
    
    /**
     * 初始化單位 Sheets (由 Apps Script 執行)
     * @param {string} unitId - 單位 ID
     * @param {string} unitCode - 單位代碼
     * @returns {Promise<Object>} Sheets 資訊
     */
    async initializeUnitSheets(unitId, unitCode) {
        try {
            console.log('[Unit] 初始化單位 Sheets:', unitId);
            
            // 這個函式會呼叫 Apps Script
            // Apps Script 會:
            // 1. 建立 3 個 Google Sheets 檔案
            // 2. 設定工作表結構
            // 3. 填入預設資料
            // 4. 設定權限
            // 5. 回傳檔案 ID 和 URL
            
            const result = await SheetsService.post(
                '/api/unit/initialize-sheets',
                {
                    unit_id: unitId,
                    unit_code: unitCode
                }
            );
            
            if (!result.success) {
                throw new Error(result.message || '初始化 Sheets 失敗');
            }
            
            return result.data;
            
        } catch (error) {
            console.error('[Unit] 初始化 Sheets 失敗:', error);
            throw error;
        }
    },
    
    /**
     * 檢查 Sheets 狀態
     * @param {string} sheetId - Sheet ID
     * @returns {Promise<Object>}
     */
    async checkSheetStatus(sheetId) {
        try {
            const result = await SheetsService.post(
                '/api/sheets/check-status',
                { sheet_id: sheetId }
            );
            
            return result.data;
            
        } catch (error) {
            console.error('[Unit] 檢查 Sheet 狀態失敗:', error);
            throw error;
        }
    },
    
    // ==================== 使用者分配 ====================
    
    /**
     * 分配使用者到單位
     * @param {string} unitId - 單位 ID
     * @param {string} userId - 使用者 ID
     * @param {string} role - 角色 (admin/scheduler/viewer)
     * @returns {Promise<void>}
     */
    async assignUser(unitId, userId, role) {
        try {
            console.log('[Unit] 分配使用者:', unitId, userId, role);
            
            // 這裡會更新 Firestore 中的使用者資料
            if (!FIREBASE_CONFIG.demo.enabled && window.firebase) {
                await firebase.firestore()
                    .collection(FIREBASE_CONFIG.collections.USERS)
                    .doc(userId)
                    .update({
                        unit_id: unitId,
                        role: role,
                        updated_at: firebase.firestore.FieldValue.serverTimestamp()
                    });
            }
            
            // 也需要更新單位的使用者列表
            await this.updateUnit(unitId, {
                [`${role}_users`]: firebase.firestore.FieldValue.arrayUnion(userId)
            });
            
        } catch (error) {
            console.error('[Unit] 分配使用者失敗:', error);
            throw error;
        }
    },
    
    /**
     * 移除單位的使用者
     * @param {string} unitId - 單位 ID
     * @param {string} userId - 使用者 ID
     * @returns {Promise<void>}
     */
    async removeUser(unitId, userId) {
        try {
            console.log('[Unit] 移除使用者:', unitId, userId);
            
            // 更新 Firestore
            if (!FIREBASE_CONFIG.demo.enabled && window.firebase) {
                await firebase.firestore()
                    .collection(FIREBASE_CONFIG.collections.USERS)
                    .doc(userId)
                    .update({
                        unit_id: null,
                        updated_at: firebase.firestore.FieldValue.serverTimestamp()
                    });
            }
            
        } catch (error) {
            console.error('[Unit] 移除使用者失敗:', error);
            throw error;
        }
    },
    
    // ==================== 統計資訊 ====================
    
    /**
     * 取得單位統計
     * @param {string} unitId - 單位 ID
     * @returns {Promise<Object>}
     */
    async getUnitStatistics(unitId) {
        try {
            console.log('[Unit] 取得單位統計:', unitId);
            
            const result = await SheetsService.post(
                '/api/unit/statistics',
                { unit_id: unitId }
            );
            
            if (!result.success) {
                throw new Error(result.message || '取得統計失敗');
            }
            
            return result.data;
            
        } catch (error) {
            console.error('[Unit] 取得統計失敗:', error);
            throw error;
        }
    },
    
    // ==================== 工具方法 ====================
    
    /**
     * 產生單位 ID
     * @param {string} unitCode - 單位代碼
     * @returns {string}
     */
    generateUnitId(unitCode) {
        return 'unit_' + unitCode.toLowerCase().replace(/[^a-z0-9]/g, '');
    },
    
    /**
     * 檢查單位代碼是否已存在
     * @param {string} unitCode - 單位代碼
     * @returns {Promise<boolean>}
     */
    async isUnitCodeExists(unitCode) {
        try {
            const units = await this.getAllUnits();
            return units.some(u => 
                u.unit_code.toLowerCase() === unitCode.toLowerCase()
            );
        } catch (error) {
            console.error('[Unit] 檢查單位代碼失敗:', error);
            return false;
        }
    },
    
    /**
     * 取得單位的 Sheets URLs
     * @param {string} unitId - 單位 ID
     * @returns {Promise<Object>}
     */
    async getUnitSheets(unitId) {
        try {
            const unit = await this.getUnit(unitId);
            
            return {
                settings: unit.settings_sheet_url,
                preSchedule: unit.pre_schedule_sheet_url,
                schedule: unit.schedule_sheet_url
            };
        } catch (error) {
            console.error('[Unit] 取得 Sheets URLs 失敗:', error);
            throw error;
        }
    }
};

// 讓單位服務可在全域使用
if (typeof window !== 'undefined') {
    window.UnitService = UnitService;
}
