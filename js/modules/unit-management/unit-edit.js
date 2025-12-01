/**
 * 單位編輯模組
 * 處理編輯單位的表單與邏輯
 */

const UnitEdit = {
    currentUnit: null,
    originalData: null,
    hasChanges: false,
    
    // ==================== 初始化 ====================
    
    /**
     * 開啟編輯單位對話框
     * @param {string} unitId - 單位 ID
     */
    async openEditDialog(unitId) {
        try {
            console.log('[UnitEdit] 開啟編輯單位對話框:', unitId);
            
            Loading.show('載入單位資料...');
            
            // 載入單位資料
            const unitData = await UnitService.getUnit(unitId);
            this.currentUnit = new Unit(unitData);
            this.originalData = Utils.deepClone(unitData);
            this.hasChanges = false;
            
            Loading.hide();
            
            // 顯示編輯表單
            Modal.open({
                title: `編輯單位 - ${this.currentUnit.getDisplayName()}`,
                content: this.renderForm(),
                onConfirm: () => this.handleSubmit(),
                confirmText: '儲存變更',
                cancelText: '取消',
                size: 'large'
            });
            
            // 綁定事件
            this.bindFormEvents();
            
        } catch (error) {
            Loading.hide();
            Notification.error('載入失敗', error.message);
        }
    },
    
    // ==================== UI 渲染 ====================
    
    /**
     * 渲染編輯表單
     * @returns {string}
     */
    renderForm() {
        const unit = this.currentUnit;
        
        return `
            <div class="unit-edit-form">
                <!-- 基本資訊 -->
                <div class="form-section">
                    <h3 class="section-title">📋 基本資訊</h3>
                    
                    <div class="form-group">
                        <label>單位代碼</label>
                        <input 
                            type="text" 
                            class="form-control"
                            value="${unit.code}"
                            disabled
                        >
                        <small class="form-text text-muted">
                            單位代碼建立後無法修改
                        </small>
                    </div>
                    
                    <div class="form-group">
                        <label for="edit-unit-name">
                            單位名稱 <span class="required">*</span>
                        </label>
                        <input 
                            type="text" 
                            id="edit-unit-name" 
                            class="form-control"
                            value="${unit.name}"
                            maxlength="50"
                        >
                    </div>
                    
                    <div class="form-group">
                        <label for="edit-unit-description">描述 (選填)</label>
                        <textarea 
                            id="edit-unit-description" 
                            class="form-control"
                            rows="3"
                            maxlength="200"
                        >${unit.description}</textarea>
                    </div>
                    
                    <div class="form-group">
                        <label for="edit-unit-status">狀態</label>
                        <select id="edit-unit-status" class="form-control">
                            <option value="active" ${unit.status === 'active' ? 'selected' : ''}>啟用</option>
                            <option value="inactive" ${unit.status === 'inactive' ? 'selected' : ''}>停用</option>
                        </select>
                        <small class="form-text text-muted">
                            停用後，該單位的使用者將無法存取
                        </small>
                    </div>
                </div>
                
                <!-- 統計資訊 -->
                <div class="form-section">
                    <h3 class="section-title">📊 統計資訊</h3>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <span class="stat-label">人員數:</span>
                            <span class="stat-value">${unit.totalStaff}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">使用者數:</span>
                            <span class="stat-value">${unit.getTotalUsers()}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">建立時間:</span>
                            <span class="stat-value">${Utils.formatDate(new Date(unit.createdAt))}</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">建立天數:</span>
                            <span class="stat-value">${unit.getDaysSinceCreated()} 天</span>
                        </div>
                    </div>
                </div>
                
                <!-- Google Sheets -->
                <div class="form-section">
                    <h3 class="section-title">📊 Google Sheets 檔案</h3>
                    <div class="sheets-links">
                        ${this.renderSheetLink('設定檔', unit.sheets.settings.url, unit.sheets.settings.id)}
                        ${this.renderSheetLink('預班表', unit.sheets.preSchedule.url, unit.sheets.preSchedule.id)}
                        ${this.renderSheetLink('排班表', unit.sheets.schedule.url, unit.sheets.schedule.id)}
                    </div>
                    ${unit.hasSheetsSetup() ? '' : `
                        <div class="alert alert-warning" style="margin-top: 12px;">
                            <div class="alert-icon">⚠️</div>
                            <div class="alert-content">
                                部分 Sheets 檔案尚未建立或已遺失
                                <button 
                                    class="btn btn-sm btn-warning" 
                                    onclick="UnitEdit.recreateSheets()"
                                    style="margin-left: 12px;"
                                >
                                    重新建立
                                </button>
                            </div>
                        </div>
                    `}
                </div>
                
                <!-- 使用者管理 -->
                <div class="form-section">
                    <h3 class="section-title">👥 使用者管理</h3>
                    <p class="text-muted" style="margin-bottom: 12px;">
                        請使用下方「使用者分配」按鈕來管理此單位的使用者
                    </p>
                    <button 
                        type="button" 
                        class="btn btn-secondary"
                        onclick="UnitEdit.openUserAssignment()"
                    >
                        管理使用者
                    </button>
                </div>
                
                <!-- 危險操作 -->
                <div class="form-section">
                    <h3 class="section-title" style="color: var(--error);">⚠️ 危險操作</h3>
                    <div class="danger-zone">
                        <p>刪除此單位將會:</p>
                        <ul>
                            <li>移除所有使用者的存取權限</li>
                            <li>保留 Google Sheets 檔案 (不會刪除)</li>
                            <li>此操作無法復原</li>
                        </ul>
                        <button 
                            type="button" 
                            class="btn btn-danger"
                            onclick="UnitEdit.deleteUnit()"
                        >
                            刪除單位
                        </button>
                    </div>
                </div>
            </div>
            
            <style>
                .unit-edit-form {
                    max-height: 70vh;
                    overflow-y: auto;
                    padding: 4px;
                }
                
                .form-section {
                    margin-bottom: 24px;
                    padding-bottom: 24px;
                    border-bottom: 1px solid var(--border-color);
                }
                
                .form-section:last-child {
                    border-bottom: none;
                }
                
                .section-title {
                    font-size: 16px;
                    font-weight: 600;
                    margin-bottom: 16px;
                    color: var(--text-primary);
                }
                
                .form-group {
                    margin-bottom: 16px;
                }
                
                .form-group label {
                    display: block;
                    font-weight: 500;
                    margin-bottom: 6px;
                    color: var(--text-primary);
                }
                
                .required {
                    color: var(--error);
                }
                
                .form-control {
                    width: 100%;
                    padding: 8px 12px;
                    border: 1px solid var(--border-color);
                    border-radius: 6px;
                    font-size: 14px;
                }
                
                .form-control:disabled {
                    background: var(--gray-100);
                    cursor: not-allowed;
                }
                
                .form-text {
                    display: block;
                    margin-top: 4px;
                    font-size: 12px;
                    color: var(--text-secondary);
                }
                
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                    gap: 16px;
                }
                
                .stat-item {
                    padding: 12px;
                    background: var(--gray-50);
                    border-radius: 6px;
                }
                
                .stat-label {
                    display: block;
                    font-size: 12px;
                    color: var(--text-secondary);
                    margin-bottom: 4px;
                }
                
                .stat-value {
                    display: block;
                    font-size: 18px;
                    font-weight: 600;
                    color: var(--text-primary);
                }
                
                .sheets-links {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }
                
                .sheet-link {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px;
                    background: var(--gray-50);
                    border: 1px solid var(--border-color);
                    border-radius: 6px;
                    text-decoration: none;
                    transition: all 0.2s;
                }
                
                .sheet-link:hover {
                    background: white;
                    border-color: var(--primary);
                    transform: translateX(4px);
                }
                
                .sheet-link-name {
                    font-weight: 500;
                    color: var(--text-primary);
                }
                
                .sheet-link-icon {
                    color: var(--primary);
                }
                
                .danger-zone {
                    padding: 16px;
                    background: #FEE2E2;
                    border: 1px solid #EF4444;
                    border-radius: 6px;
                }
                
                .danger-zone ul {
                    margin: 8px 0 16px 20px;
                    color: #991B1B;
                }
                
                .danger-zone li {
                    margin: 4px 0;
                }
            </style>
        `;
    },
    
    /**
     * 渲染 Sheet 連結
     * @param {string} name - 名稱
     * @param {string} url - URL
     * @param {string} id - Sheet ID
     * @returns {string}
     */
    renderSheetLink(name, url, id) {
        if (!url || !id) {
            return `
                <div class="sheet-link" style="opacity: 0.5;">
                    <span class="sheet-link-name">${name}</span>
                    <span class="sheet-link-icon" style="color: var(--error);">❌ 未建立</span>
                </div>
            `;
        }
        
        return `
            <a href="${url}" target="_blank" class="sheet-link">
                <span class="sheet-link-name">📊 ${name}</span>
                <span class="sheet-link-icon">開啟 →</span>
            </a>
        `;
    },
    
    // ==================== 事件處理 ====================
    
    /**
     * 綁定表單事件
     */
    bindFormEvents() {
        // 監聽變更
        ['edit-unit-name', 'edit-unit-description', 'edit-unit-status'].forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('input', () => {
                    this.hasChanges = true;
                });
            }
        });
    },
    
    /**
     * 開啟使用者分配
     */
    openUserAssignment() {
        Modal.close();
        
        if (typeof UserAssignment !== 'undefined') {
            UserAssignment.openDialog(this.currentUnit.id);
        } else {
            Notification.error('使用者分配模組尚未載入');
        }
    },
    
    /**
     * 重新建立 Sheets
     */
    async recreateSheets() {
        try {
            const confirmed = await this.confirmRecreateSheets();
            if (!confirmed) return;
            
            Loading.show('重新建立 Sheets 檔案...');
            
            const result = await UnitService.recreateSheets(this.currentUnit.id);
            
            Loading.hide();
            Notification.success('Sheets 檔案已重新建立');
            
            // 重新載入單位資料
            Modal.close();
            await this.openEditDialog(this.currentUnit.id);
            
        } catch (error) {
            Loading.hide();
            Notification.error('重新建立失敗', error.message);
        }
    },
    
    /**
     * 確認重新建立 Sheets
     * @returns {Promise<boolean>}
     */
    async confirmRecreateSheets() {
        return new Promise((resolve) => {
            Modal.open({
                title: '確認重新建立 Sheets',
                content: `
                    <p>這將會重新建立所有 Google Sheets 檔案。</p>
                    <p style="color: var(--error); margin-top: 12px;">
                        <strong>注意:</strong> 如果原本的檔案中有資料，建議先備份
                    </p>
                `,
                onConfirm: () => resolve(true),
                onCancel: () => resolve(false),
                confirmText: '確認重建',
                cancelText: '取消'
            });
        });
    },
    
    /**
     * 刪除單位
     */
    async deleteUnit() {
        try {
            const confirmed = await this.confirmDelete();
            if (!confirmed) return;
            
            Loading.show('刪除單位中...');
            
            await UnitService.deleteUnit(this.currentUnit.id, true);
            
            Loading.hide();
            Notification.success('單位已刪除');
            
            // 關閉對話框
            Modal.close();
            
            // 重新載入單位列表
            if (typeof UnitManagement !== 'undefined') {
                await UnitManagement.loadUnits();
            }
            
        } catch (error) {
            Loading.hide();
            Notification.error('刪除失敗', error.message);
        }
    },
    
    /**
     * 確認刪除
     * @returns {Promise<boolean>}
     */
    async confirmDelete() {
        return new Promise((resolve) => {
            Modal.open({
                title: '⚠️ 確認刪除單位',
                content: `
                    <div class="confirm-delete">
                        <p style="color: var(--error); font-weight: 600; margin-bottom: 16px;">
                            您即將刪除單位「${this.currentUnit.getDisplayName()}」
                        </p>
                        <p>此操作將會:</p>
                        <ul style="margin: 12px 0 12px 20px; color: #666;">
                            <li>移除所有使用者的存取權限</li>
                            <li>保留 Google Sheets 檔案 (不會刪除)</li>
                            <li><strong>此操作無法復原</strong></li>
                        </ul>
                        <p style="margin-top: 16px;">
                            請輸入單位代碼 <strong>${this.currentUnit.code}</strong> 以確認刪除:
                        </p>
                        <input 
                            type="text" 
                            id="delete-confirm-input" 
                            class="form-control"
                            placeholder="輸入單位代碼"
                            style="margin-top: 8px;"
                        >
                    </div>
                `,
                onConfirm: () => {
                    const input = document.getElementById('delete-confirm-input');
                    if (input && input.value === this.currentUnit.code) {
                        resolve(true);
                    } else {
                        Notification.warning('單位代碼不正確');
                        resolve(false);
                    }
                },
                onCancel: () => resolve(false),
                confirmText: '確認刪除',
                cancelText: '取消'
            });
        });
    },
    
    // ==================== 表單提交 ====================
    
    /**
     * 處理表單提交
     */
    async handleSubmit() {
        try {
            if (!this.hasChanges) {
                Notification.info('沒有變更');
                return true;
            }
            
            // 讀取表單資料
            const formData = this.readFormData();
            
            // 驗證
            const validation = this.validateFormData(formData);
            if (!validation.valid) {
                Notification.error('驗證失敗', validation.errors.join('<br>'));
                return false;
            }
            
            // 更新單位
            Loading.show('儲存變更中...');
            
            await UnitService.updateUnit(this.currentUnit.id, formData);
            
            Loading.hide();
            Notification.success('變更已儲存');
            
            // 重新載入單位列表
            if (typeof UnitManagement !== 'undefined') {
                await UnitManagement.loadUnits();
            }
            
            return true;
            
        } catch (error) {
            Loading.hide();
            Notification.error('儲存失敗', error.message);
            return false;
        }
    },
    
    /**
     * 讀取表單資料
     * @returns {Object}
     */
    readFormData() {
        return {
            unit_name: document.getElementById('edit-unit-name')?.value.trim() || '',
            description: document.getElementById('edit-unit-description')?.value.trim() || '',
            status: document.getElementById('edit-unit-status')?.value || 'active'
        };
    },
    
    /**
     * 驗證表單資料
     * @param {Object} formData - 表單資料
     * @returns {Object} {valid, errors}
     */
    validateFormData(formData) {
        const errors = [];
        
        if (!formData.unit_name) {
            errors.push('請輸入單位名稱');
        } else if (!Unit.isValidName(formData.unit_name)) {
            errors.push('單位名稱格式錯誤');
        }
        
        if (formData.description && formData.description.length > 200) {
            errors.push('描述不可超過 200 個字元');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
};

// 讓單位編輯模組可在全域使用
if (typeof window !== 'undefined') {
    window.UnitEdit = UnitEdit;
}