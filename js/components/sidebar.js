/**
 * js/components/sidebar.js
 * 側邊欄元件 (ES Module 版)
 */

import { Auth } from '../core/auth.js';
import { CONSTANTS } from '../config/constants.js';
import { Router } from '../core/router.js';
import { Storage } from '../core/storage.js';

export const Sidebar = {
    container: null,
    collapsed: false,
    
    init() {
        console.log('[Sidebar] 初始化側邊欄');
        this.container = document.getElementById('sidebar');
        if (!this.container) return;
        
        this.collapsed = Storage.getSidebarCollapsed();
        
        this.render();
        this.bindEvents();
        this.updateActiveMenu();
    },
    
    render() {
        const user = Auth.getCurrentUser();
        if (!user) return;
        
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
        
        this.container.innerHTML = `<ul class="sidebar-menu">${menuHtml}</ul>`;
        
        if (this.collapsed) {
            this.container.classList.add('collapsed');
        }
    },
    
    getMenuItems(role) {
        const baseMenu = [
            { label: '主控台', icon: '📊', path: '/dashboard' },
            { label: '預班管理', icon: '📝', path: '/pre-schedule' },
            { label: '排班管理', icon: '📅', path: '/schedule' },
            { label: '換班管理', icon: '🔄', path: '/swap' },
            { label: '統計報表', icon: '📈', path: '/statistics' }
        ];
        
        if (role === CONSTANTS.ROLES?.ADMIN) {
            return [
                ...baseMenu,
                { divider: true },
                { label: '單位管理', icon: '🏢', path: '/units' },
                { label: '使用者管理', icon: '👥', path: '/users' },
                { label: '系統設定', icon: '⚙️', path: '/system' }
            ];
        }
        
        if (role === CONSTANTS.ROLES?.SCHEDULER) {
            return [
                ...baseMenu,
                { divider: true },
                { label: '設定管理', icon: '⚙️', path: '/settings' }
            ];
        }
        
        return baseMenu;
    },
    
    bindEvents() {
        const menuLinks = this.container.querySelectorAll('.sidebar-menu-link');
        menuLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const path = link.getAttribute('data-path');
                
                if (window.innerWidth <= 767) {
                    this.container.classList.remove('show');
                    const overlay = document.querySelector('.sidebar-overlay');
                    if (overlay) overlay.classList.remove('show');
                }
                
                Router.navigate(path);
            });
        });
        
        // 這裡需要注意：Router 的回調機制在 ESM 下要確保 Router 實例是同一個
        Router.afterRouteChange(() => {
            this.updateActiveMenu();
        });
    },
    
    updateActiveMenu() {
        if (!this.container) return;
        const currentPath = window.location.pathname.replace('/index.html', '/') || '/';
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
    
    toggle() {
        this.collapsed = !this.collapsed;
        this.container.classList.toggle('collapsed', this.collapsed);
        
        const mainContent = document.getElementById('main-content');
        if (mainContent) {
            mainContent.classList.toggle('sidebar-collapsed', this.collapsed);
        }
        
        Storage.saveSidebarCollapsed(this.collapsed);
    },
    
    refresh() {
        this.render();
        this.bindEvents();
        this.updateActiveMenu();
    }
};