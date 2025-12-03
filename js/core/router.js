/**
 * js/core/router.js
 * 前端路由管理 (權限對應版)
 */

import { Auth } from './auth.js';
import { CONSTANTS } from '../config/constants.js';
import { Notification } from '../components/notification.js';
import { Utils } from './utils.js';

export const Router = {
    // ... (init, handleRoute 等方法保持不變) ...
    // 請複製原有的 init, handleRoute, navigate 等基礎方法，僅修改 defineRoutes 和 載入方法

    init() {
        console.log('[Router] 初始化...');
        window.router = this;        
        this.defineRoutes();
        window.addEventListener('popstate', () => this.handleRoute());
        this.handleRoute();
    },

    defineRoutes() {
        const ROLES = CONSTANTS.ROLES;
        
        this.routes = {
            // === 一般使用者功能 ===
            '/': { name: 'dashboard', title: '主控台', loadModule: () => this.loadDashboard() },
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
                loadModule: () => this.loadUnitStaffManagement() // 單位層級的人員管理
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

    // ... (handleRoute, navigate 等方法請保留原樣) ...
    async handleRoute() {
        const path = window.location.pathname.replace('/index.html', '/').replace(/\/$/, '') || '/';
        const route = this.routes[path] || this.routes['/'];
        
        // 權限檢查
        if (route.roles) {
            const userRole = Auth.getUserRole();
            if (!route.roles.includes(userRole)) {
                Notification.error('權限不足');
                this.navigate('/dashboard');
                return;
            }
        }
        
        document.title = `${route.title} - ${CONSTANTS.SYSTEM.NAME}`;
        
        try {
            await route.loadModule();
            this.executeAfterCallbacks(route);
        } catch (error) {
            console.error(error);
        }
    },
    
    // ... (navigate, replace, hooks 等方法請保留原樣) ...
    navigate(path) {
        if (path === window.location.pathname) return;
        window.history.pushState({}, '', path);
        this.handleRoute();
    },
    
    beforeRouteChange(callback) { this.beforeRouteChangeCallbacks.push(callback); },
    afterRouteChange(callback) { this.afterRouteChangeCallbacks.push(callback); },
    
    async executeBeforeCallbacks(route) { return true; }, // 簡化
    executeAfterCallbacks(route) { this.afterRouteChangeCallbacks.forEach(cb => cb(route)); },

    // ==================== 模組載入實作 (對應新路徑) ====================

    // 1. 一般使用者
    async loadDashboard() {
        // ... (保留原本的 dashboard 邏輯) ...
        const mainContent = document.getElementById('main-content');
        const user = Auth.getCurrentUser();
        mainContent.innerHTML = `
            <div class="dashboard-header">
                <h1>${user.role === 'admin' ? '系統管理中心' : '個人主控台'}</h1>
                <p class="text-muted">歡迎回來，${user.displayName || user.email}</p>
            </div>
            `;
    },

    async loadMySchedule() {
        // 重用 Schedule 模組，但設定為唯讀或個人視圖
        await this.loadModule('../modules/schedule/schedule.js', 'ScheduleManagement', 'init', { viewMode: 'personal' });
    },

    async loadPreSchedule() {
        // 一般使用者預班介面
        await this.loadModule('../modules/pre-schedule/pre-schedule.js', 'PreSchedule', 'init');
    },

    async loadSwapRequest() {
        this.showPlaceholder('換班申請', '提出換班需求的功能開發中');
    },

    async loadStatistics() {
        this.showPlaceholder('統計報表', '查看區段間排班結果的功能開發中');
    },

    async loadProfile() {
        this.showPlaceholder('個人設定', '修改密碼與個人資料的功能開發中');
    },

    // 2. 單位管理者
    async loadScheduleManagement() {
        // 完整的排班管理介面
        await this.loadModule('../modules/schedule/schedule.js', 'ScheduleManagement', 'init');
    },

    async loadPreScheduleManagement() {
        // 預班管理介面 (審核、設定規則)
        // 這裡可以重用 PreSchedule 模組，但傳入管理模式參數
        await this.loadModule('../modules/pre-schedule/pre-schedule.js', 'PreSchedule', 'init', { mode: 'manager' });
    },

    async loadSwapApproval() {
        this.showPlaceholder('換班審核', '審核同仁換班需求的功能開發中');
    },

    async loadUnitStaffManagement() {
        // 單位人員管理 (含設定排班者、組別)
        // 這裡載入整合後的 Settings 頁面，但只顯示人員與組別分頁
        // 或者直接載入 StaffManagement 模組
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = `<div id="unit-staff-container"></div>`;
        
        try {
            // 這裡我們直接使用 StaffManagement 模組，但需要擴充它以包含組別設定
            // 暫時先導向 Settings 頁面並指定 Tab
            const module = await import('../modules/settings/settings.js');
            const Settings = module.Settings;
            Settings.currentTab = 'staff'; // 預設開啟人員分頁
            await Settings.init();
        } catch (e) { console.error(e); }
    },

    async loadShiftSettings() {
        // 班別管理 (單位層級)
        const module = await import('../modules/settings/settings.js');
        const Settings = module.Settings;
        Settings.currentTab = 'shifts';
        await Settings.init();
    },

    // 3. 系統管理者
    async loadUnits() {
        await this.loadModule('../modules/unit-management/unit-management.js', 'UnitManagement', 'init');
    },

    async loadGlobalStaff() {
        // 全域人員管理 (設定單位管理者)
        this.showPlaceholder('全域人員管理', '管理所有人員、設定單位管理者的功能開發中');
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

    // 輔助方法：通用模組載入器
    async loadModule(path, exportName, initMethod, params = null) {
        const mainContent = document.getElementById('main-content');
        // 清空並顯示 Loading (若需要)
        
        try {
            const module = await import(path);
            const Module = module[exportName] || module.default;
            if (Module && Module[initMethod]) {
                if (params) await Module[initMethod](params);
                else await Module[initMethod]();
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
                <i class="fas fa-tools fa-3x text-muted mb-3"></i>
                <h1>${title}</h1>
                <p class="text-muted">${desc}</p>
            </div>`;
    }
};
