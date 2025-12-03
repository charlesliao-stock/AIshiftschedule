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
    // 關鍵修正：確保這兩個陣列有被定義
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
        const ROLES = CONSTANTS.ROLES;
        
        this.routes = {
            // === 一般使用者功能 ===
            '/': { name: 'dashboard', title: '主控台', loadModule: () => this.loadDashboard() },
            '/index.html': { name: 'dashboard', title: '主控台', loadModule: () => this.loadDashboard() },
            '/dashboard': { name: 'dashboard', title: '主控台', loadModule: () => this.loadDashboard() },
            '/my-schedule': { name: 'my-schedule', title: '查看班表', loadModule: () => this.loadMySchedule() },
            '/pre-schedule': { name: 'pre-schedule', title: '預班需求', loadModule: () => this.loadPreSchedule() },
            '/swap-request': { name: 'swap-request', title: '換班申請', loadModule: () => this.loadSwapRequest() },
            '/statistics': { name: 'statistics', title: '統計報表', loadModule: () => this.loadStatistics() },
            '/profile': { name: 'profile', title: '個人設定', loadModule: () => this.loadProfile() },

            // === 單位管理者功能 ===
            '/schedule-management': { 
                name: 'schedule-mgmt', title: '排班管理', 
                roles: [ROLES.ADMIN, ROLES.MANAGER], 
                loadModule: () => this.loadScheduleManagement() 
            },
            '/pre-schedule-management': { 
                name: 'pre-schedule-mgmt', title: '預班管理', 
                roles: [ROLES.ADMIN, ROLES.MANAGER], 
                loadModule: () => this.loadPreScheduleManagement() 
            },
            '/swap-approval': { 
                name: 'swap-approval', title: '換班審核', 
                roles: [ROLES.ADMIN, ROLES.MANAGER], 
                loadModule: () => this.loadSwapApproval() 
            },
            '/staff-management': { 
                name: 'staff-mgmt', title: '人員管理', 
                roles: [ROLES.ADMIN, ROLES.MANAGER], 
                loadModule: () => this.loadUnitStaffManagement() 
            },
            '/shift-settings': { 
                name: 'shift-settings', title: '班別設定', 
                roles: [ROLES.ADMIN, ROLES.MANAGER], 
                loadModule: () => this.loadShiftSettings() 
            },

            // === 系統管理者功能 ===
            '/unit-maintenance': { 
                name: 'unit-maintenance', title: '單位維護', 
                roles: [ROLES.ADMIN], 
                loadModule: () => this.loadUnits() 
            },
            '/global-staff': { 
                name: 'global-staff', title: '全域人員管理', 
                roles: [ROLES.ADMIN], 
                loadModule: () => this.loadGlobalStaff() 
            },
            '/labor-law': { 
                name: 'labor-law', title: '勞基法規範', 
                roles: [ROLES.ADMIN], 
                loadModule: () => this.loadLaborLaw() 
            },
            '/holiday-settings': { 
                name: 'holiday-settings', title: '假日設定', 
                roles: [ROLES.ADMIN], 
                loadModule: () => this.loadHolidaySettings() 
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

        const route = this.routes[cleanPath] || this.routes['/'];
        
        console.log('[Router] 導向:', cleanPath, '->', route.name);
        
        // 權限檢查
        if (route.requireAuth !== false && !Auth.isAuthenticated()) {
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
    
    // ==================== 模組載入實作 ====================
    
    // 通用載入器
    async loadModule(path, exportName, initMethod, params = null) {
        const mainContent = document.getElementById('main-content');
        // 可在此處加入載入動畫
        
        try {
            const module = await import(path);
            const Module = module[exportName] || module.default;
            
            if (Module && Module[initMethod]) {
                if (params) await Module[initMethod](params);
                else await Module[initMethod]();
            } else {
                throw new Error(`模組 ${exportName} 未匯出 ${initMethod} 方法`);
            }
        } catch (error) {
            console.error(`載入 ${path} 失敗:`, error);
            mainContent.innerHTML = `<div class="alert alert-danger">載入失敗: ${error.message}</div>`;
        }
    },

    showPlaceholder(title, desc) {
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = `
            <div class="text-center mt-5">
                <div style="font-size: 48px; margin-bottom: 20px; color: #cbd5e1;">🚧</div>
                <h1>${title}</h1>
                <p class="text-muted">${desc}</p>
                <button class="btn btn-secondary mt-3" onclick="window.history.back()">返回</button>
            </div>`;
    },

    // --- 具體頁面載入 ---

    async loadDashboard() {
        const mainContent = document.getElementById('main-content');
        if (!mainContent) return;

        const user = Auth.getCurrentUser();
        const roleName = CONSTANTS.ROLE_NAMES[user.role] || user.role;
        
        mainContent.innerHTML = `
            <div class="dashboard-header mb-4">
                <h1>${roleName}主控台</h1>
                <p class="text-muted">歡迎回來，${user.displayName || user.email}</p>
            </div>
            <div class="row">
                <div class="col-md-12">
                    <div class="alert alert-info">
                        <strong>系統公告：</strong> 歡迎使用新版排班系統 (v2.0.0)。
                    </div>
                </div>
            </div>
        `;
    },

    async loadMySchedule() {
        // 個人班表：重用 Schedule 模組，但傳入 viewMode: 'personal'
        await this.loadModule('../modules/schedule/schedule.js', 'ScheduleManagement', 'init', { viewMode: 'personal' });
    },

    async loadPreSchedule() {
        // 個人預班
        await this.loadModule('../modules/pre-schedule/pre-schedule.js', 'PreSchedule', 'init');
    },

    async loadSwapRequest() {
        this.showPlaceholder('換班申請', '提出換班需求的功能正在開發中...');
    },

    async loadStatistics() {
        this.showPlaceholder('統計報表', '個人與單位統計報表即將上線');
    },

    async loadProfile() {
        this.showPlaceholder('個人設定', '修改密碼與個人資料功能開發中');
    },

    // --- 單位管理者功能 ---

    async loadScheduleManagement() {
        await this.loadModule('../modules/schedule/schedule.js', 'ScheduleManagement', 'init');
    },

    async loadPreScheduleManagement() {
        // 傳入 mode: 'manager' 讓模組知道要顯示管理介面
        await this.loadModule('../modules/pre-schedule/pre-schedule.js', 'PreSchedule', 'init', { mode: 'manager' });
    },

    async loadSwapApproval() {
        this.showPlaceholder('換班審核', '審核同仁換班申請的功能開發中');
    },

    async loadUnitStaffManagement() {
        // 單位人員管理：使用 StaffManagement 模組
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = `<div id="unit-staff-container"></div>`;
        await this.loadModule('../modules/settings/staff-management.js', 'StaffManagement', 'init', document.getElementById('unit-staff-container'));
    },

    async loadShiftSettings() {
        // 班別設定：使用 ShiftManagement 模組
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = `<div id="shift-settings-container"></div>`;
        await this.loadModule('../modules/settings/shift-management.js', 'ShiftManagement', 'init', document.getElementById('shift-settings-container'));
    },

    // --- 系統管理者功能 ---

    async loadUnits() {
        await this.loadModule('../modules/unit-management/unit-management.js', 'UnitManagement', 'init');
    },

    async loadGlobalStaff() {
        // 全域人員管理：可以複用 Settings 頁面或 StaffManagement
        // 這裡示範使用 Settings 頁面框架
        const module = await import('../modules/settings/settings.js');
        const Settings = module.Settings;
        Settings.currentTab = 'staff';
        await Settings.init();
    },

    async loadLaborLaw() {
        const module = await import('../modules/settings/settings.js');
        const Settings = module.Settings;
        Settings.currentTab = 'rules';
        await Settings.init();
    },

    async loadHolidaySettings() {
        const module = await import('../modules/settings/settings.js');
        const Settings = module.Settings;
        Settings.currentTab = 'holidays';
        await Settings.init();
    },
    
    // ==================== 回調管理 ====================
    
    beforeRouteChange(callback) {
        if (typeof callback === 'function') {
            this.beforeRouteChangeCallbacks.push(callback);
        }
    },
    
    afterRouteChange(callback) {
        if (typeof callback === 'function') {
            this.afterRouteChangeCallbacks.push(callback);
        }
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
