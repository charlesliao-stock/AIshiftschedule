/**
 * 導航列元件
 * 顯示在頁面頂部，包含品牌、使用者資訊、登出等
 */

const Navbar = {
    container: null,
    
    // ==================== 初始化 ====================
    
    /**
     * 初始化導航列
     */
    init() {
        console.log('[Navbar] 初始化導航列');
        
        this.container = document.getElementById('navbar');
        if (!this.container) {
            console.error('[Navbar] 找不到導航列容器');
            return;
        }
        
        this.render();
        this.bindEvents();
    },
    
    // ==================== 渲染 ====================
    
    /**
     * 渲染導航列
     */
    render() {
        const user = Auth.getCurrentUser();
        
        if (!user) {
            console.warn('[Navbar] 使用者未登入');
            return;
        }
        
        const roleName = CONSTANTS.ROLE_NAMES[user.role] || user.role;
        const userInitial = user.displayName ? user.displayName.charAt(0) : user.email.charAt(0);
        
        this.container.innerHTML = `
            <!-- 左側 -->
            <div style="display: flex; align-items: center; gap: 16px;">
                <!-- 漢堡選單 (手機版) -->
                <button class="hamburger-btn" id="hamburger-btn" style="display: none;">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                </button>
                
                <!-- 品牌 -->
                <a href="/" class="navbar-brand" onclick="event.preventDefault(); Router.navigate('/');">
                    <span class="navbar-brand-icon">🏥</span>
                    <span class="navbar-brand-text">${CONSTANTS.SYSTEM.NAME}</span>
                </a>
            </div>
            
            <!-- 右側 -->
            <div class="navbar-menu">
                <!-- 通知鈴鐺 (預留) -->
                <button class="btn btn-secondary" style="padding: 8px 12px;" title="通知" onclick="Notification.info('通知功能開發中')">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                    </svg>
                </button>
                
                <!-- 使用者資訊 -->
                <div class="navbar-user">
                    <div class="navbar-user-avatar">${userInitial}</div>
                    <div class="navbar-user-info">
                        <div class="navbar-user-name">${user.displayName}</div>
                        <div class="navbar-user-role">${roleName} ${user.unit_name ? '· ' + user.unit_name : ''}</div>
                    </div>
                </div>
                
                <!-- 登出按鈕 -->
                <button class="btn btn-secondary" id="logout-btn" title="登出">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                </button>
            </div>
        `;
        
        // 手機版顯示漢堡選單
        if (window.innerWidth <= 767) {
            const hamburgerBtn = this.container.querySelector('#hamburger-btn');
            if (hamburgerBtn) {
                hamburgerBtn.style.display = 'flex';
            }
        }
    },
    
    // ==================== 事件綁定 ====================
    
    /**
     * 綁定事件
     */
    bindEvents() {
        // 登出按鈕
        const logoutBtn = this.container.querySelector('#logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                this.handleLogout();
            });
        }
        
        // 漢堡選單按鈕 (手機版)
        const hamburgerBtn = this.container.querySelector('#hamburger-btn');
        if (hamburgerBtn) {
            hamburgerBtn.addEventListener('click', () => {
                this.toggleSidebar();
            });
        }
        
        // 監聽視窗大小變化
        window.addEventListener('resize', Utils.debounce(() => {
            const hamburgerBtn = this.container.querySelector('#hamburger-btn');
            if (hamburgerBtn) {
                hamburgerBtn.style.display = window.innerWidth <= 767 ? 'flex' : 'none';
            }
        }, 250));
    },
    
    // ==================== 操作方法 ====================
    
    /**
     * 處理登出
     */
    async handleLogout() {
        const confirmed = confirm('確定要登出嗎？');
        if (!confirmed) return;
        
        try {
            await Auth.logout();
        } catch (error) {
            console.error('[Navbar] 登出失敗:', error);
            Notification.error('登出失敗');
        }
    },
    
    /**
     * 切換側邊欄 (手機版)
     */
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;
        
        // 切換 show 類別
        sidebar.classList.toggle('show');
        
        // 顯示/隱藏遮罩
        let overlay = document.querySelector('.sidebar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            overlay.addEventListener('click', () => {
                this.toggleSidebar();
            });
            document.body.appendChild(overlay);
        }
        
        overlay.classList.toggle('show');
    },
    
    /**
     * 更新使用者資訊
     */
    updateUser() {
        this.render();
    }
};

// 讓導航列元件可在全域使用
if (typeof window !== 'undefined') {
    window.Navbar = Navbar;
}