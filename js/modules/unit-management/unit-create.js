/**
 * js/modules/unit-management/unit-create.js
 * 新增單位模組 (修正版 - 欄位對應)
 */

import { UnitService } from '../../services/unit.service.js';
import { Notification } from '../../components/notification.js';
import { Loading } from '../../components/loading.js';

export const UnitCreate = {
    init() {
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
                            <input type="text" name="code" class="form-input" placeholder="例如: 9B" required>
                            <small class="text-muted">用於建立試算表檔名，請使用英文或數字</small>
                        </div>
                        <div class="form-group">
                            <label class="form-label required">單位名稱</label>
                            <input type="text" name="name" class="form-input" placeholder="例如: 9B病房" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label">管理員 Email (選填)</label>
                            <input type="email" name="admin_email" class="form-input" placeholder="預設分配給建立者">
                        </div>
                        <div class="form-actions mt-3">
                            <button type="submit" class="btn btn-primary">建立單位 (會同步建立 Sheets)</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        this.bindEvents();
    },

    bindEvents() {
        document.getElementById('back-btn')?.addEventListener('click', () => {
            if (window.router) window.router.navigate('/units');
        });

        document.getElementById('create-unit-form')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleSubmit(new FormData(e.target));
        });
    },

    async handleSubmit(formData) {
        try {
            Loading.show('正在建立單位並生成 Google Sheets，請稍候...');
            
            // 修正：欄位對應
            const data = {
                unit_code: formData.get('code'),
                unit_name: formData.get('name'),
                admin_email: formData.get('admin_email')
            };

            await UnitService.createUnit(data);
            
            Notification.success('單位建立成功！');
            if (window.router) window.router.navigate('/units');

        } catch (error) {
            Notification.error('建立失敗: ' + error.message);
        } finally {
            Loading.hide();
        }
    }
};
