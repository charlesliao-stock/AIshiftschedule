/**
 * js/modules/settings/shift-management.js
 * 班別管理子模組 (ES Module 版)
 */

import { SettingsService } from '../../services/settings.service.js';
import { Notification } from '../../components/notification.js';
import { Loading } from '../../components/loading.js';
import { Modal } from '../../components/modal.js';
import { Shift } from '../../models/shift.model.js'; // 引用模型

export const ShiftManagement = {
    container: null,
    shifts: [],

    async init(containerElement) {
        this.container = containerElement;
        await this.loadShifts();
    },

    async loadShifts() {
        try {
            this.shifts = await SettingsService.getShifts();
            this.render();
        } catch (error) {
            this.container.innerHTML = `<div class="error-state">無法載入班別: ${error.message}</div>`;
        }
    },

    render() {
        let html = `
            <div class="tab-actions" style="margin-bottom: 16px; display: flex; justify-content: flex-end;">
                <button class="btn btn-primary" id="add-shift-btn">＋ 新增班別</button>
            </div>
            <table class="table">
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
                    <td><span class="shift-badge" style="background:${shift.color}">${shift.code}</span></td>
                    <td>${shift.name}</td>
                    <td>${shift.startTime} - ${shift.endTime}</td>
                    <td><div style="width:20px;height:20px;background:${shift.color};border-radius:4px;"></div></td>
                    <td>
                        <button class="btn btn-sm btn-info edit-shift" data-id="${shift.id}">編輯</button>
                        <button class="btn btn-sm btn-danger delete-shift" data-id="${shift.id}">刪除</button>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        this.container.innerHTML = html;
        this.bindEvents();
    },

    bindEvents() {
        document.getElementById('add-shift-btn')?.addEventListener('click', () => this.showModal());
        
        this.container.querySelectorAll('.edit-shift').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.target.dataset.id;
                const shift = this.shifts.find(s => String(s.id) === String(id));
                this.showModal(shift);
            });
        });

        this.container.querySelectorAll('.delete-shift').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleDelete(e.target.dataset.id));
        });
    },

    showModal(shift = null) {
        const isEdit = !!shift;
        const title = isEdit ? '編輯班別' : '新增班別';
        
        // 使用 Modal.form 快速建立表單
        Modal.form(title, [
            { name: 'name', label: '班別名稱', value: shift?.name, required: true },
            { name: 'code', label: '代碼 (如: D)', value: shift?.code, required: true },
            { name: 'startTime', label: '開始時間', type: 'time', value: shift?.startTime, required: true },
            { name: 'endTime', label: '結束時間', type: 'time', value: shift?.endTime, required: true },
            { name: 'color', label: '代表色', type: 'color', value: shift?.color || '#eeeeee', required: true }
        ]).then(async (data) => {
            if (data) {
                await this.handleSave(data, shift?.id);
            }
        });
    },

    async handleSave(data, id) {
        try {
            Loading.show('儲存中...');
            
            // 建立模型並驗證
            const shiftModel = new Shift({ ...data, id });
            const validation = shiftModel.validate();
            
            if (!validation.valid) {
                Loading.hide();
                Notification.error(validation.errors.join(', '));
                return;
            }

            await SettingsService.saveShift(shiftModel.toObject());
            
            Loading.hide();
            Notification.success('儲存成功');
            await this.loadShifts(); // 重新載入

        } catch (error) {
            Loading.hide();
            Notification.error('儲存失敗: ' + error.message);
        }
    },

    async handleDelete(id) {
        if (!await Modal.confirm('確定刪除此班別？')) return;
        
        try {
            Loading.show('刪除中...');
            await SettingsService.deleteShift(id);
            Loading.hide();
            Notification.success('刪除成功');
            await this.loadShifts();
        } catch (error) {
            Loading.hide();
            Notification.error('刪除失敗');
        }
    }
};