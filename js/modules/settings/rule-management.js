/**
 * js/modules/settings/rule-management.js
 * 規則管理模組 (ES Module 版)
 * 負責管理: 班別定義、排班規則、休假規則
 */

import { SettingsService } from '../../services/settings.service.js';
import { Notification } from '../../components/notification.js';
import { Loading } from '../../components/loading.js';

export const RuleManagement = {
    container: null,

    async init(container) {
        console.log('[RuleManagement] 初始化...');
        this.container = container;
        this.render();
        await this.loadData();
    },

    render() {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="card mb-4">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h5 class="mb-0">班別定義 (Shifts)</h5>
                    <button class="btn btn-sm btn-outline-primary" id="add-shift-btn">
                        <i class="fas fa-plus"></i> 新增班別
                    </button>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle" id="shifts-table">
                            <thead>
                                <tr>
                                    <th>代碼</th>
                                    <th>名稱</th>
                                    <th>時間</th>
                                    <th>顏色</th>
                                    <th>操作</th>
                                </tr>
                            </thead>
                            <tbody id="shifts-tbody">
                                <tr><td colspan="5" class="text-center text-muted">載入中...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">
                    <h5 class="mb-0">排班規則參數</h5>
                </div>
                <div class="card-body">
                    <form id="rules-form">
                        <div class="row g-3">
                            <div class="col-md-6">
                                <label class="form-label">每月班數上限</label>
                                <input type="number" class="form-control" name="max_shifts" value="22">
                            </div>
                            <div class="col-md-6">
                                <label class="form-label">連續上班天數上限</label>
                                <input type="number" class="form-control" name="max_consecutive" value="6">
                            </div>
                            <div class="col-12 text-end mt-4">
                                <button type="submit" class="btn btn-primary">儲存規則設定</button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        `;

        this.bindEvents();
    },

    async loadData() {
        try {
            // 載入班別設定
            const shifts = await SettingsService.getShifts();
            this.renderShifts(shifts);
            
            // 載入其他規則 (如果有)
            // const rules = await SettingsService.getRules();
            // this.fillRulesForm(rules);
            
        } catch (error) {
            Notification.error('載入規則失敗: ' + error.message);
        }
    },

    renderShifts(shifts) {
        const tbody = document.getElementById('shifts-tbody');
        if (!tbody) return;

        if (!shifts || shifts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">目前沒有班別設定</td></tr>';
            return;
        }

        tbody.innerHTML = shifts.map(shift => `
            <tr>
                <td><span class="badge bg-light text-dark border">${shift.code}</span></td>
                <td>${shift.name}</td>
                <td>${shift.startTime} - ${shift.endTime}</td>
                <td>
                    <div style="width: 24px; height: 24px; background-color: ${shift.color}; border-radius: 4px; border: 1px solid #ddd;"></div>
                </td>
                <td>
                    <button class="btn btn-sm btn-light text-primary edit-shift-btn" data-id="${shift.id}">編輯</button>
                </td>
            </tr>
        `).join('');
    },

    bindEvents() {
        // 綁定按鈕事件
        document.getElementById('add-shift-btn')?.addEventListener('click', () => {
            Notification.info('新增班別功能開發中');
        });

        document.getElementById('rules-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            Notification.success('規則設定已儲存 (模擬)');
        });
    }
};
