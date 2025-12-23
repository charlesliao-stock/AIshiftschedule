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
        // ✅ 排序鍵值標準化
        this.sortConfig = { key: 'staffCode', direction: 'asc' };
    }

    async render() {
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
            }
            else if (this.currentUser.role === 'system_admin') {
                units = await UnitService.getAllUnits();
            } 
            else {
                units = await UnitService.getUnitsByManager(this.currentUser.uid);
                if(units.length === 0 && this.currentUser.unitId) {
                    const u = await UnitService.getUnitById(this.currentUser.unitId);
                    if(u) units.push(u);
                }
            }

            // ✅ 移除正規化 map (Service 已處理)
            if (units.length === 0) {
                unitOptionsHtml = '<option value="">無權限</option>';
            } else {
                // ✅ 直接讀取 unitId
                unitOptionsHtml = units.map(u => 
                    `<option value="${u.unitId}">${u.unitName} (${u.unitCode || '-'})</option>`
                ).join('');
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
        let targetUnitId = null;

        if (this.currentUser.isImpersonating) {
            targetUnitId = this.currentUser.unitId;
        } else if (unitSelect && unitSelect.options.length > 0) {
             targetUnitId = unitSelect.value || unitSelect.options[0].value;
        }

        if (unitSelect && targetUnitId) {
            unitSelect.value = targetUnitId;
        }

        unitSelect?.addEventListener('change', (e) => this.loadData(e.target.value));
        
        document.getElementById('btn-add-staff')?.addEventListener('click', () => { window.location.hash = '/unit/staff/create'; });
        document.getElementById('keyword-search')?.addEventListener('input', (e) => { this.filterData(e.target.value); });
        document.getElementById('btn-save')?.addEventListener('click', () => this.saveEdit());
        document.querySelectorAll('th[data-sort]').forEach(th => { th.addEventListener('click', () => this.handleSort(th.dataset.sort)); });

        if (targetUnitId) await this.loadData(targetUnitId);
        else document.getElementById('staff-tbody').innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">請選擇單位以檢視人員</td></tr>';
    }

    async loadData(unitId) {
        if(!unitId || unitId === 'undefined') return;
        const tbody = document.getElementById('staff-tbody');
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>';

        try {
            this.staffList = await userService.getUsersByUnit(unitId);
            this.applySort(); 
        } catch (e) { console.error(e); }
    }

    handleSort(key) {
        this.sortConfig.key = key; 
        this.sortConfig.direction = this.sortConfig.direction === 'asc' ? 'desc' : 'asc'; 
        this.applySort();
    }

    applySort() {
        if (!this.staffList) this.staffList = [];
        this.displayList = [...this.staffList].sort((a, b) => {
            // ✅ 使用標準欄位
            let valA = a[this.sortConfig.key] || '';
            let valB = b[this.sortConfig.key] || '';
            return this.sortConfig.direction === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
        });
        this.renderTable();
    }

    filterData(keyword) {
        if (!keyword) { this.applySort(); return; }
        const lower = keyword.toLowerCase();
        this.displayList = this.staffList.filter(s => 
            // ✅ 使用標準欄位
            (s.staffName && s.staffName.toLowerCase().includes(lower)) || 
            (s.staffCode && s.staffCode.toLowerCase().includes(lower))
        );
        this.renderTable();
    }

    renderTable() {
        const tbody = document.getElementById('staff-tbody');
        if(!tbody) return;
        const isRealAdmin = (this.currentUser.role === 'system_admin' && !this.currentUser.isImpersonating);
        tbody.innerHTML = StaffListTemplate.renderRows(this.displayList, isRealAdmin);
    }
    
    openEditModal(uid) {
        const user = this.staffList.find(u => u.uid === uid);
        if(!user) return;
        
        document.getElementById('edit-uid').value = uid;
        // ✅ 填入標準欄位
        document.getElementById('edit-staffName').value = user.staffName || '';
        document.getElementById('edit-staffCode').value = user.staffCode || '';
        document.getElementById('edit-email').value = user.email || '';
        document.getElementById('edit-title').value = user.title || 'N';
        document.getElementById('edit-level').value = user.level || 'N0';
        document.getElementById('edit-is-manager').checked = (user.role === 'unit_manager');
        document.getElementById('edit-is-scheduler').checked = (user.role === 'unit_scheduler');

        const c = user.constraints || {};
        document.getElementById('edit-isPregnant').checked = !!c.isPregnant;
        document.getElementById('edit-isPostpartum').checked = !!c.isPostpartum;
        document.getElementById('edit-canBatch').checked = !!c.canBatch;
        document.getElementById('edit-maxConsecutive').value = c.maxConsecutive || 6;
        document.getElementById('edit-maxConsecutiveNights').value = c.maxConsecutiveNights || 4;

        this.editModal.show();
    }

    async saveEdit() {
        const uid = document.getElementById('edit-uid').value;
        const btn = document.getElementById('btn-save');
        
        const data = {
            // ✅ 寫入標準欄位
            staffName: document.getElementById('edit-staffName').value,
            title: document.getElementById('edit-title').value,
            level: document.getElementById('edit-level').value,
            role: document.getElementById('edit-is-manager').checked ? 'unit_manager' : (document.getElementById('edit-is-scheduler').checked ? 'unit_scheduler' : 'user'),
            constraints: {
                isPregnant: document.getElementById('edit-isPregnant').checked,
                isPostpartum: document.getElementById('edit-isPostpartum').checked,
                canBatch: document.getElementById('edit-canBatch').checked,
                maxConsecutive: parseInt(document.getElementById('edit-maxConsecutive').value) || 6,
                maxConsecutiveNights: parseInt(document.getElementById('edit-maxConsecutiveNights').value) || 4
            }
        };

        btn.disabled = true;
        try {
            await userService.updateUser(uid, data);
            alert("✅ 修改成功");
            this.editModal.hide();
            this.loadData(document.getElementById('unit-filter').value);
        } catch(e) { alert("錯誤: " + e.message); } 
        finally { btn.disabled = false; }
    }
    
    async deleteStaff(uid) {
        if(confirm("確定刪除？")) {
            await userService.deleteStaff(uid);
            alert("已刪除");
            this.loadData(document.getElementById('unit-filter').value);
        }
    }
}
