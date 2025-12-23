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

            if (units.length === 0) {
                unitOptionsHtml = '<option value="">無權限</option>';
            } else {
                unitOptionsHtml = units.map(u => 
                    `<option value="${u.unitId}">${u.unitName} (${u.unitCode})</option>`
                ).join('');
            }

            const isRealAdmin = (this.currentUser.role === 'system_admin' && !this.currentUser.isImpersonating);
            return StaffListTemplate.renderLayout(unitOptionsHtml, isRealAdmin, isSelectDisabled);

        } catch (e) {
            console.error(e);
            return `<div class="alert alert-danger m-3">載入失敗: ${e.message}</div>`;
        }
    }

    async afterRender() {
        // ✅ [關鍵修正] 優先綁定 Router，防止按鈕點擊無反應
        window.routerPage = this;

        // 安全初始化 Modal
        const modalElement = document.getElementById('edit-staff-modal');
        if (modalElement) {
            try {
                this.editModal = new bootstrap.Modal(modalElement);
            } catch (e) {
                console.warn("Modal 初始化異常，嘗試使用現有實例:", e);
                // 嘗試獲取既有實例
                const existingModal = bootstrap.Modal.getInstance(modalElement);
                if (existingModal) this.editModal = existingModal;
                else this.editModal = new bootstrap.Modal(modalElement);
            }
        }

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
        
        // 綁定儲存按鈕
        document.getElementById('btn-save')?.addEventListener('click', () => this.saveEdit());
        
        document.querySelectorAll('th[data-sort]').forEach(th => { th.addEventListener('click', () => this.handleSort(th.dataset.sort)); });

        if (targetUnitId) await this.loadData(targetUnitId);
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
            // ✅ [修正] 排序相容性：支援 staffName/staffCode 也能讀舊資料
            let valA = a[this.sortConfig.key] || '';
            let valB = b[this.sortConfig.key] || '';
            
            if(this.sortConfig.key === 'staffName') {
                valA = a.staffName || a.name || '';
                valB = b.staffName || b.name || '';
            }
            if(this.sortConfig.key === 'staffCode') {
                valA = a.staffCode || a.staffId || '';
                valB = b.staffCode || b.staffId || '';
            }

            return this.sortConfig.direction === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
        });
        this.renderTable();
    }

    filterData(keyword) {
        if (!keyword) { this.applySort(); return; }
        const k = keyword.toLowerCase();
        this.displayList = this.staffList.filter(s => 
            // ✅ [修正] 搜尋相容性
            (s.staffName && s.staffName.toLowerCase().includes(k)) || 
            (s.name && s.name.toLowerCase().includes(k)) ||
            (s.staffCode && s.staffCode.toLowerCase().includes(k)) ||
            (s.staffId && s.staffId.toLowerCase().includes(k))
        );
        this.renderTable();
    }

    renderTable() {
        const tbody = document.getElementById('staff-tbody');
        if(!tbody) return;
        const isRealAdmin = (this.currentUser.role === 'system_admin' && !this.currentUser.isImpersonating);
        tbody.innerHTML = StaffListTemplate.renderRows(this.displayList, isRealAdmin);
    }
    
    // ✅ 編輯 Modal 填值 (相容性讀取)
    openEditModal(uid) {
        const user = this.staffList.find(u => u.uid === uid);
        if(!user) return;
        
        document.getElementById('edit-uid').value = uid;
        
        // 優先讀取新欄位，若無則讀舊欄位
        document.getElementById('edit-staffName').value = user.staffName || user.name || '';
        document.getElementById('edit-staffCode').value = user.staffCode || user.staffId || '';
        
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

    // ✅ 儲存編輯 (寫入新欄位)
    async saveEdit() {
        const uid = document.getElementById('edit-uid').value;
        const btn = document.getElementById('btn-save');
        
        const data = {
            // 寫入 staffName / staffCode
            staffName: document.getElementById('edit-staffName').value,
            staffCode: document.getElementById('edit-staffCode').value,
            
            title: document.getElementById('edit-title').value,
            level: document.getElementById('edit-level').value,
            role: document.getElementById('edit-is-manager').checked ? 'unit_manager' : 
                  (document.getElementById('edit-is-scheduler').checked ? 'unit_scheduler' : 'user'),
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
            
            // 重新載入
            const unitSelect = document.getElementById('unit-filter');
            if(unitSelect) this.loadData(unitSelect.value);
        } catch(e) {
            alert("錯誤: " + e.message);
        } finally {
            btn.disabled = false;
        }
    }
    
    async deleteStaff(uid) {
        if(confirm("確定刪除？")) {
            await userService.deleteStaff(uid);
            alert("已刪除");
            const currentUnitId = document.getElementById('unit-filter').value;
            this.loadData(currentUnitId);
        }
    }
}
