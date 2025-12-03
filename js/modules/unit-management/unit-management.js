/**
 * js/modules/unit-management/unit-management.js
 * 單位管理主控 (含空狀態引導)
 */
import { UnitService } from '../../services/unit.service.js';
import { Modal } from '../../components/modal.js';

export class UnitManagement {
    constructor() {
        this.units = [];
        this.init();
    }

    async init() {
        console.log('[UnitMgmt] 初始化...');
        await this.loadUnits();
    }

    async loadUnits() {
        const container = document.getElementById('unit-list-container');
        if(container) container.innerHTML = '<div class="loading">載入中...</div>';

        this.units = await UnitService.getAllUnits();

        // UX 改善：空狀態判斷
        if (this.units.length === 0) {
            this.renderEmptyState();
            this.promptCreateUnit();
        } else {
            this.renderUnitList();
        }
    }

    renderEmptyState() {
        const container = document.getElementById('unit-list-container');
        if(!container) return;
        
        container.innerHTML = `
            <div class="empty-state p-5 text-center">
                <h3>🏥 歡迎使用排班系統</h3>
                <p class="text-muted">目前尚未建立任何護理單位資料。</p>
                <button id="btn-init-create" class="btn btn-primary mt-3">立即建立第一個單位</button>
            </div>
        `;
        
        document.getElementById('btn-init-create').onclick = () => this.openCreateModal();
    }

    promptCreateUnit() {
        // 主動跳出視窗邀請
        Modal.confirm({
            title: '建立單位資料',
            message: '系統偵測到無單位資料。是否立即建立？',
            confirmText: '建立',
            onConfirm: () => this.openCreateModal()
        });
    }

    openCreateModal() {
        // 呼叫您原本的 Modal 開啟邏輯
        console.log('開啟建立視窗...');
        // Modal.open('modal-unit-form'); 
    }

    renderUnitList() {
        // 正常的列表渲染邏輯 (略)
        console.log('渲染單位列表:', this.units);
    }
}
