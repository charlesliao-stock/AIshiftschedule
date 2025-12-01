/**
 * js/modules/unit-management/unit-management.js
 * 單位管理主模組 (ES Module 版)
 */

import { UnitService } from '../../services/unit.service.js';
import { Auth } from '../../core/auth.js';
import { Router } from '../../core/router.js';
import { Notification } from '../../components/notification.js';
import { Loading } from '../../components/loading.js';
import { Modal } from '../../components/modal.js';

// 引入子模組 (如果是用 Router 載入，這裡可能不需要 import，視您的架構而定)
// 這裡假設 Create 和 Edit 是由 Router 處理路由切換，或是由本模組動態渲染
import { UnitCreate } from './unit-create.js';
import { UnitEdit } from './unit-edit.js';

export const UnitManagement = {
    container: null,
    units: [],

    async init() {
        console.log('[UnitManagement] 初始化...');
        
        // 權限檢查
        if (!Auth.isAdmin()) {
            Notification.error('您沒有權限存取此頁面');
            Router.navigate('/dashboard');
            return;
        }

        this.container = document.getElementById('main-content');
        this.renderLayout();
        await this.loadUnits();
        this.bindEvents();
    },

    renderLayout() {
        this.container.innerHTML = `
            <div class="page-header">
                <h1>單位管理</h1>
                <button class="btn btn-primary" id="create-unit-btn">
                    <span class="icon">＋</span> 新增單位
                </button>
            </div>
            <div class="card">
                <div class="card-body">
                    <div id="unit-list-container">
                        <div class="loader-spinner"></div>
                    </div>
                </div>
            </div>
        `;
    },

    async loadUnits() {
        try {
            Loading.show('載入單位列表...');
            this.units = await UnitService.getAllUnits();
            this.renderList();
            Loading.hide();
        } catch (error) {
            Loading.hide();
            Notification.error('載入失敗: ' + error.message);
            document.getElementById('unit-list-container').innerHTML = 
                `<div class="error-state">${error.message}</div>`;
        }
    },

    renderList() {
        const container = document.getElementById('unit-list-container');
        if (!container) return;

        if (this.units.length === 0) {
            container.innerHTML = '<div class="empty-state">目前沒有單位資料</div>';
            return;
        }

        let html = `
            <table class="table">
                <thead>
                    <tr>
                        <th>代碼</th>
                        <th>名稱</th>
                        <th>人員數</th>
                        <th>狀態</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
        `;

        this.units.forEach(unit => {
            html += `
                <tr>
                    <td>${unit.unit_code}</td>
                    <td>${unit.unit_name}</td>
                    <td>${unit.total_staff || 0}</td>
                    <td>
                        <span class="status-badge ${unit.status === 'active' ? 'status-open' : 'status-closed'}">
                            ${unit.status === 'active' ? '啟用中' : '停用'}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-info edit-btn" data-id="${unit.unit_id}">編輯</button>
                        <button class="btn btn-sm btn-danger delete-btn" data-id="${unit.unit_id}">刪除</button>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;
    },

    bindEvents() {
        // 新增按鈕
        document.getElementById('create-unit-btn')?.addEventListener('click', () => {
            // 切換到新增視圖
            UnitCreate.init(); 
        });

        // 列表操作按鈕 (事件委派)
        const listContainer = document.getElementById('unit-list-container');
        listContainer?.addEventListener('click', async (e) => {
            const target = e.target;
            const id = target.dataset.id;

            if (target.classList.contains('edit-btn')) {
                UnitEdit.init(id);
            } else if (target.classList.contains('delete-btn')) {
                await this.handleDelete(id);
            }
        });
    },

    async handleDelete(unitId) {
        const confirmed = await Modal.confirm('確定要刪除此單位嗎？此操作無法復原！', { danger: true });
        if (!confirmed) return;

        try {
            Loading.show('刪除中...');
            await UnitService.deleteUnit(unitId);
            await this.loadUnits(); // 重新載入列表
            Notification.success('單位已刪除');
        } catch (error) {
            Loading.hide();
            Notification.error('刪除失敗: ' + error.message);
        }
    }
};