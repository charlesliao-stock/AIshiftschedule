/**
 * js/components/sidebar.js
 * 側邊欄元件 (權限分級版)
 */

import { Auth } from '../core/auth.js';
import { CONSTANTS } from '../config/constants.js';
import { Router } from '../core/router.js';
import { Storage } from '../core/storage.js';

export const Sidebar = {
    container: null,
    collapsed: false,
    
    init() {
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
        
        // 取得使用者角色 (若無角色則預設為 user)
        const userRole = user.role || CONSTANTS.ROLES.USER;
        
        let menuHtml = '';
        
        // 遍歷選單結構
        CONSTANTS.MENU_STRUCTURE.forEach(section => {
            // 1. 檢查區塊權限 (若區塊有定義 roles 且使用者不在此列，則整塊跳過)
            if (section.roles && !section.roles.includes(userRole)) {
                return;
            }

            // 2. 過濾區塊內的項目
            const visibleItems = section.items.filter(item => {
                return !item.roles || item.roles.includes(userRole);
            });

            if (visibleItems.length > 0) {
                // 渲染區塊標題 (如果有)
                if (section.header) {
                    menuHtml += `<li class="sidebar-header">${section.header}</li>`;
                }

                // 渲染項目
                visibleItems.forEach(item => {
                    menuHtml += `
                        <li class="sidebar-menu-item">
                            <a href="${item.path}" class="sidebar-menu-link" data-path="${item.path}">
                                <span class="sidebar-menu-icon">${item.icon}</span>
                                <span class="sidebar-menu-text">${item.label}</span>
                            </a>
                        </li>
                    `;
                });
                
                // 區塊分隔線
                menuHtml += `<li class="sidebar-divider"></li>`;
            }
        });
        
        this.container.innerHTML = `<ul class="sidebar-menu">${menuHtml}</ul>`;
        
        if (this.collapsed) {
            this.container.classList.add('collapsed');
        }
    },
    
    bindEvents() {
        const menuLinks = this.container.querySelectorAll('.sidebar-menu-link');
        menuLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const path = link.getAttribute('data-path');
                
                if (window.innerWidth <= 767) {
                    this.container.classList.remove('show');
                    document.querySelector('.sidebar-overlay')?.classList.remove('show');
                }
                
                Router.navigate(path);
            });
        });
        
        Router.afterRouteChange(() => {
            this.updateActiveMenu();
        });
    },
    
    updateActiveMenu() {
        if (!this.container) return;
        const currentPath = window.location.pathname.replace('/index.html', '/').replace(/\/$/, '') || '/';
        const menuLinks = this.container.querySelectorAll('.sidebar-menu-link');
        
        menuLinks.forEach(link => {
            const linkPath = link.getAttribute('data-path');
            // 簡單的路徑匹配：如果當前路徑以選單路徑開頭 (處理子頁面)
            if (linkPath === currentPath || (currentPath !== '/' && currentPath.startsWith(linkPath))) {
                link.classList.add('active');
            } else if (currentPath === '/' && linkPath === '/dashboard') {
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
        if (mainContent) mainContent.classList.toggle('sidebar-collapsed', this.collapsed);
        Storage.saveSidebarCollapsed(this.collapsed);
    },
    
    refresh() {
        this.render();
        this.bindEvents();
        this.updateActiveMenu();
    }
};
