/**
 * js/modules/settings/rule-management.js
 * 規則管理模組
 */
import { SettingsService } from '../../services/settings.service.js';
import { Notification } from '../../components/notification.js';

// 👇 關鍵：一定要有 export const
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
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle">
                            <thead>
                                <tr>
                                    <th>代碼</th>
                                    <th>名稱</th>
                                    <th>時間</th>
                                    <th>顏色</th>
                                </tr>
                            </thead>
                            <tbody id="shifts-tbody">
                                <tr><td colspan="4" class="text-center text-muted">載入中...</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    },

    async loadData() {
        try {
            const shifts = await SettingsService.getShifts();
            this.renderShifts(shifts);
        } catch (error) {
            console.error(error);
            const tbody = document.getElementById('shifts-tbody');
            if(tbody) tbody.innerHTML = '<tr><td colspan="4" class="text-center text-danger">載入失敗</td></tr>';
        }
    },

    renderShifts(shifts) {
        const tbody = document.getElementById('shifts-tbody');
        if (!tbody) return;

        if (!shifts || shifts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">無班別設定</td></tr>';
            return;
        }

        tbody.innerHTML = shifts.map(shift => `
            <tr>
                <td><span class="badge bg-light text-dark border">${shift.code || shift.id}</span></td>
                <td>${shift.name}</td>
                <td>${shift.startTime || ''} - ${shift.endTime || ''}</td>
                <td>
                    <div style="width: 24px; height: 24px; background-color: ${shift.color}; border-radius: 4px; border: 1px solid #ddd;"></div>
                </td>
            </tr>
        `).join('');
    }
};
