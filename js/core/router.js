/**
 * js/core/router.js
 * 前端路由管理 (ES Module 版 - 完整修復版)
 */

import { Auth } from './auth.js';
import { CONSTANTS } from '../config/constants.js';
import { Notification } from '../components/notification.js';
import { Utils } from './utils.js';

export const Router = {
    currentRoute: null,
    routes: {},
    beforeRouteChangeCallbacks: [],
    afterRouteChangeCallbacks: [],
    
    // ==================== 初始化 ====================
    
    init() {
        console.log('[Router] 初始化路由系統...');
        window.router = this;        
        this.defineRoutes();
        
        window.addEventListener('popstate', () => {
            this.handleRoute();
        });
        
        this.handleRoute();
    },
    
    defineRoutes() {
        this.routes = {
            '/': {
                name: 'dashboard',
                title: '主控台',
                requireAuth: true,
                roles: null,
                loadModule: () => this.loadDashboard()
            },
            '/index.html': { 
                name: 'dashboard',
                title: '主控台',
                requireAuth: true,
                roles: null,
                loadModule: () => this.loadDashboard()
            },
            '/dashboard': {
                name: 'dashboard',
                title: '主控台',
                requireAuth: true,
                roles: null,
                loadModule: () => this.loadDashboard()
            },
            '/settings': {
                name: 'settings',
                title: '設定管理',
                requireAuth: true,
                roles: [CONSTANTS.ROLES?.ADMIN, CONSTANTS.ROLES?.SCHEDULER],
                loadModule: () => this.loadSettings()
            },
            '/pre-schedule': {
                name: 'pre-schedule',
                title: '預班管理',
                requireAuth: true,
                roles: null,
                loadModule: () => this.loadPreSchedule()
            },
            '/schedule': {
                name: 'schedule',
                title: '排班管理',
                requireAuth: true,
                roles: null,
                loadModule: () => this.loadSchedule()
            },
            '/swap': {
                name: 'swap',
                title: '換班管理',
                requireAuth: true,
                roles: null,
                loadModule: () => this.loadSwap()
            },
            '/statistics': {
                name: 'statistics',
                title: '統計報表',
                requireAuth: true,
                roles: null,
                loadModule: () => this.loadStatistics()
            },
            // [Week 2] 單位管理
            '/units': {
                name: 'units',
                title: '單位管理',
                requireAuth: true,
                roles: [CONSTANTS.ROLES?.ADMIN],
                loadModule: () => this.loadUnits()
            },
            // [新增] 使用者管理 (修復跳轉問題)
            '/users': {
                name: 'users',
                title: '使用者管理',
                requireAuth: true,
                roles: [CONSTANTS.ROLES?.ADMIN],
                loadModule: () => this.loadUsers()
            },
            // [新增] 系統設定 (修復跳轉問題)
            '/system': {
                name: 'system',
                title: '系統設定',
                requireAuth: true,
                roles: [CONSTANTS.ROLES?.ADMIN],
                loadModule: () => this.loadSystem()
            }
        };
    },
    
    // ==================== 路由處理 ====================
    
    async handleRoute() {
        const path = window.location.pathname;
        let cleanPath = path.replace('/index.html', '/').replace(/\/$/, '') || '/';
        
        // GitHub Pages 相容性處理
        const repoName = '/AIshiftschedule'; 
        if (cleanPath.startsWith(repoName)) {
            cleanPath = cleanPath.replace(repoName, '') || '/';
        }
        if (cleanPath === '') cleanPath = '/';

        // 路由比對，若找不到則回退至首頁 ('/')
        const route = this.routes[cleanPath] || this.routes['/'];
        
        console.log('[Router] 導向:', cleanPath, '->', route.name);
        
        if (route.requireAuth && !Auth.isAuthenticated()) {
            console.log('[Router] 未登入，導向登入頁');
            if (!window.location.pathname.includes('login.html')) {
                window.location.href = 'login.html';
            }
            return;
        }
        
        if (route.roles && route.roles.length > 0) {
            const userRole = Auth.getUserRole();
            if (!route.roles.includes(userRole)) {
                Notification.error('您沒有權限存取此頁面');
                this.navigate('/dashboard');
                return;
            }
        }
        
        const canContinue = await this.executeBeforeCallbacks(route);
        if (!canContinue) return;
        
        this.currentRoute = route;
        
        const sysName = CONSTANTS.SYSTEM?.NAME || '護理站排班系統';
        document.title = `${route.title} - ${sysName}`;
        
        try {
            await route.loadModule();
            this.executeAfterCallbacks(route);
        } catch (error) {
            console.error('[Router] 載入模組失敗:', error);
            Notification.error('載入頁面失敗');
        }
    },
    
    navigate(path, state = {}) {
        if (path === window.location.pathname) return;
        window.history.pushState(state, '', path);
        this.handleRoute();
    },
    
    replace(path, state = {}) {
        window.history.replaceState(state, '', path);
        this.handleRoute();
    },
    
    back() {
        window.history.back();
    },
    
    forward() {
        window.history.forward();
    },
    
    // ==================== 模組載入 ====================
    
    async loadDashboard() {
        console.log('[Router] 載入主控台');
        const mainContent = document.getElementById('main-content');
        if (!mainContent) return;

        const userRole = Auth.getUserRole();
        const currentUser = Auth.getCurrentUser();
        const displayName = currentUser?.displayName || '使用者';
        let dashboardHtml = '';
        
        if (userRole === CONSTANTS.ROLES?.ADMIN) {
             dashboardHtml = `
                <div class="dashboard-header">
                    <h1>管理者控制台</h1>
                    <p class="text-muted">歡迎回來，${displayName}</p>
                </div>
                <div class="row mt-4">
                    <div class="col-md-4">
                        <div class="card p-3 mb-3" onclick="window.router.navigate('/units')" style="cursor:pointer">
                            <h5><i class="fas fa-hospital"></i> 單位管理</h5>
                            <p>管理護理站與單位設定</p>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card p-3 mb-3" onclick="window.router.navigate('/users')" style="cursor:pointer">
                            <h5><i class="fas fa-users"></i> 使用者管理</h5>
                            <p>管理全系統使用者帳號</p>
                        </div>
                    </div>
                    <div class="col-md-4">
                        <div class="card p-3 mb-3" onclick="window.router.navigate('/settings')" style="cursor:pointer">
                            <h5><i class="fas fa-cog"></i> 系統設定</h5>
                            <p>管理班別規則與人員權限</p>
                        </div>
                    </div>
                </div>
             `;
        } else {
             dashboardHtml = `
                <div class="dashboard-header"><h1>我的排班</h1><p>歡迎回來，${displayName}</p></div>
                <div class="card mt-4">
                    <div class="card-body">
                        <h5>最新公告</h5>
                        <p>預班系統已開放，請盡速填寫。</p>
                        <button class="btn btn-primary" onclick="window.router.navigate('/pre-schedule')">前往預班</button>
                    </div>
                </div>
             `;
        }
        mainContent.innerHTML = dashboardHtml;
    },
    
    async loadSettings() {
        console.log('[Router] 載入設定管理');
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = `<div id="settings-container"></div>`;

        try {
            const module = await import('../modules/settings/settings.js');
            const Settings = module.Settings || module.default;
            
            if (Settings && Settings.init) {
                await Settings.init();
            } else {
                throw new Error('設定模組未匯出 init 方法');
            }
        } catch (error) {
            console.error('[Router] 載入設定模組失敗:', error);
            mainContent.innerHTML = `<div class="alert alert-danger">載入失敗: ${error.message}</div>`;
        }
    },
    
    async loadPreSchedule() {
        console.log('[Router] 載入預班管理');
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = `<div id="pre-schedule-container"></div>`;
        
        try {
            const module = await import('../modules/pre-schedule/pre-schedule.js');
            const PreSchedule = module.PreSchedule || module.default;
            
            if (PreSchedule && PreSchedule.init) {
                await PreSchedule.init();
            } else {
                throw new Error('預班模組未正確匯出 init 方法');
            }
        } catch (error) {
            console.error('[Router] 載入預班模組失敗:', error);
            mainContent.innerHTML = `<div class="alert alert-danger">載入失敗: ${error.message}</div>`;
        }
    },
    
    async loadSchedule() {
        console.log('[Router] 載入排班管理');
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = `<div id="schedule-container"></div>`;

        try {
            const module = await import('../modules/schedule/schedule.js');
            const Schedule = module.ScheduleManagement || module.default;
            
            if (Schedule && Schedule.init) {
                await Schedule.init();
            } else {
                throw new Error('排班模組未匯出 init 方法');
            }
        } catch (error) {
            console.error('[Router] 載入排班模組失敗:', error);
            mainContent.innerHTML = `<div class="alert alert-danger">載入失敗: ${error.message}</div>`;
        }
    },
    
    // [Week 2] 單位管理
    async loadUnits() {
        console.log('[Router] 載入單位管理');
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = `<div id="units-container"></div>`;

        try {
            const module = await import('../modules/unit-management/unit-management.js');
            const UnitManagement = module.UnitManagement || module.default;
            
            if (UnitManagement && UnitManagement.init) {
                await UnitManagement.init();
            } else {
                throw new Error('單位管理模組未匯出 init 方法');
            }
        } catch (error) {
            console.error('[Router] 載入單位管理模組失敗:', error);
            mainContent.innerHTML = `<div class="alert alert-danger">載入失敗: ${error.message}</div>`;
        }
    },

    // [新增] 使用者管理 - 暫位符
    async loadUsers() {
        console.log('[Router] 載入使用者管理 (開發中)');
        document.getElementById('main-content').innerHTML = `
            <div class="text-center mt-5">
                <div style="font-size: 48px; margin-bottom: 20px;">👥</div>
                <h1>使用者管理</h1>
                <p class="text-muted">此功能開發中，敬請期待。</p>
                <button class="btn btn-secondary mt-3" onclick="window.history.back()">返回</button>
            </div>`;
    },

    // [新增] 系統設定 - 暫位符
    async loadSystem() {
        console.log('[Router] 載入系統設定 (開發中)');
        document.getElementById('main-content').innerHTML = `
            <div class="text-center mt-5">
                <div style="font-size: 48px; margin-bottom: 20px;">⚙️</div>
                <h1>系統設定</h1>
                <p class="text-muted">此功能開發中，敬請期待。</p>
                <button class="btn btn-secondary mt-3" onclick="window.history.back()">返回</button>
            </div>`;
    },
    
    // 尚未開放的功能
    async loadSwap() {
        document.getElementById('main-content').innerHTML = `
            <div class="text-center mt-5">
                <i class="fas fa-tools fa-3x text-muted mb-3"></i>
                <h1>換班管理</h1>
                <p class="text-muted">功能開發中 (預計 Week 9 開放)</p>
            </div>`;
    },
    
    async loadStatistics() {
        document.getElementById('main-content').innerHTML = `
            <div class="text-center mt-5">
                <i class="fas fa-chart-bar fa-3x text-muted mb-3"></i>
                <h1>統計報表</h1>
                <p class="text-muted">功能開發中 (預計 Week 7 開放)</p>
            </div>`;
    },
    
    // ==================== 回調管理 ====================
    
    beforeRouteChange(callback) {
        this.beforeRouteChangeCallbacks.push(callback);
    },
    
    afterRouteChange(callback) {
        this.afterRouteChangeCallbacks.push(callback);
    },
    
    async executeBeforeCallbacks(route) {
        for (const callback of this.beforeRouteChangeCallbacks) {
            try {
                const result = await callback(route);
                if (result === false) return false;
            } catch (error) {
                console.error('[Router] 前置回調錯誤:', error);
            }
        }
        return true;
    },
    
    executeAfterCallbacks(route) {
        this.afterRouteChangeCallbacks.forEach(callback => {
            try {
                callback(route);
            } catch (error) {
                console.error('[Router] 後置回調錯誤:', error);
            }
        });
    },
    
    // ==================== 工具方法 ====================
    
    getCurrentRoute() {
        return this.currentRoute;
    },
    
    getCurrentPath() {
        return window.location.pathname;
    },
    
    getParam(name) {
        return Utils.getUrlParam(name);
    }
};
