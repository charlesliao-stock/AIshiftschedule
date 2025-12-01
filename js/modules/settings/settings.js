/**
 * js/modules/settings/settings.js
 * 設定管理主模組 (ES Module 版)
 * 負責分頁切換與子模組載入
 */

import { Auth } from '../../core/auth.js';
import { Router } from '../../core/router.js';
import { Notification } from '../../components/notification.js';

// 引入子模組 (假設您會建立這些檔案，若暫時沒有，可先註解)
import { ShiftManagement } from './shift-management.js';
import { StaffManagement } from './staff-management.js';
import { RuleManagement } from './rule-management.js';
// import { GroupManagement } from './group-management.js';
// import { HolidayManagement } from './holiday-management.js';

export const Settings = {
    activeTab: 'shifts',

    async init() {
        console.log('[Settings] 初始化...');
        
        // 檢查權限 (排班者或管理員)
        if (!Auth.isScheduler() && !Auth.isAdmin()) {
            Notification.error('您沒有權限存取設定');
            Router.navigate('/dashboard');
            return;
        }

        this.renderLayout();
        this.bindEvents();
        
        // 預設載入第一個分頁
        this.switchTab('shifts');
    },

    renderLayout() {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="page-header">
                <h1>設定管理</h1>
            </div>
            
            <div class="settings-container">
                <div class="tabs-nav">
                    <button class="tab-btn active" data-tab="shifts">班別設定</button>
                    <button class="tab-btn" data-tab="groups">組別設定</button>
                    <button class="tab-btn" data-tab="staff">人員管理</button>
                    <button class="tab-btn" data-tab="rules">排班規則</button>
                    <button class="tab-btn" data-tab="holidays">假日設定</button>
                </div>

                <div id="settings-content" class="tab-content">
                    <div class="loader-spinner"></div>
                </div>
            </div>
        `;
    },

    bindEvents() {
        const nav = document.querySelector('.tabs-nav');
        nav?.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab-btn')) {
                const tab = e.target.dataset.tab;
                this.switchTab(tab);
            }
        });
    },

    async switchTab(tabId) {
        // 更新按鈕狀態
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });

        const content = document.getElementById('settings-content');
        content.innerHTML = '<div class="loader-spinner"></div>';

        this.activeTab = tabId;

        // 根據 tabId 載入對應模組
        try {
            switch (tabId) {
                case 'shifts':
                    // 如果有實作 ShiftManagement，呼叫其 init
                    if (typeof ShiftManagement !== 'undefined') {
                        await ShiftManagement.init(content); 
                    } else {
                        content.innerHTML = '<p class="text-muted">班別管理功能載入中...</p>';
                    }
                    break;
                case 'staff':
                    if (typeof StaffManagement !== 'undefined') {
                        await StaffManagement.init(content);
                    } else {
                        content.innerHTML = '<p class="text-muted">人員管理功能載入中...</p>';
                    }
                    break;
                case 'rules':
                    if (typeof RuleManagement !== 'undefined') {
                        await RuleManagement.init(content);
                    } else {
                        content.innerHTML = '<p class="text-muted">規則管理功能載入中...</p>';
                    }
                    break;
                default:
                    content.innerHTML = `<p class="text-muted">模組 ${tabId} 開發中...</p>`;
            }
        } catch (error) {
            console.error(`載入分頁 ${tabId} 失敗:`, error);
            content.innerHTML = `<div class="error-state">載入失敗: ${error.message}</div>`;
        }
    }
};