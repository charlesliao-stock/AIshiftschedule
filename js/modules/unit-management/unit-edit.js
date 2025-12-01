/**
 * js/modules/unit-management/unit-edit.js
 * 編輯單位模組 (ES Module 版)
 */

import { UnitService } from '../../services/unit.service.js';
import { Notification } from '../../components/notification.js';
import { Loading } from '../../components/loading.js';
import { UnitManagement } from './unit-management.js';

export const UnitEdit = {
    async init(unitId) {
        console.log('[UnitEdit] 初始化...', unitId);
        await this.loadUnit(unitId);
    },

    async loadUnit(unitId) {
        try {
            Loading.show('載入資料...');
            const unit = await UnitService.getUnit(unitId);
            this.render(unit);
            Loading.hide();
        } catch (error) {
            Loading.hide();
            Notification.error('載入失敗');
            UnitManagement.init();
        }
    },

    render(unit) {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="page-header">
                <h1>編輯單位: ${unit.unit_name}</h1>
                <button class="btn btn-secondary" id="back-btn">← 返回列表</button>
            </div>
            <div class="card">
                <div class="card-body">
                    <form id="edit-unit-form">
                        <input type="hidden" name="unit_id" value="${unit.unit_id}">
                        <div class="form-group">
                            <label class="form-label">單位名稱</label>
                            <input type="text" name="unit_name" class="form-input" value="${unit.unit_name}" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">狀態</label>
                            <select name="status" class="form-select">
                                <option value="active" ${unit.status === 'active' ? 'selected' : ''}>啟用</option>
                                <option value="inactive" ${unit.status === 'inactive' ? 'selected' : ''}>停用</option>
                            </select>
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary">儲存變更</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        this.bindEvents();
    },

    bindEvents() {
        document.getElementById('back-btn')?.addEventListener('click', () => UnitManagement.init());

        document.getElementById('edit-unit-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const unitId = formData.get('unit_id');
            const updates = {
                unit_name: formData.get('unit_name'),
                status: formData.get('status')
            };

            try {
                Loading.show('儲存中...');
                await UnitService.updateUnit(unitId, updates);
                Loading.hide();
                Notification.success('更新成功');
                UnitManagement.init();
            } catch (error) {
                Loading.hide();
                Notification.error('更新失敗: ' + error.message);
            }
        });
    }
};