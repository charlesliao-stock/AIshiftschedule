/**
 * js/modules/settings/staff-management.js
 * 人員管理模組 (ES Module + Firebase 版)
 */

import { SettingsService } from '../../services/settings.service.js';
import { Notification } from '../../components/notification.js';
import { Loading } from '../../components/loading.js';
import { Modal } from '../../components/modal.js';

export const StaffManagement = {
    container: null,
    staffList: [],
    
    async init(container) {
        this.container = container;
        this.render();
        await this.loadStaff();
    },
    
    render() {
        this.container.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="mb-0">人員名單</h5>
                <button class="btn btn-primary btn-sm" id="add-staff-btn">➕ 新增人員</button>
            </div>
            <div id="staff-table-container">
                <div class="text-center py-4 text-muted">載入中...</div>
            </div>
        `;
        this.bindEvents();
    },

    async loadStaff() {
        try {
            Loading.show('載入人員...');
            this.staffList = await SettingsService.getStaff();
            this.renderTable();
        } catch (error) {
            Notification.error('載入失敗');
        } finally {
            Loading.hide();
        }
    },

    renderTable() {
        const container = document.getElementById('staff-table-container');
        if (this.staffList.length === 0) {
            container.innerHTML = '<div class="alert alert-info">尚無人員資料</div>';
            return;
        }

        let html = `
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th>員工編號</th>
                        <th>姓名</th>
                        <th>層級</th>
                        <th>組別</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
        `;

        this.staffList.forEach(staff => {
            html += `
                <tr>
                    <td>${staff.employeeId || '-'}</td>
                    <td>${staff.name}</td>
                    <td>${staff.level || '-'}</td>
                    <td>${staff.group || '-'}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-danger delete-staff-btn" data-id="${staff.id}">刪除</button>
                    </td>
                </tr>
            `;
        });
        html += '</tbody></table>';
        container.innerHTML = html;

        container.querySelectorAll('.delete-staff-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.deleteStaff(e.target.dataset.id));
        });
    },

    bindEvents() {
        document.getElementById('add-staff-btn')?.addEventListener('click', () => this.addStaff());
    },

    async addStaff() {
        // 先取得組別選項
        const groups = await SettingsService.getGroups();
        const groupOptions = groups.map(g => ({ value: g.name, label: g.name }));

        const result = await Modal.form('新增人員', [
            { name: 'employeeId', label: '員工編號', required: true },
            { name: 'name', label: '姓名', required: true },
            { name: 'level', label: '層級 (如 N1, N2)', required: false },
            { name: 'group', label: '組別', type: 'select', options: groupOptions, required: true }
        ]);

        if (result) {
            try {
                Loading.show('儲存中...');
                await SettingsService.saveStaff(result);
                await this.loadStaff();
                Notification.success('新增成功');
            } catch (error) {
                Notification.error('新增失敗: ' + error.message);
            } finally {
                Loading.hide();
            }
        }
    },

    async deleteStaff(id) {
        if (await Modal.confirm('確定刪除此人員？')) {
            try {
                Loading.show('刪除中...');
                await SettingsService.deleteStaff(id);
                await this.loadStaff();
                Notification.success('刪除成功');
            } catch (error) {
                Notification.error('刪除失敗');
            } finally {
                Loading.hide();
            }
        }
    }
};
