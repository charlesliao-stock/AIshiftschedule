/**
 * js/modules/unit-management/unit-create.js
 * 新增單位模組 (ES Module 版)
 */

import { UnitService } from '../../services/unit.service.js';
import { Notification } from '../../components/notification.js';
import { Loading } from '../../components/loading.js';
import { UnitManagement } from './unit-management.js'; // 用於返回列表

export const UnitCreate = {
    init() {
        console.log('[UnitCreate] 初始化...');
        this.render();
    },

    render() {
        const container = document.getElementById('main-content');
        container.innerHTML = `
            <div class="page-header">
                <h1>新增單位</h1>
                <button class="btn btn-secondary" id="back-btn">← 返回列表</button>
            </div>
            <div class="card">
                <div class="card-body">
                    <form id="create-unit-form" class="form-grid">
                        <div class="form-group">
                            <label class="form-label required">單位代碼</label>
                            <input type="text" name="unit_code" class="form-input" placeholder="例如: 9B" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label required">單位名稱</label>
                            <input type="text" name="unit_name" class="form-input" placeholder="例如: 9B病房" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">管理員 Email (選填)</label>
                            <input type="email" name="admin_email" class="form-input" placeholder="預設分配給建立者">
                        </div>
                        <div class="form-actions">
                            <button type="submit" class="btn btn-primary">建立單位</button>
                        </div>
                    </form>
                </div>
            </div>
        `;

        this.bindEvents();
    },

    bindEvents() {
        document.getElementById('back-btn')?.addEventListener('click', () => {
            UnitManagement.init(); // 返回列表
        });

        document.getElementById('create-unit-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleSubmit(new FormData(e.target));
        });
    },

    async handleSubmit(formData) {
        try {
            Loading.show('正在建立單位與試算表...');
            
            const data = {
                unit_code: formData.get('unit_code'),
                unit_name: formData.get('unit_name'),
                admin_email: formData.get('admin_email')
            };

            await UnitService.createUnit(data);
            
            Loading.hide();
            Notification.success('單位建立成功！');
            UnitManagement.init(); // 返回列表

        } catch (error) {
            Loading.hide();
            Notification.error('建立失敗: ' + error.message);
        }
    }
};