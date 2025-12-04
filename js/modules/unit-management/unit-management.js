/**
 * js/modules/unit-management/unit-management.js
 * 單位管理主控 (完整實作版)
 */
import { UnitService } from '../../services/unit.service.js';
import { Modal } from '../../components/modal.js';
import { Loading } from '../../components/loading.js';
import { Notification } from '../../components/notification.js';
import { UnitEdit } from './unit-edit.js';
import { UserAssignment } from './user-assignment.js';
import { UnitCreate } from './unit-create.js'; // 引入建立模組

export const UnitManagement = {
    units: [],
    container: null,

    async init() {
        console.log('[UnitMgmt] 初始化...');
        // 取得主要容器 (通常是 router 指定的 main-content)
        this.container = document.getElementById('main-content');
        if (!this.container) return;

        await this.loadUnits();
    },

    async loadUnits() {
        Loading.show('載入單位列表...');
        try {
            this.units = await UnitService.getAllUnits();
            
            if (this.units.length === 0) {
                this.renderEmptyState();
                // 首次使用引導
                Modal.confirm({
                    title: '建立單位資料',
                    message: '系統偵測到無單位資料。是否立即建立？',
                    confirmText: '建立',
                    onConfirm: () => this.openCreatePage()
                });
            } else {
                this.renderUnitList();
            }
        } catch (error) {
            console.error(error);
            Notification.error('載入失敗');
        } finally {
            Loading.hide();
        }
    },

    openCreatePage() {
        // 轉交給 UnitCreate 模組渲染
        UnitCreate.init();
    },

    openEditPage(unitId) {
        // 轉交給 UnitEdit 模組渲染
        UnitEdit.init(unitId);
    },

    openAssignmentModal(unitId) {
        // 開啟人員分配彈窗
        UserAssignment.openDialog(unitId);
    },

    async deleteUnit(unitId) {
        if (await Modal.confirm('確定要刪除此單位嗎？此動作無法復原！')) {
            try {
                Loading.show('刪除中...');
                await UnitService.deleteUnit(unitId); // 需確保 Service 有此方法
                Notification.success('單位已刪除');
                await this.loadUnits(); // 重新載入
            } catch (error) {
                Notification.error('刪除失敗: ' + error.message);
            } finally {
                Loading.hide();
            }
        }
    },

    renderEmptyState() {
        this.container.innerHTML = `
            <div class="empty-state p-5 text-center">
                <div style="font-size: 48px; margin-bottom: 20px;">🏥</div>
                <h3>歡迎使用排班系統</h3>
                <p class="text-muted">目前尚未建立任何護理單位資料。</p>
                <button id="btn-init-create" class="btn btn-primary mt-3">立即建立第一個單位</button>
            </div>
        `;
        document.getElementById('btn-init-create')?.addEventListener('click', () => this.openCreatePage());
    },

    renderUnitList() {
        // 1. 渲染標題與按鈕
        let html = `
            <div class="page-header d-flex justify-content-between align-items-center mb-4">
                <h1>單位維護</h1>
                <button class="btn btn-primary" id="btn-create-unit">
                    <span class="icon">➕</span> 新增單位
                </button>
            </div>
            <div class="card">
                <div class="card-body p-0">
                    <div class="table-responsive">
                        <table class="table table-hover align-middle mb-0">
                            <thead class="bg-light">
                                <tr>
                                    <th class="ps-4">單位名稱</th>
                                    <th>代碼</th>
                                    <th>狀態</th>
                                    <th>人員數</th>
                                    <th class="text-end pe-4">操作</th>
                                </tr>
                            </thead>
                            <tbody>
        `;

        // 2. 渲染列表
        this.units.forEach(unit => {
            const statusBadge = unit.status === 'active' 
                ? '<span class="badge bg-success bg-opacity-10 text-success">啟用中</span>' 
                : '<span class="badge bg-secondary bg-opacity-10 text-secondary">已停用</span>';
            
            // 計算人員總數 (admin + scheduler + viewer)
            // 這裡假設 unit 物件有這些陣列，若無則顯示 0
            const userCount = (unit.adminUsers?.length || 0) + (unit.schedulerUsers?.length || 0);

            html += `
                <tr>
                    <td class="ps-4 fw-bold">${unit.name}</td>
                    <td>${unit.code}</td>
                    <td>${statusBadge}</td>
                    <td>${userCount} 人</td>
                    <td class="text-end pe-4">
                        <button class="btn btn-sm btn-outline-primary me-1 btn-assign" data-id="${unit.id}">
                            👥 分配人員
                        </button>
                        <button class="btn btn-sm btn-outline-secondary me-1 btn-edit" data-id="${unit.id}">
                            ✏️ 編輯
                        </button>
                        <button class="btn btn-sm btn-outline-danger btn-delete" data-id="${unit.id}">
                            🗑️
                        </button>
                    </td>
                </tr>
            `;
        });

        html += `
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        this.container.innerHTML = html;

        // 3. 綁定事件
        document.getElementById('btn-create-unit')?.addEventListener('click', () => this.openCreatePage());

        this.container.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => this.openEditPage(e.target.dataset.id));
        });

        this.container.querySelectorAll('.btn-assign').forEach(btn => {
            btn.addEventListener('click', (e) => this.openAssignmentModal(e.target.dataset.id));
        });

        this.container.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => this.deleteUnit(e.target.dataset.id));
        });
    }
};
