/**
 * 單位管理模組
 * 管理者專用 - 管理所有單位
 */

const UnitManagement = {
    units: [],
    selectedUnit: null,
    
    // ==================== 初始化 ====================
    
    /**
     * 初始化單位管理
     */
    async init() {
        console.log('[UnitManagement] 初始化單位管理');
        
        // 檢查權限
        if (!Auth.isAdmin()) {
            Notification.error('您沒有權限存取此頁面');
            Router.navigate('/dashboard');
            return;
        }
        
        // 渲染介面
        this.render();
        
        // 載入單位列表
        await this.loadUnits();
    },
    
    // ==================== 渲染 ====================
    
    /**
     * 渲染主介面
     */
    render() {
        const mainContent = document.getElementById('main-content');
        
        mainContent.innerHTML = `
            <div class="unit-management">
                <!-- Header -->
                <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                    <div>
                        <h1 style="font-size: 28px; font-weight: 700; margin: 0 0 8px 0;">單位管理</h1>
                        <p style="color: #666; margin: 0;">管理所有護理站單位和相關設定</p>
                    </div>
                    <button class="btn btn-primary" id="add-unit-btn">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 8px;">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        新增單位
                    </button>
                </div>
                
                <!-- 統計卡片 -->
                <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 24px;">
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <span class="stat-card-title">總單位數</span>
                            <div class="stat-card-icon" style="background: linear-gradient(135deg, #667eea, #764ba2);">📋</div>
                        </div>
                        <div class="stat-card-value" id="total-units">0</div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <span class="stat-card-title">活躍單位</span>
                            <div class="stat-card-icon" style="background: linear-gradient(135deg, #43e97b, #38f9d7);">✓</div>
                        </div>
                        <div class="stat-card-value" id="active-units">0</div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <span class="stat-card-title">總人員數</span>
                            <div class="stat-card-icon" style="background: linear-gradient(135deg, #f093fb, #f5576c);">👥</div>
                        </div>
                        <div class="stat-card-value" id="total-staff">0</div>
                    </div>
                </div>
                
                <!-- 單位列表 -->
                <div class="card">
                    <div class="card-header">
                        <h3 class="card-title">單位列表</h3>
                    </div>
                    <div class="card-body" style="padding: 0;">
                        <div id="units-table-container" style="overflow-x: auto;">
                            <div style="padding: 60px; text-align: center; color: #999;">
                                <div class="loader-spinner" style="margin: 0 auto 16px;"></div>
                                <p>載入中...</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // 綁定事件
        this.bindEvents();
    },
    
    /**
     * 渲染單位表格
     */
    renderUnitsTable() {
        const container = document.getElementById('units-table-container');
        
        if (this.units.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <h3 class="empty-state-title">尚無單位</h3>
                    <p class="empty-state-message">點擊右上角「新增單位」按鈕來建立第一個單位</p>
                </div>
            `;
            return;
        }
        
        let tableHtml = `
            <table class="table">
                <thead>
                    <tr>
                        <th>單位代碼</th>
                        <th>單位名稱</th>
                        <th>人員數</th>
                        <th>排班者</th>
                        <th>狀態</th>
                        <th>建立日期</th>
                        <th style="text-align: center;">操作</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        this.units.forEach(unit => {
            const createdDate = Utils.formatDate(unit.created_at, 'YYYY/MM/DD');
            const statusBadge = unit.status === 'active' 
                ? '<span class="badge badge-success">啟用</span>'
                : '<span class="badge badge-error">停用</span>';
            
            tableHtml += `
                <tr>
                    <td><strong>${unit.unit_code}</strong></td>
                    <td>${unit.unit_name}</td>
                    <td>${unit.total_staff || 0} 人</td>
                    <td>${unit.scheduler_users?.length || 0} 人</td>
                    <td>${statusBadge}</td>
                    <td>${createdDate}</td>
                    <td style="text-align: center;">
                        <button class="btn btn-sm btn-secondary" onclick="UnitManagement.viewUnit('${unit.unit_id}')" title="檢視">
                            👁️
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="UnitManagement.editUnit('${unit.unit_id}')" title="編輯">
                            ✏️
                        </button>
                        <button class="btn btn-sm btn-error" onclick="UnitManagement.deleteUnit('${unit.unit_id}')" title="刪除">
                            🗑️
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tableHtml += `
                </tbody>
            </table>
        `;
        
        container.innerHTML = tableHtml;
    },
    
    /**
     * 更新統計卡片
     */
    updateStatistics() {
        const totalUnits = this.units.length;
        const activeUnits = this.units.filter(u => u.status === 'active').length;
        const totalStaff = this.units.reduce((sum, u) => sum + (u.total_staff || 0), 0);
        
        document.getElementById('total-units').textContent = totalUnits;
        document.getElementById('active-units').textContent = activeUnits;
        document.getElementById('total-staff').textContent = totalStaff;
    },
    
    // ==================== 事件處理 ====================
    
    /**
     * 綁定事件
     */
    bindEvents() {
        // 新增單位按鈕
        const addBtn = document.getElementById('add-unit-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.showCreateUnitModal();
            });
        }
    },
    
    // ==================== 資料操作 ====================
    
    /**
     * 載入單位列表
     */
    async loadUnits() {
        try {
            Loading.show('載入單位列表...');
            
            this.units = await UnitService.getAllUnits();
            
            this.renderUnitsTable();
            this.updateStatistics();
            
            Loading.hide();
            
        } catch (error) {
            Loading.hide();
            console.error('[UnitManagement] 載入單位失敗:', error);
            Notification.error('載入單位列表失敗: ' + error.message);
        }
    },
    
    /**
     * 重新載入列表
     */
    async refresh() {
        await this.loadUnits();
        Notification.success('已重新載入');
    },
    
    // ==================== 單位操作 ====================
    
    /**
     * 顯示新增單位對話框
     */
    async showCreateUnitModal() {
        const result = await Modal.form('新增單位', [
            {
                name: 'unit_code',
                label: '單位代碼',
                type: 'text',
                placeholder: '例如: 9B',
                required: true
            },
            {
                name: 'unit_name',
                label: '單位名稱',
                type: 'text',
                placeholder: '例如: 9B病房',
                required: true
            },
            {
                name: 'admin_email',
                label: '管理員 Email',
                type: 'email',
                placeholder: '選填',
                required: false
            },
            {
                name: 'description',
                label: '備註',
                type: 'textarea',
                placeholder: '選填',
                required: false
            }
        ]);
        
        if (result) {
            await this.createUnit(result);
        }
    },
    
    /**
     * 創建單位
     */
    async createUnit(unitData) {
        try {
            // 檢查單位代碼是否已存在
            const exists = await UnitService.isUnitCodeExists(unitData.unit_code);
            if (exists) {
                Notification.error('單位代碼已存在');
                return;
            }
            
            const loadingModal = Modal.loading('正在創建單位...');
            
            // 創建單位 (包含 Sheets 建立)
            const newUnit = await UnitService.createUnit(unitData);
            
            loadingModal.updateMessage('單位創建成功！');
            await Utils.sleep(1000);
            loadingModal.close();
            
            Notification.success('單位創建成功！');
            
            // 顯示創建結果
            await this.showUnitCreatedModal(newUnit);
            
            // 重新載入列表
            await this.loadUnits();
            
        } catch (error) {
            console.error('[UnitManagement] 創建單位失敗:', error);
            Notification.error('創建單位失敗: ' + error.message);
        }
    },
    
    /**
     * 顯示單位創建成功訊息
     */
    async showUnitCreatedModal(unit) {
        const content = `
            <div style="padding: 20px 0;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="font-size: 48px; margin-bottom: 12px;">✅</div>
                    <h3 style="font-size: 20px; font-weight: 600; margin: 0 0 8px 0;">單位創建成功！</h3>
                    <p style="color: #666; margin: 0;">已自動建立 3 個 Google Sheets 檔案</p>
                </div>
                
                <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 16px;">
                    <div style="margin-bottom: 12px;">
                        <strong style="color: #374151;">單位資訊:</strong>
                    </div>
                    <div style="color: #6b7280; font-size: 14px; line-height: 1.8;">
                        <div>單位代碼: <strong>${unit.unit_code}</strong></div>
                        <div>單位名稱: <strong>${unit.unit_name}</strong></div>
                        <div>單位 ID: <code style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px;">${unit.unit_id}</code></div>
                    </div>
                </div>
                
                <div style="margin-bottom: 12px;">
                    <strong style="color: #374151;">已建立的 Google Sheets:</strong>
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px; font-size: 14px;">
                    <a href="${unit.settings_sheet_url}" target="_blank" class="btn btn-outline" style="justify-content: flex-start;">
                        📄 ${unit.unit_code}_設定檔.sheets
                    </a>
                    <a href="${unit.pre_schedule_sheet_url}" target="_blank" class="btn btn-outline" style="justify-content: flex-start;">
                        📝 ${unit.unit_code}_預班表.sheets
                    </a>
                    <a href="${unit.schedule_sheet_url}" target="_blank" class="btn btn-outline" style="justify-content: flex-start;">
                        📅 ${unit.unit_code}_排班表.sheets
                    </a>
                </div>
            </div>
        `;
        
        await Modal.alert(content, '單位創建成功');
    },
    
    /**
     * 檢視單位
     */
    async viewUnit(unitId) {
        try {
            const unit = this.units.find(u => u.unit_id === unitId);
            if (!unit) return;
            
            const content = `
                <div style="display: flex; flex-direction: column; gap: 16px;">
                    <div>
                        <label style="font-weight: 600; color: #374151; margin-bottom: 4px; display: block;">單位代碼</label>
                        <div>${unit.unit_code}</div>
                    </div>
                    <div>
                        <label style="font-weight: 600; color: #374151; margin-bottom: 4px; display: block;">單位名稱</label>
                        <div>${unit.unit_name}</div>
                    </div>
                    <div>
                        <label style="font-weight: 600; color: #374151; margin-bottom: 4px; display: block;">人員數</label>
                        <div>${unit.total_staff || 0} 人</div>
                    </div>
                    <div>
                        <label style="font-weight: 600; color: #374151; margin-bottom: 4px; display: block;">狀態</label>
                        <div>${unit.status === 'active' ? '✅ 啟用' : '⛔ 停用'}</div>
                    </div>
                    <div>
                        <label style="font-weight: 600; color: #374151; margin-bottom: 4px; display: block;">建立日期</label>
                        <div>${Utils.formatDate(unit.created_at, 'YYYY/MM/DD HH:mm')}</div>
                    </div>
                    <div>
                        <label style="font-weight: 600; color: #374151; margin-bottom: 8px; display: block;">Google Sheets</label>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <a href="${unit.settings_sheet_url}" target="_blank" class="btn btn-outline btn-sm">
                                📄 設定檔
                            </a>
                            <a href="${unit.pre_schedule_sheet_url}" target="_blank" class="btn btn-outline btn-sm">
                                📝 預班表
                            </a>
                            <a href="${unit.schedule_sheet_url}" target="_blank" class="btn btn-outline btn-sm">
                                📅 排班表
                            </a>
                        </div>
                    </div>
                </div>
            `;
            
            Modal.show({
                title: unit.unit_name,
                content,
                size: 'medium',
                buttons: [
                    {
                        text: '關閉',
                        className: 'btn-secondary'
                    }
                ]
            });
            
        } catch (error) {
            console.error('[UnitManagement] 檢視單位失敗:', error);
            Notification.error('檢視單位失敗');
        }
    },
    
    /**
     * 編輯單位
     */
    async editUnit(unitId) {
        try {
            const unit = this.units.find(u => u.unit_id === unitId);
            if (!unit) return;
            
            const result = await Modal.form('編輯單位', [
                {
                    name: 'unit_code',
                    label: '單位代碼',
                    type: 'text',
                    value: unit.unit_code,
                    required: true
                },
                {
                    name: 'unit_name',
                    label: '單位名稱',
                    type: 'text',
                    value: unit.unit_name,
                    required: true
                },
                {
                    name: 'status',
                    label: '狀態',
                    type: 'select',
                    value: unit.status,
                    options: [
                        { value: 'active', label: '啟用' },
                        { value: 'inactive', label: '停用' }
                    ],
                    required: true
                }
            ]);
            
            if (result) {
                Loading.show('更新單位...');
                await UnitService.updateUnit(unitId, result);
                await this.loadUnits();
                Loading.hide();
                Notification.success('單位更新成功');
            }
            
        } catch (error) {
            Loading.hide();
            console.error('[UnitManagement] 編輯單位失敗:', error);
            Notification.error('編輯單位失敗: ' + error.message);
        }
    },
    
    /**
     * 刪除單位
     */
    async deleteUnit(unitId) {
        try {
            const unit = this.units.find(u => u.unit_id === unitId);
            if (!unit) return;
            
            const confirmed = await Modal.confirm(
                `確定要刪除單位「${unit.unit_name}」嗎？\n\n⚠️ 此操作無法復原，所有相關資料都會被刪除。`,
                {
                    title: '確認刪除',
                    confirmText: '確定刪除',
                    danger: true
                }
            );
            
            if (confirmed) {
                Loading.show('刪除單位...');
                await UnitService.deleteUnit(unitId);
                await this.loadUnits();
                Loading.hide();
                Notification.success('單位已刪除');
            }
            
        } catch (error) {
            Loading.hide();
            console.error('[UnitManagement] 刪除單位失敗:', error);
            Notification.error('刪除單位失敗: ' + error.message);
        }
    }
};

// 讓單位管理模組可在全域使用
if (typeof window !== 'undefined') {
    window.UnitManagement = UnitManagement;
}