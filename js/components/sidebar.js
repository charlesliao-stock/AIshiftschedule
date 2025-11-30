/**
 * 側邊欄元件
 * 根據使用者角色顯示選單
 */

const Sidebar = {
    container: null,
    collapsed: false,
    
    // ==================== 初始化 ====================
    
    /**
     * 初始化側邊欄
     */
    init() {
        console.log('[Sidebar] 初始化側邊欄');
        
        this.container = document.getElementById('sidebar');
        if (!this.container) {
            console.error('[Sidebar] 找不到側邊欄容器');
            return;
        }
        
        // 讀取收合狀態
        this.collapsed = Storage.getSidebarCollapsed();
        
        this.render();
        this.bindEvents();
        this.updateActiveMenu();
    },
    
    // ==================== 渲染 ====================
    
    /**
     * 渲染側邊欄
     */
    render() {
        const user = Auth.getCurrentUser();
        
        if (!user) {
            console.warn('[Sidebar] 使用者未登入');
            return;
        }
        
        const menuItems = this.getMenuItems(user.role);
        
        let menuHtml = '';
        menuItems.forEach(item => {
            if (item.divider) {
                menuHtml += `<div style="height: 1px; background: var(--border-color); margin: 12px 0;"></div>`;
            } else {
                menuHtml += `
                    <li class="sidebar-menu-item">
                        <a href="${item.path}" class="sidebar-menu-link" data-path="${item.path}">
                            <span class="sidebar-menu-icon">${item.icon}</span>
                            <span class="sidebar-menu-text">${item.label}</span>
                        </a>
                    </li>
                `;
            }
        });
        
        this.container.innerHTML = `
            <ul class="sidebar-menu">
                ${menuHtml}
            </ul>
        `;
        
        // 套用收合狀態
        if (this.collapsed) {
            this.container.classList.add('collapsed');
        }
    },
    
    /**
     * 取得選單項目
     * @param {string} role - 使用者角色
     * @returns {Array} 選單項目
     */
    getMenuItems(role) {
        const baseMenu = [
            {
                label: '主控台',
                icon: '📊',
                path: '/dashboard'
            },
            {
                label: '預班管理',
                icon: '📝',
                path: '/pre-schedule'
            },
            {
                label: '排班管理',
                icon: '📅',
                path: '/schedule'
            },
            {
                label: '換班管理',
                icon: '🔄',
                path: '/swap'
            },
            {
                label: '統計報表',
                icon: '📈',
                path: '/statistics'
            }
        ];
        
        // 管理者選單
        if (role === CONSTANTS.ROLES.ADMIN) {
            return [
                ...baseMenu,
                { divider: true },
                {
                    label: '單位管理',
                    icon: '🏢',
                    path: '/units'
                },
                {
                    label: '使用者管理',
                    icon: '👥',
                    path: '/users'
                },
                {
                    label: '系統設定',
                    icon: '⚙️',
                    path: '/system'
                }
            ];
        }
        
        // 排班者選單
        if (role === CONSTANTS.ROLES.SCHEDULER) {
            return [
                ...baseMenu,
                { divider: true },
                {
                    label: '設定管理',
                    icon: '⚙️',
                    path: '/settings'
                }
            ];
        }
        
        // 一般使用者選單
        return baseMenu;
    },
    
    // ==================== 事件綁定 ====================
    
    /**
     * 綁定事件
     */
    bindEvents() {
        // 選單項目點擊
        const menuLinks = this.container.querySelectorAll('.sidebar-menu-link');
        menuLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const path = link.getAttribute('data-path');
                
                // 手機版: 點擊後關閉側邊欄
                if (window.innerWidth <= 767) {
                    this.container.classList.remove('show');
                    const overlay = document.querySelector('.sidebar-overlay');
                    if (overlay) {
                        overlay.classList.remove('show');
                    }
                }
                
                // 導航
                Router.navigate(path);
            });
        });
        
        // 監聽路由變化，更新 active 狀態
        Router.afterRouteChange(() => {
            this.updateActiveMenu();
        });
    },
    
    // ==================== 操作方法 ====================
    
    /**
     * 更新選中的選單項目
     */
    updateActiveMenu() {
        const currentPath = window.location.pathname;
        const menuLinks = this.container.querySelectorAll('.sidebar-menu-link');
        
        menuLinks.forEach(link => {
            const linkPath = link.getAttribute('data-path');
            
            if (linkPath === currentPath || (currentPath === '/' && linkPath === '/dashboard')) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    },
    
    /**
     * 切換收合狀態
     */
    toggle() {
        this.collapsed = !this.collapsed;
        
        if (this.collapsed) {
            this.container.classList.add('collapsed');
        } else {
            this.container.classList.remove('collapsed');
        }
        
        // 更新主內容區的 margin
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            if (this.collapsed) {
                mainContent.classList.add('sidebar-collapsed');
            } else {
                mainContent.classList.remove('sidebar-collapsed');
            }
        }
        
        // 儲存狀態
        Storage.saveSidebarCollapsed(this.collapsed);
    },
    
    /**
     * 收合側邊欄
     */
    collapse() {
        if (!this.collapsed) {
            this.toggle();
        }
    },
    
    /**
     * 展開側邊欄
     */
    expand() {
        if (this.collapsed) {
            this.toggle();
        }
    },
    
    /**
     * 重新渲染 (當使用者角色改變時)
     */
    refresh() {
        this.render();
        this.bindEvents();
        this.updateActiveMenu();
    }
};

// 讓側邊欄元件可在全域使用
if (typeof window !== 'undefined') {
    window.Sidebar = Sidebar;
}