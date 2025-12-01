/**
 * js/components/navbar.js
 * 導航列元件 (ES Module 版)
 */

import { Auth } from '../core/auth.js';
import { CONSTANTS } from '../config/constants.js';
import { Utils } from '../core/utils.js';
import { Router } from '../core/router.js';
import { Notification } from './notification.js';

export const Navbar = {
    container: null,
    
    init() {
        console.log('[Navbar] 初始化導航列');
        this.container = document.getElementById('navbar');
        if (!this.container) return;
        
        this.render();
        this.bindEvents();
    },
    
    render() {
        const user = Auth.getCurrentUser();
        if (!user) return;
        
        const roleName = CONSTANTS.ROLE_NAMES[user.role] || user.role;
        const userInitial = user.displayName ? user.displayName.charAt(0) : user.email.charAt(0);
        
        this.container.innerHTML = `
            <div style="display: flex; align-items: center; gap: 16px;">
                <button class="hamburger-btn" id="hamburger-btn" style="display: none;">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="3" y1="12" x2="21" y2="12"></line>
                        <line x1="3" y1="6" x2="21" y2="6"></line>
                        <line x1="3" y1="18" x2="21" y2="18"></line>
                    </svg>
                </button>
                
                <a href="/" class="navbar-brand" id="navbar-brand-link">
                    <span class="navbar-brand-icon">🏥</span>
                    <span class="navbar-brand-text">${CONSTANTS.SYSTEM?.NAME || '護理排班'}</span>
                </a>
            </div>
            
            <div class="navbar-menu">
                <button class="btn btn-secondary" id="notif-btn" style="padding: 8px 12px;" title="通知">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                    </svg>
                </button>
                
                <div class="navbar-user">
                    <div class="navbar-user-avatar">${userInitial}</div>
                    <div class="navbar-user-info">
                        <div class="navbar-user-name">${user.displayName || user.email}</div>
                        <div class="navbar-user-role">${roleName} ${user.unit_name ? '· ' + user.unit_name : ''}</div>
                    </div>
                </div>
                
                <button class="btn btn-secondary" id="logout-btn" title="登出">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                </button>
            </div>
        `;
        
        if (window.innerWidth <= 767) {
            const hamburgerBtn = this.container.querySelector('#hamburger-btn');
            if (hamburgerBtn) hamburgerBtn.style.display = 'flex';
        }
    },
    
    bindEvents() {
        const brandLink = this.container.querySelector('#navbar-brand-link');
        if (brandLink) {
            brandLink.addEventListener('click', (e) => {
                e.preventDefault();
                Router.navigate('/');
            });
        }

        const notifBtn = this.container.querySelector('#notif-btn');
        if (notifBtn) {
            notifBtn.addEventListener('click', () => Notification.info('通知功能開發中'));
        }

        const logoutBtn = this.container.querySelector('#logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }
        
        const hamburgerBtn = this.container.querySelector('#hamburger-btn');
        if (hamburgerBtn) {
            hamburgerBtn.addEventListener('click', () => this.toggleSidebar());
        }
        
        window.addEventListener('resize', Utils.debounce(() => {
            const btn = this.container.querySelector('#hamburger-btn');
            if (btn) {
                btn.style.display = window.innerWidth <= 767 ? 'flex' : 'none';
            }
        }, 250));
    },
    
    async handleLogout() {
        if (!confirm('確定要登出嗎？')) return;
        try {
            await Auth.logout();
        } catch (error) {
            console.error('[Navbar] 登出失敗:', error);
            Notification.error('登出失敗');
        }
    },
    
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (!sidebar) return;
        
        sidebar.classList.toggle('show');
        
        let overlay = document.querySelector('.sidebar-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            overlay.addEventListener('click', () => this.toggleSidebar());
            document.body.appendChild(overlay);
        }
        overlay.classList.toggle('show');
    },
    
    updateUser() {
        this.render();
        this.bindEvents(); // 重新綁定事件因為 DOM 重繪了
    }
};