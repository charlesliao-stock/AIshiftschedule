/**
 * js/modules/settings/settings.js
 * 設定管理主模組
 */

import { Auth } from '../../core/auth.js';
import { Router } from '../../core/router.js';
import { Notification } from '../../components/notification.js';

// ✅ 修正引用：確保路徑正確，且 RuleManagement 有被 export
import { RuleManagement } from './rule-management.js';

// 假設之後會有 SystemSettings，目前先略過或註解
// import { SystemSettings } from './system-settings.js';

export const Settings = {
    container: null,
    currentTab: 'rules', // 預設分頁

    async init() {
        console.log('[Settings] 初始化...');
        
        // 權限檢查
        if (!Auth.isAdmin() && !Auth.isScheduler()) {
            Notification.error('權限不足');
            if (window.router) window.router.navigate('/dashboard');
            return;
        }

        this.container = document.getElementById('settings-container'); // 注意這裡要對應 router.js 裡的 id
        if (!this.container) {
            // 如果是直接 loadSettings，可能要找 main-content
            this.container = document.getElementById('main-content');
        }

        this.renderLayout();
        this.bindTabEvents();
        
        // 載入預設分頁
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
                        <li class="nav-item">
                            <a class="nav-link active" data-tab="rules" href="#">排班規則</a>
                        </li>
                        <li class="nav-item">
                            <a class="nav-link" data-tab="system" href="#">系統參數</a>
                        </li>
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
                
                // UI 切換
                tabs.forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                
                // 載入對應模組
                const tabName = e.target.dataset.tab;
                this.currentTab = tabName;
                await this.loadTab(tabName);
            });
        });
    },

    async loadTab(tabName) {
        const contentContainer = document.getElementById('settings-tab-content');
        contentContainer.innerHTML = ''; // 清空內容

        switch (tabName) {
            case 'rules':
                if (RuleManagement && RuleManagement.init) {
                    await RuleManagement.init(contentContainer);
                } else {
                    contentContainer.innerHTML = '<div class="alert alert-danger">載入規則模組失敗</div>';
                }
                break;
                
            case 'system':
                contentContainer.innerHTML = `
                    <div class="text-center py-5 text-muted">
                        <i class="fas fa-tools fa-2x mb-3"></i>
                        <p>系統參數設定開發中...</p>
                    </div>
                `;
                break;
                
            default:
                contentContainer.innerHTML = '未知的分頁';
        }
    }
};
