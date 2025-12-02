/**
 * js/modules/settings/group-management.js
 * 組別管理模組 (ES Module + Firebase 版)
 */

import { SettingsService } from '../../services/settings.service.js';
import { Notification } from '../../components/notification.js';
import { Loading } from '../../components/loading.js';
import { Modal } from '../../components/modal.js';

export const GroupManagement = {
    container: null,
    groups: [],
    
    async init(container) {
        this.container = container;
        this.render();
        await this.loadGroups();
    },
    
    render() {
        this.container.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="mb-0">組別列表</h5>
                <button class="btn btn-primary btn-sm" id="add-group-btn">➕ 新增組別</button>
            </div>
            <div id="groups-table-container">
                <div class="text-center py-4 text-muted">載入中...</div>
            </div>
        `;
        this.bindEvents();
    },

    async loadGroups() {
        try {
            Loading.show('載入組別...');
            this.groups = await SettingsService.getGroups();
            this.renderTable();
        } catch (error) {
            Notification.error('載入失敗');
        } finally {
            Loading.hide();
        }
    },

    renderTable() {
        const container = document.getElementById('groups-table-container');
        if (this.groups.length === 0) {
            container.innerHTML = '<div class="alert alert-info">尚無組別資料</div>';
            return;
        }

        let html = `
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th>名稱</th>
                        <th>總員額</th>
                        <th>每班最少</th>
                        <th>每班最多</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
        `;

        this.groups.forEach((group, index) => {
            html += `
                <tr>
                    <td>${group.name}</td>
                    <td>${group.totalStaff || 0}</td>
                    <td>${group.minPerShift || 0}</td>
                    <td>${group.maxPerShift || 0}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-danger delete-group-btn" data-index="${index}">刪除</button>
                    </td>
                </tr>
            `;
        });
        html += '</tbody></table>';
        container.innerHTML = html;

        // 綁定刪除事件
        container.querySelectorAll('.delete-group-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.deleteGroup(e.target.dataset.index));
        });
    },
    
    bindEvents() {
        document.getElementById('add-group-btn')?.addEventListener('click', () => this.addGroup());
    },

    async addGroup() {
        const result = await Modal.form('新增組別', [
            { name: 'name', label: '組別名稱', required: true },
            { name: 'totalStaff', label: '總員額', type: 'number', required: true },
            { name: 'minPerShift', label: '每班最少人數', type: 'number', value: 1, required: true },
            { name: 'maxPerShift', label: '每班最多人數', type: 'number', value: 5, required: true }
        ]);

        if (result) {
            this.groups.push(result);
            await this.save();
        }
    },

    async deleteGroup(index) {
        if (await Modal.confirm('確定刪除此組別？')) {
            this.groups.splice(index, 1);
            await this.save();
        }
    },

    async save() {
        try {
            Loading.show('儲存中...');
            await SettingsService.saveGroups(this.groups);
            this.renderTable();
            Notification.success('更新成功');
        } catch (error) {
            Notification.error('儲存失敗: ' + error.message);
        } finally {
            Loading.hide();
        }
    }
};
