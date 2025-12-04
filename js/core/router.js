/**
 * js/core/router.js
 * 路由管理器 (最終修正版：確保渲染順序 HTML -> JS)
 */
import { Auth } from './auth.js';
import { CONSTANTS } from '../config/constants.js';

export const Router = {
    routes: {},
    
    config: {
        '/dashboard': { 
            template: 'pages/dashboard.html', 
            controller: 'js/modules/dashboard/dashboard.js',
            title: '主控台'
        },
        '/schedule-management': { 
            template: 'pages/schedule.html', 
            controller: 'js/modules/schedule/schedule.js', 
            title: '排班管理',
            roles: ['admin', 'manager']
        },
        '/unit-maintenance': { 
            template: 'pages/unit-maintenance.html', 
            controller: 'js/modules/unit-management/unit-management.js',
            title: '單位維護',
            roles: ['admin']
        },
        '/login': {
            template: 'login.html',
            title: '登入'
        }
        // ... 其他路由請依此類推 ...
    },

    init() {
        window.addEventListener('popstate', () => this.handleRoute());
        document.body.addEventListener('click', e => {
            if (e.target.matches('[data-link]')) {
                e.preventDefault();
                this.navigate(e.target.getAttribute('href'));
            }
        });
        this.handleRoute();
    },

    navigate(path) {
        history.pushState(null, null, path);
        this.handleRoute();
    },

    async handleRoute() {
        let path = window.location.pathname;
        if (path === '/' || path === '/index.html') path = '/dashboard';

        const route = this.config[path];
        const app = document.getElementById('app');

        // 404 處理
        if (!route) {
            console.warn(`[Router] 找不到路由: ${path}`);
            if (app) app.innerHTML = '<div class="p-5 text-center"><h2>404 Page Not Found</h2></div>';
            return;
        }

        // 權限檢查
        const user = Auth.getCurrentUser();
        // 如果需要登入但沒登入 -> 去登入頁
        if (path !== '/login' && !user) {
            this.navigate('/login');
            return;
        }
        // 如果有登入但權限不足 -> 回首頁
        if (route.roles && (!user || !route.roles.includes(user.role))) {
            console.warn(`[Router] 權限不足: ${path} (User Role: ${user?.role})`);
            this.navigate('/dashboard');
            return;
        }

        // 更新標題
        document.title = `${route.title} - ${CONSTANTS.SYSTEM.NAME}`;

        // 🔥 關鍵核心：依序載入 (Sequential Loading)
        try {
            // (A) 先載入 HTML
            const response = await fetch(route.template);
            if (!response.ok) throw new Error(`HTML Load Failed: ${response.statusText}`);
            const html = await response.text();

            // (B) 渲染到 DOM (確保元素存在)
            if (app) {
                app.innerHTML = html;
            } else {
                throw new Error('找不到 #app 容器');
            }

            // (C) 最後才載入並執行 JS
            if (route.controller) {
                // 加上 timestamp 防止快取
                const module = await import(`${route.controller}?t=${Date.now()}`);
                
                // 執行 init
                if (module && typeof module.init === 'function') {
                    await module.init();
                }
            }

        } catch (error) {
            console.error('[Router] 載入失敗:', error);
            if (app) app.innerHTML = `<div class="alert alert-danger m-3">頁面載入失敗: ${error.message}</div>`;
        }
    }
};
