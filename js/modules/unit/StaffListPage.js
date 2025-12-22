import { userService } from "../../services/firebase/UserService.js";
import { UnitService } from "../../services/firebase/UnitService.js";
import { authService } from "../../services/firebase/AuthService.js";
import { StaffListTemplate } from "./templates/StaffListTemplate.js";

export class StaffListPage {
    constructor() {
        this.staffList = [];
        this.displayList = [];
        this.currentUser = null;
        this.editModal = null;
        this.sortConfig = { key: 'staffId', direction: 'asc' };
    }

    async render() {
        // ... (render 方法保持不變，直接回傳 Template) ...
        // 為節省篇幅，請保留您原本的 render 程式碼，重點是 afterRender 的邏輯
        let retries = 0;
        while (!authService.getProfile() && retries < 10) { await new Promise(r => setTimeout(r, 200)); retries++; }
        this.currentUser = authService.getProfile();
        
        let unitOptionsHtml = '<option value="">載入中...</option>';
        let isSelectDisabled = false;

        try {
            let units = [];
            if (this.currentUser.isImpersonating) {
                if (this.currentUser.unitId) {
                    const u = await UnitService.getUnitById(this.currentUser.unitId);
                    if(u) units = [u];
                }
                isSelectDisabled = true;
            } else if (this.currentUser.role === 'system_admin') {
                units = await UnitService.getAllUnits();
            } else {
                units = await UnitService.getUnitsByManager(this.currentUser.uid);
                if(units.length === 0 && this.currentUser.unitId) {
                    const u = await UnitService.getUnitById(this.currentUser.unitId);
                    if(u) units.push(u);
                }
            }

            if (units.length === 0) {
                unitOptionsHtml = '<option value="">無權限</option>';
            } else {
                unitOptionsHtml = units.map(u => `<option value="${u.unitId}">${u.unitName} (${u.unitCode})</option>`).join('');
            }

            const isRealAdmin = (this.currentUser.role === 'system_admin' && !this.currentUser.isImpersonating);
            return StaffListTemplate.renderLayout(unitOptionsHtml, isRealAdmin, isSelectDisabled);

        } catch (e) {
            return `<div class="alert alert-danger m-3">載入失敗: ${e.message}</div>`;
        }
    }

    async afterRender() {
        const modalElement = document.getElementById('edit-staff-modal');
        if (!modalElement) return;

        this.editModal = new bootstrap.Modal(modalElement);
        window.routerPage = this;

        const unitSelect = document.getElementById('unit-filter');
        
        // 🔴【關鍵修正】決定預設載入的 Unit ID
        let defaultUnitId = null;

        // 情況 A: 鎖定狀態 (模擬中) -> 直接使用 User Profile 的 UnitId
        if (this.currentUser.isImpersonating || unitSelect.disabled) {
            defaultUnitId = this.currentUser.unitId;
        } 
        // 情況 B: 一般狀態 -> 取下拉選單的第一個值 (如果有的話)
        else if (unitSelect.options.length > 0) {
            defaultUnitId = unitSelect.options[0].value;
        }

        // 1. 設定下拉選單 UI
        if (defaultUnitId && unitSelect) {
            unitSelect.value = defaultUnitId;
        }

        // 2. 綁定事件
        unitSelect?.addEventListener('change', (e) => this.loadData(e.target.value));
        
        document.getElementById('btn-add-staff')?.addEventListener('click', () => window.location.hash = '/unit/staff/create');
        document.getElementById('keyword-search')?.addEventListener('input', (e) => this.filterData(e.target.value));
        document.getElementById('btn-save')?.addEventListener('click', () => this.saveEdit());
        document.querySelectorAll('th[data-sort]').forEach(th => {
            th.addEventListener('click', () => this.handleSort(th.dataset.sort));
        });

        // 3. 強制執行載入 (傳入 ID，不依賴 DOM)
        if (defaultUnitId) {
            await this.loadData(defaultUnitId);
        }
    }

    // 🔴【關鍵修正】接收參數
    async loadData(unitId) {
        if(!unitId) return;

        const tbody = document.getElementById('staff-tbody');
        if(tbody) tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>';

        try {
            // 直接使用傳入的 ID
            this.staffList = await userService.getUsersByUnit(unitId);
            this.applySort(); 
        } catch (e) {
            console.error(e);
            if(tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">載入失敗: ${e.message}</td></tr>`;
        }
    }

    // ... (其餘 handleSort, applySort, filterData, renderTable, openEditModal, saveEdit, deleteStaff 維持不變) ...
    handleSort(key) { /* ...略... */ this.applySort(); }
    
    applySort() {
        const { key, direction } = this.sortConfig;
        this.displayList = [...this.staffList].sort((a, b) => {
            let valA = a[key] || '';
            let valB = b[key] || '';
            if (valA < valB) return direction === 'asc' ? -1 : 1;
            if (valA > valB) return direction === 'asc' ? 1 : -1;
            return 0;
        });
        this.renderTable();
    }

    filterData(keyword) {
        if (!keyword) { this.applySort(); return; }
        const lower = keyword.toLowerCase();
        this.displayList = this.staffList.filter(s => (s.name && s.name.toLowerCase().includes(lower)) || (s.staffId && s.staffId.toLowerCase().includes(lower)));
        this.renderTable();
    }

    renderTable() {
        const tbody = document.getElementById('staff-tbody');
        if(!tbody) return;
        const isRealAdmin = (this.currentUser.role === 'system_admin' && !this.currentUser.isImpersonating);
        tbody.innerHTML = StaffListTemplate.renderRows(this.displayList, isRealAdmin);
    }
    
    openEditModal(uid) { /* ...略 (保持原樣)... */ this.editModal.show(); }
    async saveEdit() { /* ...略 (保持原樣)... */ }
    async deleteStaff(uid) { /* ...略 (保持原樣)... */ }
}
