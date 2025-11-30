/**
 * 設定管理主模組
 * 排班者/管理者 - 管理單位的各項設定
 */

const Settings = {
    currentTab: 'shifts',
    unitId: null,
    
    // ==================== 初始化 ====================
    
    /**
     * 初始化設定管理
     */
    async init() {
        console.log('[Settings] 初始化設定管理');
        
        // 檢查權限
        if (!Auth.isAdmin() && !Auth.isScheduler()) {
            Notification.error('您沒有權限存取此頁面');
            Router.navigate('/dashboard');
            return;
        }
        
        // 取得當前使用者的單位
        const user = Auth.getCurrentUser();
        this.unitId = user.unit_id;
        
        if (!this.unitId) {
            Notification.error('找不到所屬單位');
            return;
        }
        
        // 渲染介面
        this.render();
        
        // 載入預設分頁
        this.switchTab(this.currentTab);
    },
    
    // ==================== 渲染 ====================
    
    /**
     * 渲染主介面
     */
    render() {
        const mainContent = document.getElementById('main-content');
        const user = Auth.getCurrentUser();
        
        mainContent.innerHTML = `
            <div class="settings-page">
                <!-- Header -->
                <div class="page-header" style="margin-bottom: 24px;">
                    <h1 style="font-size: 28px; font-weight: 700; margin: 0 0 8px 0;">設定管理</h1>
                    <p style="color: #666; margin: 0;">${user.unit_name} - 排班相關設定</p>
                </div>
                
                <!-- Tabs -->
                <div class="tabs" id="settings-tabs">
                    <button class="tab active" data-tab="shifts">班別管理</button>
                    <button class="tab" data-tab="groups">組別管理</button>
                    <button class="tab" data-tab="staff">人員管理</button>
                    <button class="tab" data-tab="rules">排班規則</button>
                    <button class="tab" data-tab="holidays">假日設定</button>
                    <button class="tab" data-tab="notifications">通知設定</button>
                    <button class="tab" data-tab="labor">勞基法規範</button>
                </div>
                
                <!-- Tab Content -->
                <div id="settings-content" class="card">
                    <div class="card-body" style="padding: 60px; text-align: center; color: #999;">
                        <div class="loader-spinner" style="margin: 0 auto 16px;"></div>
                        <p>載入中...</p>
                    </div>
                </div>
            </div>
        `;
        
        // 綁定事件
        this.bindEvents();
    },
    
    /**
     * 綁定事件
     */
    bindEvents() {
        // Tab 切換
        const tabs = document.querySelectorAll('#settings-tabs .tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });
    },
    
    /**
     * 切換分頁
     */
    async switchTab(tabName) {
        console.log('[Settings] 切換到:', tabName);
        
        // 更新 active 狀態
        const tabs = document.querySelectorAll('#settings-tabs .tab');
        tabs.forEach(tab => {
            if (tab.getAttribute('data-tab') === tabName) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        // 更新當前分頁
        this.currentTab = tabName;
        
        // 載入對應內容
        const content = document.getElementById('settings-content');
        
        try {
            switch (tabName) {
                case 'shifts':
                    if (window.ShiftManagement) {
                        await ShiftManagement.init(this.unitId);
                    } else {
                        content.innerHTML = this.getPlaceholder('班別管理');
                    }
                    break;
                    
                case 'groups':
                    if (window.GroupManagement) {
                        await GroupManagement.init(this.unitId);
                    } else {
                        content.innerHTML = this.getPlaceholder('組別管理');
                    }
                    break;
                    
                case 'staff':
                    if (window.StaffManagement) {
                        await StaffManagement.init(this.unitId);
                    } else {
                        content.innerHTML = this.getPlaceholder('人員管理');
                    }
                    break;
                    
                case 'rules':
                    if (window.RuleManagement) {
                        await RuleManagement.init(this.unitId);
                    } else {
                        content.innerHTML = this.getPlaceholder('排班規則');
                    }
                    break;
                    
                case 'holidays':
                    if (window.HolidayManagement) {
                        await HolidayManagement.init(this.unitId);
                    } else {
                        content.innerHTML = this.getPlaceholder('假日設定');
                    }
                    break;
                    
                case 'notifications':
                    content.innerHTML = this.getPlaceholder('通知設定', '設定各種通知的發送方式和時機');
                    break;
                    
                case 'labor':
                    content.innerHTML = this.getPlaceholder('勞基法規範', '設定變形工時類型和檢查規則');
                    break;
                    
                default:
                    content.innerHTML = this.getPlaceholder('未知分頁');
            }
        } catch (error) {
            console.error('[Settings] 載入分頁失敗:', error);
            content.innerHTML = `
                <div class="card-body">
                    <div class="empty-state">
                        <div class="empty-state-icon">⚠️</div>
                        <h3 class="empty-state-title">載入失敗</h3>
                        <p class="empty-state-message">${error.message}</p>
                        <button class="btn btn-primary" onclick="Settings.switchTab('${tabName}')">
                            重試
                        </button>
                    </div>
                </div>
            `;
        }
    },
    
    /**
     * 取得佔位符內容
     */
    getPlaceholder(title, description = '') {
        return `
            <div class="card-body">
                <div class="empty-state">
                    <div class="empty-state-icon">⚙️</div>
                    <h3 class="empty-state-title">${title}</h3>
                    <p class="empty-state-message">
                        ${description || '此功能尚在開發中'}
                    </p>
                </div>
            </div>
        `;
    },
    
    // ==================== 工具方法 ====================
    
    /**
     * 取得當前單位 ID
     */
    getUnitId() {
        return this.unitId;
    },
    
    /**
     * 重新載入當前分頁
     */
    async refresh() {
        await this.switchTab(this.currentTab);
        Notification.success('已重新載入');
    }
};

// 讓設定管理可在全域使用
if (typeof window !== 'undefined') {
    window.Settings = Settings;
}