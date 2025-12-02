/**
 * js/modules/unit-management/unit-management.js
 * 修正版: 配合 UnitService 的欄位名稱
 */

import { UnitService } from '../../services/unit.service.js';
import { Auth } from '../../core/auth.js';
import { Router } from '../../core/router.js';
import { Notification } from '../../components/notification.js';
import { Loading } from '../../components/loading.js';
import { Modal } from '../../components/modal.js';
import { UnitCreate } from './unit-create.js';
import { UnitEdit } from './unit-edit.js';

export const UnitManagement = {
    container: null,
    units: [],

    async init() {
        console.log('[UnitManagement] 初始化...');
        
        if (!Auth.isAdmin()) {
            Notification.error('您沒有權限存取此頁面');
            window.router.navigate('/dashboard'); // 改用 window.router 避免 import 循環
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
            const container = document.getElementById('unit-list-container');
            if(container) container.innerHTML = `<div class="error-state">${error.message}</div>`;
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
                        <th>建立時間</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
        `;

        this.units.forEach(unit => {
            // ✅ 修正: 欄位名稱對應 (unit_code -> code, unit_name -> name)
            // ✅ 修正: unit_id -> id (Firestore 預設 ID 欄位)
            const createdDate = unit.created_at ? new Date(unit.created_at.seconds * 1000).toLocaleDateString() : '-';
            
            html += `
                <tr>
                    <td>${unit.code || unit.unit_code || ''}</td>
                    <td>${unit.name || unit.unit_name || ''}</td>
                    <td>${createdDate}</td>
                    <td>
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
        document.getElementById('create-unit-btn')?.addEventListener('click', () => {
            UnitCreate.init(); 
        });

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
            await this.loadUnits(); 
            Notification.success('單位已刪除');
        } catch (error) {
            Loading.hide();
            Notification.error('刪除失敗: ' + error.message);
        }
    }
};
