/**
 * js/modules/unit-management/unit-management.js
 * 單位管理主模組 (完整修復版 - 包含人員分配功能)
 */

import { UnitService } from '../../services/unit.service.js';
import { Auth } from '../../core/auth.js';
import { Notification } from '../../components/notification.js';
import { Loading } from '../../components/loading.js';
import { Modal } from '../../components/modal.js';
import { UnitCreate } from './unit-create.js';
import { UnitEdit } from './unit-edit.js';
import { UserAssignment } from './user-assignment.js'; // ✅ 新增引用

export const UnitManagement = {
    container: null,
    units: [],

    async init() {
        console.log('[UnitManagement] 初始化...');
        
        // 使用 window.router 進行導航，避免循環依賴
        if (!Auth.isAdmin()) {
            Notification.error('您沒有權限存取此頁面');
            if (window.router) window.router.navigate('/dashboard');
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
                        <div class="text-center p-4">
                            <i class="fas fa-spinner fa-spin"></i> 載入中...
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    async loadUnits() {
        try {
            this.units = await UnitService.getAllUnits();
            this.renderList();
        } catch (error) {
            Notification.error('載入失敗: ' + error.message);
            const container = document.getElementById('unit-list-container');
            if (container) container.innerHTML = `<div class="error-state">${error.message}</div>`;
        }
    },

    renderList() {
        const container = document.getElementById('unit-list-container');
        if (!container) return;

        if (this.units.length === 0) {
            container.innerHTML = '<div class="empty-state">目前沒有單位資料，請點擊上方按鈕新增。</div>';
            return;
        }

        let html = `
            <table class="table">
                <thead>
                    <tr>
                        <th>代碼</th>
                        <th>名稱</th>
                        <th>建立時間</th>
                        <th>狀態</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
        `;

        this.units.forEach(unit => {
            const createdDate = unit.created_at ? new Date(unit.created_at.seconds * 1000).toLocaleDateString() : '-';
            const statusBadge = unit.status === 'inactive' 
                ? '<span class="badge bg-secondary">停用</span>' 
                : '<span class="badge bg-success">啟用中</span>';

            html += `
                <tr>
                    <td>${unit.code || ''}</td>
                    <td>${unit.name || ''}</td>
                    <td>${createdDate}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn btn-sm btn-secondary users-btn" data-id="${unit.id}" title="管理人員">人員</button>
                        <button class="btn btn-sm btn-info edit-btn" data-id="${unit.id}">編輯</button>
                        <button class="btn btn-sm btn-danger delete-btn" data-id="${unit.id}">刪除</button>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;
    },

    bindEvents() {
        // 新增單位按鈕
        document.getElementById('create-unit-btn')?.addEventListener('click', () => {
            UnitCreate.init(); 
        });

        // 列表按鈕 (事件委派)
        const listContainer = document.getElementById('unit-list-container');
        listContainer?.addEventListener('click', async (e) => {
            const target = e.target;
            const id = target.dataset.id;

            if (!id) return;

            if (target.classList.contains('edit-btn')) {
                UnitEdit.init(id);
            } else if (target.classList.contains('delete-btn')) {
                await this.handleDelete(id);
            } else if (target.classList.contains('users-btn')) {
                // ✅ 開啟人員分配視窗
                UserAssignment.openDialog(id);
            }
        });
    },

    async handleDelete(unitId) {
        const confirmed = await Modal.confirm('確定要刪除此單位嗎？此操作無法復原！', { danger: true });
        if (!confirmed) return;

        try {
            Loading.show('刪除中...');
            await UnitService.deleteUnit(unitId);
            await this.loadUnits(); 
            Notification.success('單位已刪除');
        } catch (error) {
            Notification.error('刪除失敗: ' + error.message);
        } finally {
            Loading.hide();
        }
    }
};
