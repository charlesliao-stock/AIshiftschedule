/**
 * js/core/router.js
 * 路由管理器 (GitHub Pages 修正版)
 */
import { Auth } from './auth.js';
import { CONSTANTS } from '../config/constants.js';
import { Loading } from '../components/loading.js';
import { Notification } from '../components/notification.js';

export const Router = {
    currentPath: null,

    // 🔥 設定您的 GitHub Repository 名稱
    BASE_PATH: '/AIshiftschedule',

    routes: {
        '/': { redirectTo: '/dashboard' },
        '/login': {
            template: null,
            controller: '../modules/auth/login.js',
            title: '登入',
            public: true
        },
        '/dashboard': {
            template: null,
            controller: '../modules/dashboard/dashboard.js',
            title: '主控台'
        },
        // --- 補上缺失的路由以避免 404 ---
        '/my-schedule': { redirectTo: '/schedule-management' }, // 暫時導向排班管理
        '/swap-request': { redirectTo: '/dashboard' },
        '/profile': { redirectTo: '/settings' },
        '/swap-approval': { redirectTo: '/dashboard' },
        
        // --- 原有路由 ---
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
            controller: '../modules/pre-schedule/pre-schedule.js',
            title: '預班管理',
            roles: [CONSTANTS.ROLES.ADMIN, CONSTANTS.ROLES.MANAGER]
        },
        '/statistics': {
            template: null,
            controller: '../modules/statistics/statistics.js',
            title: '統計報表'
        },
        '/settings': {
            template: null,
            controller: '../modules/settings/settings.js',
            title: '系統設定',
            roles: [CONSTANTS.ROLES.ADMIN, CONSTANTS.ROLES.MANAGER]
        },
        '/shift-settings': { redirectTo: '/settings', title: '班別設定' },
        '/staff-management': { redirectTo: '/settings', title: '人員管理' },
        '/holiday-settings': { redirectTo: '/settings', title: '假日設定' },
        '/labor-law': { redirectTo: '/settings', title: '勞基法規' },
        '/unit-maintenance': {
            template: null,
            controller: '../modules/unit-management/unit-management.js',
            title: '單位維護',
            roles: [CONSTANTS.ROLES.ADMIN]
        },
        '/units': { redirectTo: '/unit-maintenance' }
    },

    init() {
        console.log('[Router] 初始化...');
        window.addEventListener('popstate', () => this.handleRoute());
        
        document.body.addEventListener('click', e => {
            const link = e.target.closest('[data-link]');
            if (link) {
                e.preventDefault();
                this.navigate(link.getAttribute('href'));
            } else if (e.target.tagName === 'A' && e.target.getAttribute('href')?.startsWith('/')) {
                const href = e.target.getAttribute('href');
                if (!e.target.getAttribute('download') && e.target.target !== '_blank') {
                    e.preventDefault();
                    this.navigate(href);
                }
            }
        });

        this.handleRoute();
    },

    navigate(path) {
        // 在推入歷史紀錄時，補回 BASE_PATH
        const fullPath = this.BASE_PATH + path;
        window.history.pushState(null, null, fullPath);
        this.handleRoute();
    },

    async handleRoute() {
        let path = window.location.pathname;
        
        // 🔥 關鍵修正：移除 BASE_PATH 以取得真實路由
        if (this.BASE_PATH && path.startsWith(this.BASE_PATH)) {
            path = path.replace(this.BASE_PATH, '');
        }

        // 移除 index.html 或結尾斜線
        path = path.replace('/index.html', '').replace(/\/$/, '') || '/';
        
        let route = this.routes[path];

        if (!route) {
            console.warn(`[Router] 404 Not Found: ${path}`);
            this.render404();
            return;
        }

        if (route.redirectTo) {
            this.navigate(route.redirectTo);
            return;
        }

        const user = Auth.getCurrentUser();
        
        if (!route.public && !user) {
            console.log('[Router] 未登入，導向登入頁');
            if (path !== '/login') {
                window.location.href = `${this.BASE_PATH}/login.html`; 
                return;
            }
        }

        if (path === '/login' && user) {
            this.navigate('/dashboard');
            return;
        }

        if (route.roles && user) {
            const userRole = user.role || CONSTANTS.ROLES.USER;
            if (!route.roles.includes(userRole)) {
                Notification.error('您沒有權限存取此頁面');
                this.navigate('/dashboard');
                return;
            }
        }

        this.currentPath = path;
        document.title = `${route.title} - ${CONSTANTS.SYSTEM.NAME}`;
        this.updateSidebarActiveState(path);

        await this.loadPage(route);
    },

    async loadPage(route) {
        const appContainer = document.getElementById('main-content');
        if (!appContainer) return;

        try {
            Loading.show();
            const pageId = route.controller.split('/').pop().replace('.js', '-container');
            appContainer.innerHTML = `<div id="${pageId}" class="fade-in"></div>`;
            const contentContainer = document.getElementById(pageId);

            if (route.template) {
                try {
                    const response = await fetch(route.template);
                    if (!response.ok) throw new Error('Template load failed');
                    const html = await response.text();
                    contentContainer.innerHTML = html;
                } catch (err) {}
            }

            if (route.controller) {
                const modulePath = `${route.controller}?t=${Date.now()}`;
                const module = await import(modulePath);

                if (typeof module.init === 'function') {
                    await module.init();
                } else if (module.default && typeof module.default.init === 'function') {
                    await module.default.init();
                } else {
                    const exportedObj = Object.values(module).find(exp => exp && typeof exp.init === 'function');
                    if (exportedObj) await exportedObj.init();
                }
            }
        } catch (error) {
            console.error('[Router] 頁面載入錯誤:', error);
            appContainer.innerHTML = `<div class="error-state p-5 text-center">頁面載入失敗: ${error.message}</div>`;
        } finally {
            Loading.hide();
        }
    },

    render404() {
        const app = document.getElementById('main-content');
        if (app) app.innerHTML = '<div class="empty-state p-5"><h3>404 找不到頁面</h3></div>';
    },

    updateSidebarActiveState(path) {
        document.querySelectorAll('.sidebar-menu-link').forEach(link => link.classList.remove('active'));
        const activeLink = document.querySelector(`.sidebar-menu-link[href="${path}"]`) || 
                           document.querySelector(`.sidebar-menu-link[data-path="${path}"]`);
        if (activeLink) activeLink.classList.add('active');
    },

    afterRouteChangeCallback: null,
    afterRouteChange(callback) { this.afterRouteChangeCallback = callback; }
};
