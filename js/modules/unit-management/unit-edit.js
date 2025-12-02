/**
 * js/modules/unit-management/unit-edit.js
 * 編輯單位模組 (完整修復版)
 */

import { UnitService } from '../../services/unit.service.js';
import { Notification } from '../../components/notification.js';
import { Loading } from '../../components/loading.js';

export const UnitEdit = {
    async init(unitId) {
        console.log('[UnitEdit] 初始化...', unitId);
        await this.loadUnit(unitId);
    },

    async loadUnit(unitId) {
        try {
            Loading.show('載入資料...');
            // 使用新補上的 getUnit 方法
            const unit = await UnitService.getUnit(unitId);
            this.render(unit);
        } catch (error) {
            Notification.error('載入失敗: ' + error.message);
            if (window.router) window.router.loadUnits();
        } finally {
            Loading.hide();
        }
    },

    render(unit) {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="page-header">
                <h1>編輯單位: ${unit.name}</h1>
                <button class="btn btn-secondary" id="back-btn">← 返回列表</button>
            </div>
            <div class="card">
                <div class="card-body">
                    <form id="edit-unit-form">
                        <input type="hidden" name="id" value="${unit.id}">
                        
                        <div class="form-group mb-3">
                            <label class="form-label">單位代碼</label>
                            <input type="text" name="code" class="form-input" value="${unit.code || ''}" required>
                        </div>

                        <div class="form-group mb-3">
                            <label class="form-label">單位名稱</label>
                            <input type="text" name="name" class="form-input" value="${unit.name || ''}" required>
                        </div>
                        
                        <div class="form-group mb-3">
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
        document.getElementById('back-btn')?.addEventListener('click', () => {
            if (window.router) window.router.loadUnits();
        });

        document.getElementById('edit-unit-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const unitId = formData.get('id');
            
            const updates = {
                code: formData.get('code'),
                name: formData.get('name'),
                status: formData.get('status')
            };

            try {
                Loading.show('儲存中...');
                await UnitService.updateUnit(unitId, updates);
                Notification.success('更新成功');
                if (window.router) window.router.loadUnits();
            } catch (error) {
                Notification.error('更新失敗: ' + error.message);
            } finally {
                Loading.hide();
            }
        });
    }
};
