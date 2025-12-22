import { userService } from "../../services/firebase/UserService.js";
import { UnitService } from "../../services/firebase/UnitService.js";
import { authService } from "../../services/firebase/AuthService.js";
import { StaffListTemplate } from "./templates/StaffListTemplate.js";

export class StaffListPage {
    constructor() {
        this.staffList = [];
        this.displayList = [];
        this.unitMap = {};
        this.currentUser = null;
        this.editModal = null;
        this.sortConfig = { key: 'staffId', direction: 'asc' };
    }

    async render() {
        let retries = 0;
        while (!authService.getProfile() && retries < 10) { await new Promise(r => setTimeout(r, 200)); retries++; }
        this.currentUser = authService.getProfile();
        
        let unitOptionsHtml = '<option value="">載入中...</option>';
        let isSelectDisabled = false;

        try {
            let units = [];
            
            // 模擬或一般權限判斷
            if (this.currentUser.isImpersonating) {
                if (this.currentUser.unitId) {
                    const u = await UnitService.getUnitById(this.currentUser.unitId);
                    if(u) units = [u];
                }
                isSelectDisabled = true; // 鎖定
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

            units.forEach(u => this.unitMap[u.unitId] = u.unitName);

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
        const modalElement = document.getElementById('edit-staff-modal');
        if (!modalElement) return;

        this.editModal = new bootstrap.Modal(modalElement);
        window.routerPage = this;

        const unitSelect = document.getElementById('unit-filter');
        
        // 🔴 關鍵修正：確保選單有值，並強制載入資料
        if (unitSelect && unitSelect.options.length > 0) {
            // 如果是被鎖定的 (只有一個選項)，強制選取第一個
            if (unitSelect.options.length === 1 || unitSelect.disabled) {
                unitSelect.selectedIndex = 0;
            }
            // 立即載入資料
            await this.loadData();
        }

        unitSelect?.addEventListener('change', () => this.loadData());
        
        document.getElementById('btn-add-staff')?.addEventListener('click', () => {
            window.location.hash = '/unit/staff/create';
        });

        document.getElementById('keyword-search')?.addEventListener('input', (e) => {
            this.filterData(e.target.value);
        });

        document.getElementById('btn-save')?.addEventListener('click', () => this.saveEdit());

        document.querySelectorAll('th[data-sort]').forEach(th => {
            th.addEventListener('click', () => this.handleSort(th.dataset.sort));
        });
    }

    async loadData() {
        const unitSelect = document.getElementById('unit-filter');
        const unitId = unitSelect ? unitSelect.value : null;
        
        const tbody = document.getElementById('staff-tbody');
        if(!tbody) return;

        if(!unitId) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">請選擇單位</td></tr>';
            return;
        }

        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>';

        try {
            this.staffList = await userService.getUsersByUnit(unitId);
            this.applySort(); // 這裡會負責渲染 tbody
        } catch (e) {
            console.error(e);
            tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger">載入失敗: ${e.message}</td></tr>`;
        }
    }

    handleSort(key) {
        if (this.sortConfig.key === key) {
            this.sortConfig.direction = this.sortConfig.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortConfig.key = key;
            this.sortConfig.direction = 'asc';
        }
        this.applySort();
    }

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
        if (!keyword) {
            this.applySort();
            return;
        }
        const lower = keyword.toLowerCase();
        this.displayList = this.staffList.filter(s => 
            (s.name && s.name.toLowerCase().includes(lower)) ||
            (s.staffId && s.staffId.toLowerCase().includes(lower))
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
        document.getElementById('edit-staffId').value = user.staffId || '';
        document.getElementById('edit-name').value = user.name || '';
        document.getElementById('edit-email').value = user.email || '';
        document.getElementById('edit-title').value = user.title || 'N0';
        document.getElementById('edit-level').value = user.level || 'N0';
        
        document.getElementById('edit-is-manager').checked = (user.role === 'unit_manager');
        document.getElementById('edit-is-scheduler').checked = (user.role === 'unit_scheduler');

        const cons = user.constraints || {};
        document.getElementById('edit-isPregnant').checked = !!cons.isPregnant;
        document.getElementById('edit-isPostpartum').checked = !!cons.isPostpartum;
        document.getElementById('edit-canBatch').checked = !!cons.canBatch;
        document.getElementById('edit-maxConsecutive').value = cons.maxConsecutive || 6;
        document.getElementById('edit-maxConsecutiveNights').value = cons.maxConsecutiveNights || 4;

        this.editModal.show();
    }

    async saveEdit() {
        const uid = document.getElementById('edit-uid').value;
        const btn = document.getElementById('btn-save');
        
        const data = {
            name: document.getElementById('edit-name').value,
            staffId: document.getElementById('edit-staffId').value,
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
            if(uid) {
                await userService.updateUser(uid, data);
                alert("✅ 修改成功");
            } else {
                const email = document.getElementById('edit-email').value;
                const res = await userService.createStaff({ ...data, email }, "123456");
                if(res.success) alert("✅ 新增成功");
                else alert("新增失敗: " + res.error);
            }
            this.editModal.hide();
            this.loadData();
        } catch(e) {
            alert("錯誤: " + e.message);
        } finally {
            btn.disabled = false;
        }
    }
    
    async deleteStaff(uid) {
        if(confirm("確定刪除此人員？")) {
            try {
                await userService.deleteStaff(uid);
                alert("已刪除");
                this.loadData();
            } catch(e) { alert("刪除失敗"); }
        }
    }
}
