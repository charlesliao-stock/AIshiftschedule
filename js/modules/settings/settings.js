/**
 * js/modules/settings/settings.js
 * 設定管理主模組
 */
import { Auth } from '../../core/auth.js';
import { Notification } from '../../components/notification.js';

// 👇 關鍵：這裡引用必須加花括號 { }，因為我們是用 export const 匯出的
import { RuleManagement } from './rule-management.js';

export const Settings = {
    container: null,

    async init() {
        console.log('[Settings] 初始化...');
        
        if (!Auth.isAdmin() && !Auth.isScheduler()) {
            Notification.error('權限不足');
            if (window.router) window.router.navigate('/dashboard');
            return;
        }

        this.container = document.getElementById('settings-container'); 
        if (!this.container) this.container = document.getElementById('main-content');

        this.container.innerHTML = `
            <div class="page-header mb-4"><h1>系統設定</h1></div>
            <div id="rule-management-container"></div>
        `;

        // 載入規則管理模組
        const subContainer = document.getElementById('rule-management-container');
        if (RuleManagement && RuleManagement.init) {
            await RuleManagement.init(subContainer);
        } else {
            console.error('RuleManagement 模組載入失敗', RuleManagement);
        }
    }
};
