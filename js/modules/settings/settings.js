/**
 * js/modules/settings/settings.js
 * 設定管理主模組 - 整合所有子分頁
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
    currentTab: 'shifts', // 預設分頁

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
        this.container.innerHTML = `
            <div class="page-header mb-4">
                <h1>系統設定</h1>
            </div>
            
            <div class="card">
                <div class="card-header">
                    <ul class="nav nav-tabs card-header-tabs">
                        <li class="nav-item"><a class="nav-link active" data-tab="shifts" href="#">班別定義</a></li>
                        <li class="nav-item"><a class="nav-link" data-tab="groups" href="#">組別管理</a></li>
                        <li class="nav-item"><a class="nav-link" data-tab="staff" href="#">人員管理</a></li>
                        <li class="nav-item"><a class="nav-link" data-tab="holidays" href="#">假日設定</a></li>
                        <li class="nav-item"><a class="nav-link" data-tab="rules" href="#">勞基法規則</a></li>
                    </ul>
                </div>
                <div class="card-body" id="settings-tab-content">
                    <div class="text-center py-5">
                        <div class="spinner-border text-primary" role="status"></div>
                    </div>
                </div>
            </div>
        `;
    },

    bindTabEvents() {
        const tabs = this.container.querySelectorAll('.nav-link');
        tabs.forEach(tab => {
            tab.addEventListener('click', async (e) => {
                e.preventDefault();
                tabs.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                
                this.currentTab = e.target.dataset.tab;
                await this.loadTab(this.currentTab);
            });
        });
    },

    async loadTab(tabName) {
        const contentContainer = document.getElementById('settings-tab-content');
        contentContainer.innerHTML = ''; 

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
            contentContainer.innerHTML = `<div class="alert alert-danger">載入失敗: ${error.message}</div>`;
        }
    }
};
