/**
 * 前端路由管理
 * 處理頁面導航、權限檢查、內容載入
 */

const Router = {
    currentRoute: null,
    routes: {},
    beforeRouteChangeCallbacks: [],
    afterRouteChangeCallbacks: [],
    
    // ==================== 初始化 ====================
    
    /**
     * 初始化路由系統
     */
    init() {
        console.log('[Router] 初始化路由系統...');
        
        // 定義路由
        this.defineRoutes();
        
        // 監聽 URL 變化
        window.addEventListener('popstate', () => {
            this.handleRoute();
        });
        
        // 處理初始路由
        this.handleRoute();
    },
    
    /**
     * 定義所有路由
     */
    defineRoutes() {
        this.routes = {
            // 主控台
            '/': {
                name: 'dashboard',
                title: '主控台',
                requireAuth: true,
                roles: null, // 所有角色都可存取
                loadModule: () => this.loadDashboard()
            },
            '/dashboard': {
                name: 'dashboard',
                title: '主控台',
                requireAuth: true,
                roles: null,
                loadModule: () => this.loadDashboard()
            },
            
            // 設定管理
            '/settings': {
                name: 'settings',
                title: '設定管理',
                requireAuth: true,
                roles: [CONSTANTS.ROLES.ADMIN, CONSTANTS.ROLES.SCHEDULER],
                loadModule: () => this.loadSettings()
            },
            
            // 預班管理
            '/pre-schedule': {
                name: 'pre-schedule',
                title: '預班管理',
                requireAuth: true,
                roles: null,
                loadModule: () => this.loadPreSchedule()
            },
            
            // 排班管理
            '/schedule': {
                name: 'schedule',
                title: '排班管理',
                requireAuth: true,
                roles: null,
                loadModule: () => this.loadSchedule()
            },
            
            // 換班管理
            '/swap': {
                name: 'swap',
                title: '換班管理',
                requireAuth: true,
                roles: null,
                loadModule: () => this.loadSwap()
            },
            
            // 統計報表
            '/statistics': {
                name: 'statistics',
                title: '統計報表',
                requireAuth: true,
                roles: null,
                loadModule: () => this.loadStatistics()
            },
            
            // 單位管理
            '/units': {
                name: 'units',
                title: '單位管理',
                requireAuth: true,
                roles: [CONSTANTS.ROLES.ADMIN],
                loadModule: () => this.loadUnits()
            }
        };
    },
    
    // ==================== 路由處理 ====================
    
    /**
     * 處理當前路由
     */
    async handleRoute() {
        const path = window.location.pathname;
        const route = this.routes[path] || this.routes['/'];
        
        console.log('[Router] 導向:', path);
        
        // 檢查認證
        if (route.requireAuth && !Auth.isAuthenticated()) {
            console.log('[Router] 未登入，導向登入頁');
            window.location.href = 'login.html';
            return;
        }
        
        // 檢查角色權限
        if (route.roles && route.roles.length > 0) {
            const userRole = Auth.getUserRole();
            if (!route.roles.includes(userRole)) {
                Notification.error('您沒有權限存取此頁面');
                this.navigate('/dashboard');
                return;
            }
        }
        
        // 執行前置回調
        const canContinue = await this.executeBeforeCallbacks(route);
        if (!canContinue) return;
        
        // 更新當前路由
        this.currentRoute = route;
        
        // 更新頁面標題
        document.title = `${route.title} - ${CONSTANTS.SYSTEM.NAME}`;
        
        // 載入模組
        try {
            await route.loadModule();
            
            // 執行後置回調
            this.executeAfterCallbacks(route);
            
        } catch (error) {
            console.error('[Router] 載入模組失敗:', error);
            Notification.error('載入頁面失敗');
        }
    },
    
    /**
     * 導航到指定路由
     * @param {string} path - 路徑
     * @param {Object} state - 狀態物件
     */
    navigate(path, state = {}) {
        if (path === window.location.pathname) return;
        
        // 更新 URL
        window.history.pushState(state, '', path);
        
        // 處理路由
        this.handleRoute();
    },
    
    /**
     * 替換當前路由 (不產生歷史記錄)
     * @param {string} path - 路徑
     * @param {Object} state - 狀態物件
     */
    replace(path, state = {}) {
        window.history.replaceState(state, '', path);
        this.handleRoute();
    },
    
    /**
     * 返回上一頁
     */
    back() {
        window.history.back();
    },
    
    /**
     * 前往下一頁
     */
    forward() {
        window.history.forward();
    },
    
    // ==================== 模組載入 ====================
    
    /**
     * 載入主控台
     */
    async loadDashboard() {
        console.log('[Router] 載入主控台');
        
        const mainContent = document.getElementById('main-content');
        
        // 根據角色載入不同的儀表板
        const userRole = Auth.getUserRole();
        
        let dashboardHtml = '';
        
        if (userRole === CONSTANTS.ROLES.ADMIN) {
            dashboardHtml = `
                <div class="dashboard-header">
                    <h1>管理者控制台</h1>
                    <p class="text-muted">歡迎回來，${Auth.getCurrentUser().displayName}</p>
                </div>
                
                <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-top: 24px;">
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <span class="stat-card-title">總單位數</span>
                            <div class="stat-card-icon" style="background: linear-gradient(135deg, #667eea, #764ba2);">
                                📋
                            </div>
                        </div>
                        <div class="stat-card-value">8</div>
                        <div class="stat-card-change positive">本月新增 2 個</div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <span class="stat-card-title">總使用者數</span>
                            <div class="stat-card-icon" style="background: linear-gradient(135deg, #f093fb, #f5576c);">
                                👥
                            </div>
                        </div>
                        <div class="stat-card-value">156</div>
                        <div class="stat-card-change positive">+12 本月</div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <span class="stat-card-title">系統狀態</span>
                            <div class="stat-card-icon" style="background: linear-gradient(135deg, #4facfe, #00f2fe);">
                                ⚡
                            </div>
                        </div>
                        <div class="stat-card-value">正常</div>
                        <div class="stat-card-change" style="color: #10b981;">所有服務運行中</div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <span class="stat-card-title">資料備份</span>
                            <div class="stat-card-icon" style="background: linear-gradient(135deg, #43e97b, #38f9d7);">
                                💾
                            </div>
                        </div>
                        <div class="stat-card-value">今日</div>
                        <div class="stat-card-change">最後備份: 02:00</div>
                    </div>
                </div>
                
                <div class="card mt-4">
                    <div class="card-header">
                        <h3 class="card-title">快速操作</h3>
                    </div>
                    <div class="card-body">
                        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                            <button class="btn btn-primary" onclick="Router.navigate('/units')">
                                管理單位
                            </button>
                            <button class="btn btn-secondary" onclick="alert('功能開發中')">
                                使用者管理
                            </button>
                            <button class="btn btn-secondary" onclick="alert('功能開發中')">
                                系統設定
                            </button>
                            <button class="btn btn-secondary" onclick="alert('功能開發中')">
                                查看日誌
                            </button>
                        </div>
                    </div>
                </div>
            `;
        } else if (userRole === CONSTANTS.ROLES.SCHEDULER) {
            const unit = Auth.getUserUnit();
            dashboardHtml = `
                <div class="dashboard-header">
                    <h1>${unit.name} - 排班控制台</h1>
                    <p class="text-muted">歡迎回來，${Auth.getCurrentUser().displayName}</p>
                </div>
                
                <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-top: 24px;">
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <span class="stat-card-title">預班進度</span>
                            <div class="stat-card-icon" style="background: linear-gradient(135deg, #667eea, #764ba2);">
                                📝
                            </div>
                        </div>
                        <div class="stat-card-value">85%</div>
                        <div class="stat-card-change">17/20 人已預班</div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <span class="stat-card-title">本月排班</span>
                            <div class="stat-card-icon" style="background: linear-gradient(135deg, #f093fb, #f5576c);">
                                📅
                            </div>
                        </div>
                        <div class="stat-card-value">已公告</div>
                        <div class="stat-card-change positive">無衝突</div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <span class="stat-card-title">待處理換班</span>
                            <div class="stat-card-icon" style="background: linear-gradient(135deg, #4facfe, #00f2fe);">
                                🔄
                            </div>
                        </div>
                        <div class="stat-card-value">3</div>
                        <div class="stat-card-change" style="color: #f59e0b;">需要審核</div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <span class="stat-card-title">人力狀態</span>
                            <div class="stat-card-icon" style="background: linear-gradient(135deg, #43e97b, #38f9d7);">
                                👨‍⚕️
                            </div>
                        </div>
                        <div class="stat-card-value">20人</div>
                        <div class="stat-card-change positive">人力充足</div>
                    </div>
                </div>
                
                <div class="card mt-4">
                    <div class="card-header">
                        <h3 class="card-title">快速操作</h3>
                    </div>
                    <div class="card-body">
                        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                            <button class="btn btn-primary" onclick="Router.navigate('/schedule')">
                                查看排班表
                            </button>
                            <button class="btn btn-primary" onclick="Router.navigate('/pre-schedule')">
                                管理預班
                            </button>
                            <button class="btn btn-secondary" onclick="Router.navigate('/settings')">
                                設定管理
                            </button>
                            <button class="btn btn-secondary" onclick="Router.navigate('/statistics')">
                                統計報表
                            </button>
                        </div>
                    </div>
                </div>
            `;
        } else {
            const unit = Auth.getUserUnit();
            dashboardHtml = `
                <div class="dashboard-header">
                    <h1>我的排班</h1>
                    <p class="text-muted">歡迎回來，${Auth.getCurrentUser().displayName} (${unit.name})</p>
                </div>
                
                <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-top: 24px;">
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <span class="stat-card-title">本月工作天數</span>
                            <div class="stat-card-icon" style="background: linear-gradient(135deg, #667eea, #764ba2);">
                                📅
                            </div>
                        </div>
                        <div class="stat-card-value">22</div>
                        <div class="stat-card-change">休假 9 天</div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <span class="stat-card-title">本月大夜班</span>
                            <div class="stat-card-icon" style="background: linear-gradient(135deg, #f093fb, #f5576c);">
                                🌙
                            </div>
                        </div>
                        <div class="stat-card-value">10</div>
                        <div class="stat-card-change">小夜 7 / 白班 5</div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <span class="stat-card-title">預班狀態</span>
                            <div class="stat-card-icon" style="background: linear-gradient(135deg, #4facfe, #00f2fe);">
                                📝
                            </div>
                        </div>
                        <div class="stat-card-value">已提交</div>
                        <div class="stat-card-change positive">4/4 次</div>
                    </div>
                    
                    <div class="stat-card">
                        <div class="stat-card-header">
                            <span class="stat-card-title">換班申請</span>
                            <div class="stat-card-icon" style="background: linear-gradient(135deg, #43e97b, #38f9d7);">
                                🔄
                            </div>
                        </div>
                        <div class="stat-card-value">1</div>
                        <div class="stat-card-change" style="color: #f59e0b;">待審核</div>
                    </div>
                </div>
                
                <div class="card mt-4">
                    <div class="card-header">
                        <h3 class="card-title">快速操作</h3>
                    </div>
                    <div class="card-body">
                        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                            <button class="btn btn-primary" onclick="Router.navigate('/schedule')">
                                查看排班表
                            </button>
                            <button class="btn btn-primary" onclick="Router.navigate('/pre-schedule')">
                                提交預班
                            </button>
                            <button class="btn btn-secondary" onclick="Router.navigate('/swap')">
                                換班申請
                            </button>
                            <button class="btn btn-secondary" onclick="Router.navigate('/statistics')">
                                我的統計
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
        
        mainContent.innerHTML = dashboardHtml;
    },
    
    /**
     * 載入設定管理
     */
    async loadSettings() {
        console.log('[Router] 載入設定管理');
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = `
            <h1>設定管理</h1>
            <p class="text-muted">功能開發中 (Week 3)</p>
        `;
    },
    
    /**
     * 載入預班管理
     */
async loadPreSchedule() {
    console.log('[Router] 載入預班管理');
    
    const mainContent = document.getElementById('main-content');
    
    // 建立預班容器
    mainContent.innerHTML = `
        <div id="pre-schedule-container">
            <!-- PreScheduleView 會動態生成內容 -->
        </div>
    `;
    
    // 初始化預班模組
    try {
        // 確保 PreSchedule 模組已載入
        if (typeof PreSchedule === 'undefined') {
            throw new Error('預班模組尚未載入');
        }
        
        await PreSchedule.init();
        
    } catch (error) {
        console.error('[Router] 載入預班模組失敗:', error);
        mainContent.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">⚠️</div>
                <div class="empty-state-title">載入失敗</div>
                <div class="empty-state-message">${error.message}</div>
                <button class="btn btn-primary" onclick="Router.navigate('/pre-schedule')">
                    重新載入
                </button>
            </div>
        `;
    }
}
    /**
     * 載入排班管理
     */
    async loadSchedule() {
        console.log('[Router] 載入排班管理');
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = `
            <h1>排班管理</h1>
            <p class="text-muted">功能開發中 (Week 4)</p>
        `;
    },
    
    /**
     * 載入換班管理
     */
    async loadSwap() {
        console.log('[Router] 載入換班管理');
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = `
            <h1>換班管理</h1>
            <p class="text-muted">功能開發中 (Week 9)</p>
        `;
    },
    
    /**
     * 載入統計報表
     */
    async loadStatistics() {
        console.log('[Router] 載入統計報表');
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = `
            <h1>統計報表</h1>
            <p class="text-muted">功能開發中 (Week 7)</p>
        `;
    },
    
    /**
     * 載入單位管理
     */
    async loadUnits() {
        console.log('[Router] 載入單位管理');
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = `
            <h1>單位管理</h1>
            <p class="text-muted">功能開發中 (Week 2)</p>
        `;
    },
    
    // ==================== 回調管理 ====================
    
    /**
     * 註冊路由變更前的回調
     * @param {Function} callback - 回調函式
     */
    beforeRouteChange(callback) {
        this.beforeRouteChangeCallbacks.push(callback);
    },
    
    /**
     * 註冊路由變更後的回調
     * @param {Function} callback - 回調函式
     */
    afterRouteChange(callback) {
        this.afterRouteChangeCallbacks.push(callback);
    },
    
    /**
     * 執行前置回調
     * @param {Object} route - 路由物件
     * @returns {Promise<boolean>}
     */
    async executeBeforeCallbacks(route) {
        for (const callback of this.beforeRouteChangeCallbacks) {
            try {
                const result = await callback(route);
                if (result === false) {
                    return false;
                }
            } catch (error) {
                console.error('[Router] 前置回調錯誤:', error);
            }
        }
        return true;
    },
    
    /**
     * 執行後置回調
     * @param {Object} route - 路由物件
     */
    executeAfterCallbacks(route) {
        this.afterRouterChangeCallbacks.forEach(callback => {
            try {
                callback(route);
            } catch (error) {
                console.error('[Router] 後置回調錯誤:', error);
            }
        });
    },
    
    // ==================== 工具方法 ====================
    
    /**
     * 取得當前路由
     * @returns {Object|null}
     */
    getCurrentRoute() {
        return this.currentRoute;
    },
    
    /**
     * 取得當前路徑
     * @returns {string}
     */
    getCurrentPath() {
        return window.location.pathname;
    },
    
    /**
     * 取得 URL 參數
     * @param {string} name - 參數名稱
     * @returns {string|null}
     */
    getParam(name) {
        return Utils.getUrlParam(name);
    }
};

// 讓路由管理可在全域使用
if (typeof window !== 'undefined') {
    window.Router = Router;
}