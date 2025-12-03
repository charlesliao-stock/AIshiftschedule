/**
 * js/modules/settings/settings.js
 * 設定管理主模組 (美化版)
 */

import { Auth } from '../../core/auth.js';
import { Notification } from '../../components/notification.js';

// 引入所有子模組
import { ShiftManagement } from './shift-management.js';
import { GroupManagement } from './group-management.js';
import { StaffManagement } from './staff-management.js';
import { HolidayManagement } from './holiday-management.js';
import { LaborLawSettings } from './labor-law-settings.js';

export const Settings = {
    container: null,
    currentTab: 'shifts',

    async init() {
        console.log('[Settings] 初始化...');
        
        if (!Auth.isAdmin() && !Auth.isScheduler()) {
            Notification.error('權限不足');
            if (window.router) window.router.navigate('/dashboard');
            return;
        }

        this.container = document.getElementById('settings-container') || document.getElementById('main-content');
        this.renderLayout();
        this.bindTabEvents();
        await this.loadTab(this.currentTab);
    },

    renderLayout() {
        // 使用 CSS Grid 或 Flexbox 進行佈局
        this.container.innerHTML = `
            <div class="settings-page">
                <div class="page-header d-flex align-items-center gap-3 mb-4">
                    <div class="header-icon bg-primary text-white d-flex align-items-center justify-content-center rounded-circle" style="width: 48px; height: 48px; font-size: 24px;">⚙️</div>
                    <div>
                        <h1 class="mb-0" style="font-size: 24px; font-weight: 700;">系統設定</h1>
                        <p class="text-muted mb-0">管理班別、人員與排班規則</p>
                    </div>
                </div>
                
                <div class="card shadow-sm border-0">
                    <div class="card-header bg-white border-bottom pt-3 pb-0 px-4">
                        <nav class="nav nav-tabs border-0" style="gap: 8px;">
                            <a class="nav-link active py-3 px-3 border-0 border-bottom border-3 border-primary fw-bold" data-tab="shifts" href="#">
                                <span class="me-2">🕒</span> 班別定義
                            </a>
                            <a class="nav-link py-3 px-3 border-0 text-muted" data-tab="groups" href="#">
                                <span class="me-2">👥</span> 組別管理
                            </a>
                            <a class="nav-link py-3 px-3 border-0 text-muted" data-tab="staff" href="#">
                                <span class="me-2">📇</span> 人員管理
                            </a>
                            <a class="nav-link py-3 px-3 border-0 text-muted" data-tab="holidays" href="#">
                                <span class="me-2">📅</span> 假日設定
                            </a>
                            <a class="nav-link py-3 px-3 border-0 text-muted" data-tab="rules" href="#">
                                <span class="me-2">⚖️</span> 勞基法規則
                            </a>
                        </nav>
                    </div>
                    <div class="card-body p-4" id="settings-tab-content" style="min-height: 400px; background: #fff;">
                        <div class="text-center py-5">
                            <div class="loader-spinner mb-3 mx-auto"></div>
                            <p class="text-muted">載入設定中...</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <style>
                /* 頁籤互動樣式 */
                .nav-link {
                    color: var(--text-secondary);
                    transition: all 0.2s;
                    border-bottom: 3px solid transparent !important;
                }
                .nav-link:hover {
                    color: var(--primary);
                    background: var(--bg-hover);
                    border-radius: 8px 8px 0 0;
                }
                .nav-link.active {
                    color: var(--primary) !important;
                    border-bottom-color: var(--primary) !important;
                    background: transparent;
                }
            </style>
        `;
    },

    bindTabEvents() {
        const tabs = this.container.querySelectorAll('.nav-link');
        tabs.forEach(tab => {
            tab.addEventListener('click', async (e) => {
                e.preventDefault();
                // 移除所有 active 樣式
                tabs.forEach(t => {
                    t.classList.remove('active', 'fw-bold', 'border-primary');
                    t.classList.add('text-muted');
                });
                
                // 加入 active 樣式
                const target = e.currentTarget; // 使用 currentTarget 確保點擊 icon 也能抓到 a 標籤
                target.classList.add('active', 'fw-bold', 'border-primary');
                target.classList.remove('text-muted');
                
                this.currentTab = target.dataset.tab;
                await this.loadTab(this.currentTab);
            });
        });
    },

    async loadTab(tabName) {
        const contentContainer = document.getElementById('settings-tab-content');
        
        // 加入淡入動畫效果
        contentContainer.style.opacity = '0';
        contentContainer.innerHTML = '<div class="text-center py-5"><div class="loader-spinner mx-auto"></div></div>';
        
        // 簡單的過場
        setTimeout(() => {
            contentContainer.style.transition = 'opacity 0.2s';
            contentContainer.style.opacity = '1';
        }, 50);

        try {
            switch (tabName) {
                case 'shifts':
                    await ShiftManagement.init(contentContainer);
                    break;
                case 'groups':
                    await GroupManagement.init(contentContainer);
                    break;
                case 'staff':
                    await StaffManagement.init(contentContainer);
                    break;
                case 'holidays':
                    await HolidayManagement.init(contentContainer);
                    break;
                case 'rules':
                    await LaborLawSettings.init(contentContainer);
                    break;
                default:
                    contentContainer.innerHTML = '未知的分頁';
            }
        } catch (error) {
            console.error('載入模組失敗:', error);
            contentContainer.innerHTML = `<div class="alert alert-danger d-flex align-items-center gap-2"><i class="fas fa-exclamation-triangle"></i> 載入失敗: ${error.message}</div>`;
        }
    }
};
