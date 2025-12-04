/**
 * js/core/router.js
 * 路由管理器 (最終完整版)
 * 負責：網址解析、權限檢查、HTML/JS 載入順序控制
 */

import { Auth } from './auth.js';
import { CONSTANTS } from '../config/constants.js';
import { Loading } from '../components/loading.js';
import { Notification } from '../components/notification.js';

export const Router = {
    // 當前路徑
    currentPath: null,

    // ==================== 路由配置表 ====================
    // template: 靜態 HTML 檔案路徑 (可選，若無則由 JS 渲染)
    // controller: JS 模組路徑 (必須)
    // roles: 允許存取的角色 (可選，若無則代表登入即可)
    routes: {
        // --- 核心頁面 ---
        '/': {
            redirectTo: '/dashboard'
        },
        '/login': {
            template: null, // 登入頁通常是獨立的 HTML，但在 SPA 中可由 JS 渲染
            controller: '../modules/auth/login.js', // 假設有此檔案，或直接導向實體 login.html
            title: '登入',
            public: true // 不需要登入
        },
        '/dashboard': {
            template: null, // 由 JS 渲染
            controller: '../modules/dashboard/dashboard.js', // 需建立此檔案或指向現有
            title: '主控台'
        },

        // --- 排班相關 ---
        '/schedule-management': {
            template: null, 
            controller: '../modules/schedule/schedule.js',
            title: '排班管理',
            roles: [CONSTANTS.ROLES.ADMIN, CONSTANTS.ROLES.MANAGER]
        },
        '/pre-schedule': {
            template: null,
            controller: '../modules/pre-schedule/pre-schedule.js',
            title: '預班需求'
        },
        '/pre-schedule-management': {
            template: null,
            controller: '../modules/pre-schedule/pre-schedule.js', // 共用模組，內部判斷權限
            title: '預班管理',
            roles: [CONSTANTS.ROLES.ADMIN, CONSTANTS.ROLES.MANAGER]
        },

        // --- 統計相關 ---
        '/statistics': {
            template: null,
            controller: '../modules/statistics/statistics.js',
            title: '統計報表'
        },

        // --- 系統設定 (整合頁面) ---
        '/settings': {
            template: null,
            controller: '../modules/settings/settings.js',
            title: '系統設定',
            roles: [CONSTANTS.ROLES.ADMIN, CONSTANTS.ROLES.MANAGER]
        },
        // 為了支援直接連結到特定設定分頁，將這些路徑都導向 settings.js
        '/shift-settings': {
            redirectTo: '/settings', // 實際邏輯由 Settings 模組內部處理 tab
            title: '班別設定'
        },
        '/staff-management': {
            redirectTo: '/settings',
            title: '人員管理'
        },
        '/holiday-settings': {
            redirectTo: '/settings',
            title: '假日設定'
        },
        '/labor-law': {
            redirectTo: '/settings',
            title: '勞基法規'
        },

        // --- 單位管理 ---
        '/unit-maintenance': {
            template: null,
            controller: '../modules/unit-management/unit-management.js',
            title: '單位維護',
            roles: [CONSTANTS.ROLES.ADMIN]
        },
        // Alias
        '/units': {
            redirectTo: '/unit-maintenance'
        }
    },

    // ==================== 初始化 ====================

    init() {
        console.log('[Router] 初始化...');
        
        // 監聽瀏覽器上一頁/下一頁
        window.addEventListener('popstate', () => this.handleRoute());
        
        // 監聽全域點擊事件 (攔截 <a> 標籤)
        document.body.addEventListener('click', e => {
            // 尋找是否點擊了帶有 data-link 的連結或其子元素
            const link = e.target.closest('[data-link]');
            if (link) {
                e.preventDefault();
                this.navigate(link.getAttribute('href'));
            }
            // 處理一般的 <a> 標籤 (如果是站內連結)
            else if (e.target.tagName === 'A' && e.target.getAttribute('href')?.startsWith('/')) {
                const href = e.target.getAttribute('href');
                // 排除下載連結或新視窗
                if (!e.target.getAttribute('download') && e.target.target !== '_blank') {
                    e.preventDefault();
                    this.navigate(href);
                }
            }
        });

        // 啟動路由
        this.handleRoute();
    },

    // ==================== 導航操作 ====================

    navigate(path) {
        window.history.pushState(null, null, path);
        this.handleRoute();
    },

    async handleRoute() {
        let path = window.location.pathname;
        
        // 修正 path (移除 index.html 或結尾斜線)
        path = path.replace('/index.html', '').replace(/\/$/, '') || '/';
        
        // 1. 取得路由設定
        let route = this.routes[path];

        // 2. 處理 404
        if (!route) {
            console.warn(`[Router] 404 Not Found: ${path}`);
            this.render404();
            return;
        }

        // 3. 處理重新導向 (Redirect)
        if (route.redirectTo) {
            this.navigate(route.redirectTo);
            return;
        }

        // 4. 權限檢查
        const user = Auth.getCurrentUser();
        
        // 如果不是公開頁面且未登入 -> 導向登入頁
        if (!route.public && !user) {
            console.log('[Router] 未登入，導向登入頁');
            // 如果是實體 login.html，使用 location.href
            if (path !== '/login') {
                window.location.href = 'login.html';
                return;
            }
        }

        // 如果已登入但嘗試去登入頁 -> 導向首頁
        if (path === '/login' && user) {
            this.navigate('/dashboard');
            return;
        }

        // 角色權限檢查
        if (route.roles && user) {
            const userRole = user.role || CONSTANTS.ROLES.USER;
            // 只要符合其中一個角色即可
            if (!route.roles.includes(userRole)) {
                console.warn(`[Router] 權限不足: ${path} (User: ${userRole})`);
                Notification.error('您沒有權限存取此頁面');
                this.navigate('/dashboard');
                return;
            }
        }

        // 5. 開始渲染流程
        this.currentPath = path;
        document.title = `${route.title} - ${CONSTANTS.SYSTEM.NAME}`;
        
        // 更新 Sidebar 狀態
        this.updateSidebarActiveState(path);

        await this.loadPage(route);
    },

    // ==================== 核心載入邏輯 ====================

    async loadPage(route) {
        const appContainer = document.getElementById('main-content');
        if (!appContainer) {
            console.error('[Router] 找不到 #main-content 容器');
            return;
        }

        try {
            Loading.show();

            // (A) 重置容器
            // 這裡可以插入一個空的 div 確保容器存在且乾淨，供 Controller 使用
            const pageId = route.controller.split('/').pop().replace('.js', '-container');
            appContainer.innerHTML = `<div id="${pageId}" class="fade-in"></div>`;
            const contentContainer = document.getElementById(pageId);

            // (B) 載入 HTML 模板 (如果有)
            if (route.template) {
                try {
                    const response = await fetch(route.template);
                    if (!response.ok) throw new Error('Template load failed');
                    const html = await response.text();
                    contentContainer.innerHTML = html;
                } catch (err) {
                    console.warn('[Router] Template 載入失敗，將由 JS 處理渲染', err);
                }
            }

            // (C) 載入並執行 JS Controller
            if (route.controller) {
                // 加入 timestamp 避免瀏覽器快取舊的模組檔案
                const modulePath = `${route.controller}?t=${Date.now()}`;
                console.log(`[Router] 載入模組: ${modulePath}`);
                
                const module = await import(modulePath);

                // 智慧偵測 init 方法
                // 1. 嘗試直接找 export 的 init (ES Module)
                // 2. 嘗試找 default export 的 init (Class new instance)
                // 3. 嘗試遍歷 export 的物件找 init (例如 export const UnitManagement = { init... })
                
                if (typeof module.init === 'function') {
                    await module.init();
                } else if (module.default && typeof module.default.init === 'function') {
                    await module.default.init();
                } else {
                    // 尋找具名匯出 (例如 UnitManagement)
                    const exportedObj = Object.values(module).find(exp => exp && typeof exp.init === 'function');
                    if (exportedObj) {
                        await exportedObj.init();
                    } else {
                        console.warn(`[Router] 模組 ${route.controller} 沒有 init 方法`);
                    }
                }
            }

        } catch (error) {
            console.error('[Router] 頁面載入錯誤:', error);
            appContainer.innerHTML = `
                <div class="error-state p-5 text-center">
                    <h3 class="text-danger">頁面載入失敗</h3>
                    <p class="text-muted">${error.message}</p>
                    <button class="btn btn-secondary mt-3" onclick="window.location.reload()">重新整理</button>
                </div>
            `;
        } finally {
            Loading.hide();
        }
    },

    // ==================== 輔助功能 ====================

    render404() {
        const app = document.getElementById('main-content');
        if (app) {
            app.innerHTML = `
                <div class="empty-state p-5">
                    <div style="font-size: 64px;">404</div>
                    <h3>找不到頁面</h3>
                    <p>您要求的頁面不存在或已被移除。</p>
                    <a href="/" class="btn btn-primary mt-3" data-link>回首頁</a>
                </div>
            `;
        }
    },

    updateSidebarActiveState(path) {
        // 移除所有 active
        document.querySelectorAll('.sidebar-menu-link').forEach(link => {
            link.classList.remove('active');
        });

        // 加入當前 active (包含父層路徑匹配)
        // 例如 /shift-settings 可以點亮 /settings 或它自己的連結
        const activeLink = document.querySelector(`.sidebar-menu-link[href="${path}"]`) || 
                           document.querySelector(`.sidebar-menu-link[data-path="${path}"]`);
        
        if (activeLink) {
            activeLink.classList.add('active');
        }
    },

    // 提供外部註冊 hook (例如 Sidebar 想要在路由變更後自動收合)
    afterRouteChangeCallback: null,
    
    afterRouteChange(callback) {
        this.afterRouteChangeCallback = callback;
    }
};
