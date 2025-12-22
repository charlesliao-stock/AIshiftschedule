import { router } from "../core/Router.js";
import { authService } from "../services/firebase/AuthService.js";
import { userService } from "../services/firebase/UserService.js"; // 需引入 userService
import { MainLayoutTemplate } from "./templates/MainLayoutTemplate.js";

export class MainLayout {
    constructor(user) {
        // 優先使用 AuthService 的最新狀態 (含模擬狀態)
        this.user = authService.getProfile() || user || { name: '載入中...', role: 'guest' };
        
        // 判斷是否為「真·管理員」
        this.isRealAdmin = (this.user.role === 'system_admin') || (this.user.originalRole === 'system_admin');
        
        this.currentRole = this.user.role;
        this.autoHideTimer = null;
    }

    render() {
        const menus = this.getMenus(this.currentRole);
        const menuHtml = MainLayoutTemplate.renderMenuHtml(menus);
        const displayRoleName = this.getRoleName(this.currentRole);
        
        // 傳入 isRealAdmin 參數
        return MainLayoutTemplate.render(this.user, this.isRealAdmin, menuHtml, displayRoleName);
    }

    async afterRender() {
        this.setupSidebar();
        
        // --- 上帝模式邏輯綁定 ---
        if (this.isRealAdmin) {
            this.bindAdminControls();
        }
    }

    bindAdminControls() {
        const searchInput = document.getElementById('global-impersonate-search');
        const resultsBox = document.getElementById('global-impersonate-results');
        const exitBtn = document.getElementById('btn-global-exit');

        // 1. 退出模擬
        if (exitBtn) {
            exitBtn.addEventListener('click', () => {
                if(confirm('確定要退出模擬，回到管理員身分？')) {
                    authService.stopImpersonation();
                }
            });
        }

        // 2. 搜尋人員
        if (searchInput && resultsBox) {
            let debounce;
            searchInput.addEventListener('input', (e) => {
                const val = e.target.value.trim();
                clearTimeout(debounce);
                
                if (val.length < 1) {
                    resultsBox.style.display = 'none';
                    return;
                }

                debounce = setTimeout(async () => {
                    // 呼叫 UserService 進行搜尋
                    const users = await userService.searchUsers(val); 
                    this.renderSearchResults(users, resultsBox);
                }, 300);
            });

            // 點擊外部關閉
            document.addEventListener('click', (e) => {
                if (!searchInput.contains(e.target) && !resultsBox.contains(e.target)) {
                    resultsBox.style.display = 'none';
                }
            });
        }
    }

    renderSearchResults(users, container) {
        if (!users || users.length === 0) {
            container.innerHTML = '<div class="dropdown-item text-muted small">查無此人</div>';
        } else {
            container.innerHTML = users.slice(0, 8).map(u => {
                const unitBadge = u.unitId 
                    ? `<span class="badge bg-light text-dark border ms-auto">${u.unitId}</span>` 
                    : `<span class="badge bg-light text-muted border ms-auto">無單位</span>`;

                return `
                <a href="#" class="dropdown-item d-flex align-items-center gap-2 py-2 user-result-item" data-uid="${u.uid}">
                    <div class="rounded-circle bg-light d-flex justify-content-center align-items-center flex-shrink-0" style="width:32px; height:32px; font-size:0.8rem;">
                        ${this.getRoleIcon(u.role)}
                    </div>
                    <div class="flex-grow-1" style="line-height:1.2; min-width:0;">
                        <div class="fw-bold text-truncate" style="font-size:0.9rem;">${u.name}</div>
                        <div class="text-muted small text-truncate" style="font-size:0.75rem;">${this.getRoleName(u.role)}</div>
                    </div>
                    ${unitBadge}
                </a>
            `}).join('');

            // 綁定點擊 -> 觸發模擬
            container.querySelectorAll('.user-result-item').forEach(item => {
                item.addEventListener('click', async (e) => {
                    e.preventDefault();
                    const uid = item.dataset.uid;
                    const target = users.find(u => u.uid === uid);
                    if (target) {
                        if(confirm(`確定要模擬 [${target.name}] 的視角？\n系統將切換至 [${target.unitId || '無單位'}] 的資料環境。`)) {
                            authService.impersonate(target);
                        }
                    }
                });
            });
        }
        container.style.display = 'block';
    }

    setupSidebar() {
        const sidebar = document.getElementById('layout-sidebar');
        const header = document.getElementById('layout-header');
        const content = document.getElementById('main-view');
        const toggleBtn = document.getElementById('sidebar-toggle-btn');
        const toggleIcon = document.getElementById('sidebar-toggle-icon');

        if(toggleBtn && sidebar) {
            toggleBtn.addEventListener('click', () => {
                const isCollapsed = sidebar.classList.toggle('collapsed');
                if(header) header.classList.toggle('expanded');
                if(content) content.classList.toggle('expanded');
                if(toggleIcon) toggleIcon.className = isCollapsed ? 'fas fa-chevron-right' : 'fas fa-chevron-left';
            });
        }
    }

    updateActiveMenu(path) {
        document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
        let targetPath = path;
        if (path === '/schedule/edit') targetPath = '/schedule/list';
        if (path === '/pre-schedule/edit') targetPath = '/pre-schedule/manage';

        let target = document.querySelector(`.menu-item[data-path="${targetPath}"]`);
        if (!target && path.includes('/edit/')) {
            const mappingPath = path.replace('edit', 'list').split('/').slice(0, 4).join('/');
            target = document.querySelector(`.menu-item[data-path^="${mappingPath}"]`);
        }
        
        if (target) {
            target.classList.add('active');
            const titleEl = document.getElementById('page-title');
            if(titleEl) titleEl.textContent = target.querySelector('span').textContent;
        }
    }

    getMenus(role) {
        const dashboard = { path: '/dashboard', icon: 'fas fa-tachometer-alt', label: '儀表板' };

        const adminMenus = [
            dashboard,
            { isHeader: true, label: '系統管理' },
            { path: '/system/units/list', icon: 'fas fa-hospital', label: '單位管理' },
            { path: '/unit/staff/list', icon: 'fas fa-users', label: '全院人員' },
            { path: '/system/settings', icon: 'fas fa-cogs', label: '系統設定' },
        ];

        const unitManagerMenus = [
            dashboard,
            { isHeader: true, label: '單位管理' },
            { path: '/unit/staff/list', icon: 'fas fa-users', label: '人員管理' },
            { isHeader: true, label: '排班作業' },
            { path: '/schedule/list', icon: 'fas fa-calendar-alt', label: '班表管理' },
            { path: '/pre-schedule/manage', icon: 'fas fa-calendar-check', label: '預班/預假' },
            { path: '/swaps/review', icon: 'fas fa-check-double', label: '換班審核' },
            { isHeader: true, label: '設定與統計' },
            { path: '/unit/settings/shifts', icon: 'fas fa-clock', label: '班別設定' },
            { path: '/unit/settings/groups', icon: 'fas fa-layer-group', label: '分組設定' },
            { path: '/unit/settings/rules', icon: 'fas fa-ruler-combined', label: '規則設定' }, // 新增
            { path: '/statistics/unit', icon: 'fas fa-chart-bar', label: '單位統計' },
        ];

        const schedulerMenus = [
            dashboard,
            { isHeader: true, label: '排班作業' },
            { path: '/schedule/list', icon: 'fas fa-calendar-alt', label: '班表管理' },
            { path: '/pre-schedule/manage', icon: 'fas fa-calendar-check', label: '預班/預假' },
            { path: '/swaps/review', icon: 'fas fa-check-double', label: '換班審核' },
            { isHeader: true, label: '統計' },
            { path: '/statistics/unit', icon: 'fas fa-chart-bar', label: '單位統計' },
        ];

        const userMenus = [
            dashboard,
            { isHeader: true, label: '個人中心' },
            { path: '/my-schedule', icon: 'fas fa-calendar-day', label: '我的班表' },
            { path: '/pre-schedule/submit', icon: 'fas fa-edit', label: '預班/意願' },
            { path: '/swaps/apply', icon: 'fas fa-exchange-alt', label: '申請換班' },
            { path: '/swaps/review', icon: 'fas fa-history', label: '換班紀錄' },
            { path: '/statistics/personal', icon: 'fas fa-chart-pie', label: '個人統計' },
        ];

        if (role === 'system_admin') return adminMenus;
        if (role === 'unit_manager') return unitManagerMenus;
        if (role === 'unit_scheduler') return schedulerMenus;
        return userMenus;
    }

    getRoleName(role) {
        const map = {
            'system_admin': '系統管理員',
            'unit_manager': '單位主管',
            'unit_scheduler': '排班人員',
            'user': '護理師'
        };
        return map[role] || '訪客';
    }

    getRoleIcon(role) {
        if(role === 'system_admin') return '👑';
        if(role === 'unit_manager') return '👨‍⚕️';
        if(role === 'unit_scheduler') return '📅';
        return '👤';
    }
}
