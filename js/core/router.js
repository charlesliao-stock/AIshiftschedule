/**
 * js/core/router.js
 * 前端路由管理 (ES Module 版)
 */

import { Auth } from './auth.js';
import { CONSTANTS } from '../config/constants.js';
import { Notification } from '../components/notification.js';
import { Utils } from './utils.js';

// 為了避免循環依賴，我們可以在 loadPreSchedule 裡使用動態 import
// 或者假設這些業務模組會在稍後被載入

export const Router = {
    currentRoute: null,
    routes: {},
    beforeRouteChangeCallbacks: [],
    afterRouteChangeCallbacks: [],
    
    // ==================== 初始化 ====================
    
    init() {
        console.log('[Router] 初始化路由系統...');
        this.defineRoutes();
        
        window.addEventListener('popstate', () => {
            this.handleRoute();
        });
        
        // 處理初始路由
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
            '/index.html': { // 防止 index.html 被當作未知路由
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
            '/units': {
                name: 'units',
                title: '單位管理',
                requireAuth: true,
                roles: [CONSTANTS.ROLES?.ADMIN],
                loadModule: () => this.loadUnits()
            }
        };
    },
    
    // ==================== 路由處理 ====================
    
    async handleRoute() {
        const path = window.location.pathname;
        // 簡單的路徑比對，忽略 .html 後綴和 index.html
        let cleanPath = path.replace('/index.html', '/').replace(/\/$/, '') || '/';
        if (cleanPath === '') cleanPath = '/';

        const route = this.routes[cleanPath] || this.routes['/'];
        
        console.log('[Router] 導向:', cleanPath);
        
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
        
        // 這裡將原本的 HTML string 簡化，保留邏輯
        // 為了節省篇幅，這裡我只放關鍵邏輯，原本的 HTML template 可以照舊放入
        if (userRole === CONSTANTS.ROLES?.ADMIN) {
             dashboardHtml = `
                <div class="dashboard-header">
                    <h1>管理者控制台</h1>
                    <p class="text-muted">歡迎回來，${displayName}</p>
                </div>
                <div class="card mt-4"><div class="card-body">管理者功能區</div></div>
             `;
        } else if (userRole === CONSTANTS.ROLES?.SCHEDULER) {
             dashboardHtml = `
                <div class="dashboard-header"><h1>排班控制台</h1><p>歡迎回來，${displayName}</p></div>
                <div class="card mt-4"><div class="card-body">排班功能區</div></div>
             `;
        } else {
             dashboardHtml = `
                <div class="dashboard-header"><h1>我的排班</h1><p>歡迎回來，${displayName}</p></div>
                <div class="card mt-4"><div class="card-body">個人功能區</div></div>
             `;
        }
        mainContent.innerHTML = dashboardHtml;
    },
    
    async loadSettings() {
        console.log('[Router] 載入設定管理');
        document.getElementById('main-content').innerHTML = `<h1>設定管理</h1><p>功能開發中 (Week 3)</p>`;
    },
    
    async loadPreSchedule() {
        console.log('[Router] 載入預班管理');
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = `<div id="pre-schedule-container"></div>`;
        
        try {
            // ✅ 使用動態 import 載入 PreSchedule 模組
            // 這是 ESM 的一大優勢，用到才載入
            const module = await import('../modules/pre-schedule/pre-schedule.js');
            // 假設該模組 export default 或 export const PreSchedule
            const PreSchedule = module.PreSchedule || module.default;
            
            if (PreSchedule && PreSchedule.init) {
                await PreSchedule.init();
            } else {
                throw new Error('預班模組未正確匯出 init 方法');
            }
        } catch (error) {
            console.error('[Router] 載入預班模組失敗:', error);
            mainContent.innerHTML = `<div class="error-state">載入失敗: ${error.message}</div>`;
        }
    },
    
    async loadSchedule() {
        console.log('[Router] 載入排班管理');
        document.getElementById('main-content').innerHTML = `<h1>排班管理</h1><p>功能開發中 (Week 4)</p>`;
    },
    
    async loadSwap() {
        console.log('[Router] 載入換班管理');
        document.getElementById('main-content').innerHTML = `<h1>換班管理</h1><p>功能開發中 (Week 9)</p>`;
    },
    
    async loadStatistics() {
        console.log('[Router] 載入統計報表');
        document.getElementById('main-content').innerHTML = `<h1>統計報表</h1><p>功能開發中 (Week 7)</p>`;
    },
    
    async loadUnits() {
        console.log('[Router] 載入單位管理');
        // 這裡一樣可以用動態 import
        try {
             // 假設您之後會有 unit-management.js
             // const module = await import('../modules/unit-management/unit-management.js');
             // await module.UnitManagement.init();
             document.getElementById('main-content').innerHTML = `<h1>單位管理</h1><p>功能開發中 (Week 2)</p>`;
        } catch(e) {
             console.error(e);
        }
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