/**
 * js/modules/settings/shift-management.js
 * 班別管理模組 (ES Module + Firebase 版)
 */

import { SettingsService } from '../../services/settings.service.js';
import { Notification } from '../../components/notification.js';
import { Loading } from '../../components/loading.js';
import { Modal } from '../../components/modal.js';

export const ShiftManagement = {
    container: null,
    shifts: [],

    async init(container) {
        this.container = container;
        this.render();
        await this.loadShifts();
    },

    render() {
        this.container.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="mb-0">班別定義</h5>
                <button class="btn btn-primary btn-sm" id="add-shift-btn">➕ 新增班別</button>
            </div>
            <div id="shifts-table-container">
                <div class="text-center py-4 text-muted">載入中...</div>
            </div>
        `;
        this.bindEvents();
    },

    async loadShifts() {
        try {
            Loading.show('載入班別...');
            this.shifts = await SettingsService.getShifts();
            this.renderTable();
        } catch (error) {
            Notification.error('載入失敗');
            document.getElementById('shifts-table-container').innerHTML = `<div class="text-danger">載入失敗: ${error.message}</div>`;
        } finally {
            Loading.hide();
        }
    },

    renderTable() {
        const container = document.getElementById('shifts-table-container');
        
        if (this.shifts.length === 0) {
            container.innerHTML = '<div class="alert alert-info">目前沒有班別設定，請新增。</div>';
            return;
        }

        let html = `
            <table class="table table-hover align-middle">
                <thead>
                    <tr>
                        <th>代碼</th>
                        <th>名稱</th>
                        <th>時間</th>
                        <th>顏色</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
        `;

        this.shifts.forEach(shift => {
            html += `
                <tr>
                    <td><span class="badge bg-light text-dark border">${shift.code}</span></td>
                    <td>${shift.name}</td>
                    <td>${shift.startTime} - ${shift.endTime}</td>
                    <td>
                        <div style="width: 24px; height: 24px; background-color: ${shift.color}; border-radius: 4px; border: 1px solid #ddd;"></div>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary edit-shift-btn" data-id="${shift.id}">編輯</button>
                        <button class="btn btn-sm btn-outline-danger delete-shift-btn" data-id="${shift.id}">刪除</button>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;

        // 綁定動態生成的按鈕事件
        container.querySelectorAll('.edit-shift-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.editShift(e.target.dataset.id));
        });
        container.querySelectorAll('.delete-shift-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.deleteShift(e.target.dataset.id));
        });
    },

    bindEvents() {
        document.getElementById('add-shift-btn')?.addEventListener('click', () => this.addShift());
    },

    async addShift() {
        const result = await Modal.form('新增班別', [
            { name: 'name', label: '班別名稱', placeholder: '例如: 白班', required: true },
            { name: 'code', label: '代碼', placeholder: '例如: D', required: true },
            { name: 'startTime', label: '開始時間', type: 'time', value: '08:00', required: true },
            { name: 'endTime', label: '結束時間', type: 'time', value: '16:00', required: true },
            { name: 'color', label: '代表色', type: 'color', value: '#ffffff', required: true }
        ]);

        if (result) {
            try {
                Loading.show('儲存中...');
                // 產生一個唯一 ID
                const newShift = { ...result, id: 'shift_' + Date.now() };
                await SettingsService.saveShift(newShift);
                await this.loadShifts();
                Notification.success('新增成功');
            } catch (error) {
                Notification.error('儲存失敗: ' + error.message);
            } finally {
                Loading.hide();
            }
        }
    },

    async editShift(id) {
        const shift = this.shifts.find(s => s.id === id);
        if (!shift) return;

        const result = await Modal.form('編輯班別', [
            { name: 'name', label: '班別名稱', value: shift.name, required: true },
            { name: 'code', label: '代碼', value: shift.code, required: true },
            { name: 'startTime', label: '開始時間', type: 'time', value: shift.startTime, required: true },
            { name: 'endTime', label: '結束時間', type: 'time', value: shift.endTime, required: true },
            { name: 'color', label: '代表色', type: 'color', value: shift.color, required: true }
        ]);

        if (result) {
            try {
                Loading.show('更新中...');
                const updatedShift = { ...shift, ...result };
                await SettingsService.saveShift(updatedShift);
                await this.loadShifts();
                Notification.success('更新成功');
            } catch (error) {
                Notification.error('更新失敗: ' + error.message);
            } finally {
                Loading.hide();
            }
        }
    },

    async deleteShift(id) {
        if (await Modal.confirm('確定要刪除此班別嗎？')) {
            try {
                Loading.show('刪除中...');
                await SettingsService.deleteShift(id);
                await this.loadShifts();
                Notification.success('刪除成功');
            } catch (error) {
                Notification.error('刪除失敗');
            } finally {
                Loading.hide();
            }
        }
    }
};
