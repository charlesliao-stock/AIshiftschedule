/**
 * 單位新增模組
 * 處理新增單位的表單與邏輯
 */

const UnitCreate = {
    currentFormData: {},
    
    // ==================== 初始化 ====================
    
    /**
     * 開啟新增單位對話框
     */
    openCreateDialog() {
        console.log('[UnitCreate] 開啟新增單位對話框');
        
        // 重置表單資料
        this.currentFormData = {
            unit_code: '',
            unit_name: '',
            description: '',
            admin_users: [],
            scheduler_users: []
        };
        
        Modal.open({
            title: '新增單位',
            content: this.renderForm(),
            onConfirm: () => this.handleSubmit(),
            confirmText: '建立單位',
            cancelText: '取消',
            size: 'large'
        });
        
        // 綁定事件
        this.bindFormEvents();
    },
    
    // ==================== UI 渲染 ====================
    
    /**
     * 渲染表單
     * @returns {string}
     */
    renderForm() {
        return `
            <div class="unit-create-form">
                <!-- 基本資訊 -->
                <div class="form-section">
                    <h3 class="section-title">📋 基本資訊</h3>
                    
                    <div class="form-group">
                        <label for="unit-code">
                            單位代碼 <span class="required">*</span>
                        </label>
                        <input 
                            type="text" 
                            id="unit-code" 
                            class="form-control"
                            placeholder="例如: 9B, ICU, ER"
                            maxlength="20"
                        >
                        <small class="form-text text-muted">
                            只能包含英文、數字、底線，最多 20 個字元
                        </small>
                        <div id="code-error" class="form-error" style="display: none;"></div>
                    </div>
                    
                    <div class="form-group">
                        <label for="unit-name">
                            單位名稱 <span class="required">*</span>
                        </label>
                        <input 
                            type="text" 
                            id="unit-name" 
                            class="form-control"
                            placeholder="例如: 9B病房"
                            maxlength="50"
                        >
                        <small class="form-text text-muted">
                            最多 50 個字元
                        </small>
                    </div>
                    
                    <div class="form-group">
                        <label for="unit-description">描述 (選填)</label>
                        <textarea 
                            id="unit-description" 
                            class="form-control"
                            rows="3"
                            placeholder="例如: 內科病房，主要收治呼吸系統疾病患者"
                            maxlength="200"
                        ></textarea>
                        <small class="form-text text-muted">
                            最多 200 個字元
                        </small>
                    </div>
                </div>
                
                <!-- 使用者分配 -->
                <div class="form-section">
                    <h3 class="section-title">👥 使用者分配</h3>
                    
                    <div class="form-group">
                        <label for="admin-users">管理者</label>
                        <div class="user-input-group">
                            <input 
                                type="email" 
                                id="admin-email-input" 
                                class="form-control"
                                placeholder="輸入 Email 後按 Enter 新增"
                            >
                            <button 
                                type="button" 
                                class="btn btn-secondary"
                                onclick="UnitCreate.addAdminUser()"
                            >
                                新增
                            </button>
                        </div>
                        <div id="admin-users-list" class="user-tags-container">
                            <!-- 動態顯示已新增的管理者 -->
                        </div>
                        <small class="form-text text-muted">
                            管理者可以管理單位設定、查看所有資料
                        </small>
                    </div>
                    
                    <div class="form-group">
                        <label for="scheduler-users">排班者</label>
                        <div class="user-input-group">
                            <input 
                                type="email" 
                                id="scheduler-email-input" 
                                class="form-control"
                                placeholder="輸入 Email 後按 Enter 新增"
                            >
                            <button 
                                type="button" 
                                class="btn btn-secondary"
                                onclick="UnitCreate.addSchedulerUser()"
                            >
                                新增
                            </button>
                        </div>
                        <div id="scheduler-users-list" class="user-tags-container">
                            <!-- 動態顯示已新增的排班者 -->
                        </div>
                        <small class="form-text text-muted">
                            排班者可以管理預班、進行排班、查看統計
                        </small>
                    </div>
                </div>
                
                <!-- 自動建立說明 -->
                <div class="form-section">
                    <h3 class="section-title">📊 Google Sheets 自動建立</h3>
                    <div class="info-box">
                        <div class="info-icon">ℹ️</div>
                        <div class="info-content">
                            <p><strong>建立單位後將自動建立以下 Google Sheets 檔案:</strong></p>
                            <ul>
                                <li><strong>{單位代碼}_設定檔</strong> - 儲存班別、組別、人員、規則等設定</li>
                                <li><strong>{單位代碼}_預班表</strong> - 儲存員工的預班資料</li>
                                <li><strong>{單位代碼}_排班表</strong> - 儲存每月的排班結果</li>
                            </ul>
                            <p style="margin-top: 8px; color: #666;">
                                所有檔案會自動分享給指定的管理者和排班者
                            </p>
                        </div>
                    </div>
                </div>
            </div>
            
            <style>
                .unit-create-form {
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
                
                .form-control:focus {
                    outline: none;
                    border-color: var(--primary);
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
                }
                
                .form-text {
                    display: block;
                    margin-top: 4px;
                    font-size: 12px;
                    color: var(--text-secondary);
                }
                
                .form-error {
                    margin-top: 4px;
                    font-size: 12px;
                    color: var(--error);
                }
                
                .user-input-group {
                    display: flex;
                    gap: 8px;
                }
                
                .user-input-group .form-control {
                    flex: 1;
                }
                
                .user-tags-container {
                    margin-top: 8px;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    min-height: 40px;
                    padding: 8px;
                    border: 1px solid var(--border-color);
                    border-radius: 6px;
                    background: var(--gray-50);
                }
                
                .user-tag {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 4px 12px;
                    background: white;
                    border: 1px solid var(--border-color);
                    border-radius: 16px;
                    font-size: 13px;
                }
                
                .user-tag-remove {
                    cursor: pointer;
                    color: var(--text-secondary);
                    font-weight: bold;
                    transition: color 0.2s;
                }
                
                .user-tag-remove:hover {
                    color: var(--error);
                }
                
                .info-box {
                    display: flex;
                    gap: 12px;
                    padding: 16px;
                    background: #EFF6FF;
                    border-left: 4px solid #3B82F6;
                    border-radius: 6px;
                }
                
                .info-icon {
                    font-size: 24px;
                    flex-shrink: 0;
                }
                
                .info-content {
                    flex: 1;
                }
                
                .info-content p {
                    margin: 0 0 8px 0;
                }
                
                .info-content ul {
                    margin: 8px 0;
                    padding-left: 20px;
                }
                
                .info-content li {
                    margin: 4px 0;
                }
            </style>
        `;
    },
    
    /**
     * 更新使用者列表顯示
     * @param {string} type - 'admin' or 'scheduler'
     */
    updateUserList(type) {
        const users = type === 'admin' ? this.currentFormData.admin_users : this.currentFormData.scheduler_users;
        const containerId = type === 'admin' ? 'admin-users-list' : 'scheduler-users-list';
        const container = document.getElementById(containerId);
        
        if (!container) return;
        
        if (users.length === 0) {
            container.innerHTML = '<span style="color: var(--text-secondary); font-size: 13px;">尚未新增使用者</span>';
            return;
        }
        
        container.innerHTML = users.map(email => `
            <div class="user-tag">
                <span>${email}</span>
                <span class="user-tag-remove" onclick="UnitCreate.removeUser('${type}', '${email}')">×</span>
            </div>
        `).join('');
    },
    
    // ==================== 事件處理 ====================
    
    /**
     * 綁定表單事件
     */
    bindFormEvents() {
        // 單位代碼即時驗證
        const codeInput = document.getElementById('unit-code');
        if (codeInput) {
            codeInput.addEventListener('input', Utils.debounce(() => {
                this.validateUnitCode();
            }, 500));
            
            codeInput.addEventListener('blur', () => {
                this.validateUnitCode();
            });
        }
        
        // Enter 鍵新增使用者
        const adminInput = document.getElementById('admin-email-input');
        if (adminInput) {
            adminInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.addAdminUser();
                }
            });
        }
        
        const schedulerInput = document.getElementById('scheduler-email-input');
        if (schedulerInput) {
            schedulerInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.addSchedulerUser();
                }
            });
        }
    },
    
    /**
     * 驗證單位代碼
     */
    async validateUnitCode() {
        const input = document.getElementById('unit-code');
        const errorDiv = document.getElementById('code-error');
        
        if (!input || !errorDiv) return;
        
        const code = input.value.trim();
        
        // 格式驗證
        if (!Unit.isValidCode(code)) {
            errorDiv.textContent = '代碼只能包含英文、數字、底線';
            errorDiv.style.display = 'block';
            input.classList.add('is-invalid');
            return false;
        }
        
        // 檢查是否已存在
        try {
            const exists = await UnitService.checkUnitCodeExists(code);
            if (exists) {
                errorDiv.textContent = '此單位代碼已存在';
                errorDiv.style.display = 'block';
                input.classList.add('is-invalid');
                return false;
            }
        } catch (error) {
            console.error('檢查單位代碼失敗:', error);
        }
        
        // 驗證通過
        errorDiv.style.display = 'none';
        input.classList.remove('is-invalid');
        return true;
    },
    
    /**
     * 新增管理者
     */
    addAdminUser() {
        const input = document.getElementById('admin-email-input');
        if (!input) return;
        
        const email = input.value.trim();
        
        // 驗證 Email
        if (!Utils.isValidEmail(email)) {
            Notification.warning('請輸入有效的 Email 地址');
            return;
        }
        
        // 檢查是否已存在
        if (this.currentFormData.admin_users.includes(email)) {
            Notification.warning('此管理者已新增');
            return;
        }
        
        // 新增
        this.currentFormData.admin_users.push(email);
        input.value = '';
        
        // 更新顯示
        this.updateUserList('admin');
    },
    
    /**
     * 新增排班者
     */
    addSchedulerUser() {
        const input = document.getElementById('scheduler-email-input');
        if (!input) return;
        
        const email = input.value.trim();
        
        // 驗證 Email
        if (!Utils.isValidEmail(email)) {
            Notification.warning('請輸入有效的 Email 地址');
            return;
        }
        
        // 檢查是否已存在
        if (this.currentFormData.scheduler_users.includes(email)) {
            Notification.warning('此排班者已新增');
            return;
        }
        
        // 檢查是否已經是管理者
        if (this.currentFormData.admin_users.includes(email)) {
            Notification.warning('此使用者已是管理者，無需重複新增');
            return;
        }
        
        // 新增
        this.currentFormData.scheduler_users.push(email);
        input.value = '';
        
        // 更新顯示
        this.updateUserList('scheduler');
    },
    
    /**
     * 移除使用者
     * @param {string} type - 'admin' or 'scheduler'
     * @param {string} email - Email
     */
    removeUser(type, email) {
        if (type === 'admin') {
            this.currentFormData.admin_users = this.currentFormData.admin_users.filter(e => e !== email);
            this.updateUserList('admin');
        } else {
            this.currentFormData.scheduler_users = this.currentFormData.scheduler_users.filter(e => e !== email);
            this.updateUserList('scheduler');
        }
    },
    
    // ==================== 表單提交 ====================
    
    /**
     * 處理表單提交
     */
    async handleSubmit() {
        try {
            // 讀取表單資料
            const formData = this.readFormData();
            
            // 驗證
            const validation = this.validateFormData(formData);
            if (!validation.valid) {
                Notification.error('驗證失敗', validation.errors.join('<br>'));
                return false;
            }
            
            // 確認建立
            const confirmed = await this.confirmCreate(formData);
            if (!confirmed) return false;
            
            // 建立單位
            Loading.show('建立單位中...<br>正在自動建立 Google Sheets 檔案...');
            
            const result = await UnitService.createUnit(formData);
            
            Loading.hide();
            
            // 顯示成功訊息
            this.showSuccessMessage(result);
            
            // 重新載入單位列表
            if (typeof UnitManagement !== 'undefined') {
                await UnitManagement.loadUnits();
            }
            
            return true;
            
        } catch (error) {
            Loading.hide();
            Notification.error('建立失敗', error.message);
            return false;
        }
    },
    
    /**
     * 讀取表單資料
     * @returns {Object}
     */
    readFormData() {
        return {
            unit_code: document.getElementById('unit-code')?.value.trim() || '',
            unit_name: document.getElementById('unit-name')?.value.trim() || '',
            description: document.getElementById('unit-description')?.value.trim() || '',
            admin_users: this.currentFormData.admin_users,
            scheduler_users: this.currentFormData.scheduler_users
        };
    },
    
    /**
     * 驗證表單資料
     * @param {Object} formData - 表單資料
     * @returns {Object} {valid, errors}
     */
    validateFormData(formData) {
        const errors = [];
        
        if (!formData.unit_code) {
            errors.push('請輸入單位代碼');
        } else if (!Unit.isValidCode(formData.unit_code)) {
            errors.push('單位代碼格式錯誤');
        }
        
        if (!formData.unit_name) {
            errors.push('請輸入單位名稱');
        } else if (!Unit.isValidName(formData.unit_name)) {
            errors.push('單位名稱格式錯誤');
        }
        
        if (formData.admin_users.length === 0) {
            errors.push('至少需要新增一位管理者');
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    },
    
    /**
     * 確認建立
     * @param {Object} formData - 表單資料
     * @returns {Promise<boolean>}
     */
    async confirmCreate(formData) {
        return new Promise((resolve) => {
            Modal.open({
                title: '確認建立單位',
                content: `
                    <div class="confirm-content">
                        <p>請確認以下資訊:</p>
                        <table class="confirm-table">
                            <tr>
                                <td><strong>單位代碼:</strong></td>
                                <td>${formData.unit_code}</td>
                            </tr>
                            <tr>
                                <td><strong>單位名稱:</strong></td>
                                <td>${formData.unit_name}</td>
                            </tr>
                            <tr>
                                <td><strong>管理者:</strong></td>
                                <td>${formData.admin_users.length} 人</td>
                            </tr>
                            <tr>
                                <td><strong>排班者:</strong></td>
                                <td>${formData.scheduler_users.length} 人</td>
                            </tr>
                        </table>
                        <p style="margin-top: 16px; color: #666;">
                            建立後將自動產生 3 個 Google Sheets 檔案，並分享給指定的使用者。
                        </p>
                    </div>
                    <style>
                        .confirm-table {
                            width: 100%;
                            margin: 12px 0;
                        }
                        .confirm-table td {
                            padding: 8px 0;
                        }
                        .confirm-table td:first-child {
                            width: 120px;
                        }
                    </style>
                `,
                onConfirm: () => resolve(true),
                onCancel: () => resolve(false),
                confirmText: '確認建立',
                cancelText: '取消'
            });
        });
    },
    
    /**
     * 顯示成功訊息
     * @param {Object} result - 建立結果
     */
    showSuccessMessage(result) {
        const sheetsLinks = `
            <div style="margin-top: 12px;">
                <strong>已建立的 Google Sheets:</strong><br>
                <a href="${result.settings_sheet_url}" target="_blank" style="display: block; margin-top: 4px;">
                    📊 ${result.unit_code}_設定檔
                </a>
                <a href="${result.pre_schedule_sheet_url}" target="_blank" style="display: block; margin-top: 4px;">
                    📝 ${result.unit_code}_預班表
                </a>
                <a href="${result.schedule_sheet_url}" target="_blank" style="display: block; margin-top: 4px;">
                    📅 ${result.unit_code}_排班表
                </a>
            </div>
        `;
        
        Notification.success(
            '單位建立成功',
            `單位「${result.unit_name}」已建立完成!${sheetsLinks}`,
            5000
        );
    }
};

// 讓單位新增模組可在全域使用
if (typeof window !== 'undefined') {
    window.UnitCreate = UnitCreate;
}