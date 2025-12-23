import { UnitService } from "../../services/firebase/UnitService.js";
import { userService } from "../../services/firebase/UserService.js"; 
import { UnitListTemplate } from "./templates/UnitListTemplate.js"; 

export class UnitListPage {
    constructor() {
        this.units = [];
        this.displayList = [];
        this.modal = null;
        this.unitStaffList = []; 
        this.selectedManagers = new Set();
        this.selectedSchedulers = new Set();
        this.sortConfig = { key: 'unitCode', direction: 'asc' };
    }

    async render() {
        return UnitListTemplate.renderLayout() + UnitListTemplate.renderModalHtml();
    }

    async afterRender() {
        const modalEl = document.getElementById('unit-modal');
        if(!modalEl) return;

        this.modal = new bootstrap.Modal(modalEl);
        window.routerPage = this;
        
        document.getElementById('btn-add-unit').addEventListener('click', () => this.openModal());
        document.getElementById('btn-save').addEventListener('click', () => this.saveUnit());
        document.getElementById('unit-search').addEventListener('input', (e) => this.filterData(e.target.value));
        
        await this.loadUnits();
    }

    async loadUnits() {
        this.units = await UnitService.getAllUnits();
        this.applySortAndFilter();
    }

    openModal(id = null) {
        const title = document.getElementById('modal-title');
        const codeInput = document.getElementById('unit-code');
        const nameInput = document.getElementById('unit-name');
        const descInput = document.getElementById('unit-desc');
        const idInput = document.getElementById('edit-id');
        const staffArea = document.getElementById('modal-staff-area');

        this.selectedManagers.clear();
        this.selectedSchedulers.clear();

        if (id) {
            // 編輯模式
            const unit = this.units.find(u => u.unitId === id);
            if (!unit) return;

            title.textContent = '編輯單位';
            // ✅ 純淨版: 讀取標準欄位
            idInput.value = unit.unitId;
            codeInput.value = unit.unitCode || '';
            nameInput.value = unit.unitName || '';
            descInput.value = unit.description || '';
            
            this.loadUnitStaff(unit.unitId, unit);
            staffArea.style.display = 'block';
        } else {
            // 新增模式
            title.textContent = '新增單位';
            idInput.value = '';
            codeInput.value = '';
            nameInput.value = '';
            descInput.value = '';
            staffArea.style.display = 'none'; 
        }
        this.modal.show();
    }

    async loadUnitStaff(unitId, unitData) {
        document.getElementById('list-managers').innerHTML = '載入中...';
        document.getElementById('list-schedulers').innerHTML = '載入中...';

        try {
            this.unitStaffList = await userService.getUsersByUnit(unitId);
            
            if(unitData.managers) unitData.managers.forEach(uid => this.selectedManagers.add(uid));
            if(unitData.schedulers) unitData.schedulers.forEach(uid => this.selectedSchedulers.add(uid));

            this.renderStaffCheckboxes('list-managers', this.selectedManagers);
            this.renderStaffCheckboxes('list-schedulers', this.selectedSchedulers);

        } catch(e) {
            console.error(e);
            document.getElementById('list-managers').innerHTML = '載入失敗';
        }
    }

    renderStaffCheckboxes(containerId, selectedSet) {
        const container = document.getElementById(containerId);
        if(this.unitStaffList.length === 0) {
            container.innerHTML = '<div class="text-muted small">此單位尚無人員</div>';
            return;
        }

        container.innerHTML = this.unitStaffList.map(u => {
            const isChecked = selectedSet.has(u.uid) ? 'checked' : '';
            // ✅ 純淨版: 讀取 staffName, staffCode
            return `
                <div class="form-check">
                    <input class="form-check-input staff-check" type="checkbox" 
                           data-uid="${u.uid}" data-set="${containerId}" ${isChecked}>
                    <label class="form-check-label small">
                        ${u.staffName} <span class="text-muted">(${u.staffCode})</span>
                    </label>
                </div>
            `;
        }).join('');

        container.querySelectorAll('.staff-check').forEach(chk => {
            chk.addEventListener('change', (e) => {
                const uid = e.target.dataset.uid;
                if(e.target.checked) selectedSet.add(uid);
                else selectedSet.delete(uid);
            });
        });
    }

    async saveUnit() {
        const id = document.getElementById('edit-id').value;
        const data = {
            unitCode: document.getElementById('unit-code').value.trim(),
            unitName: document.getElementById('unit-name').value.trim(),
            description: document.getElementById('unit-desc').value.trim(),
            managers: Array.from(this.selectedManagers),
            schedulers: Array.from(this.selectedSchedulers)
        };

        const btn = document.getElementById('btn-save');
        btn.disabled = true;

        try {
            let res;
            if (id) res = await UnitService.updateUnit(id, data);
            else res = await UnitService.createUnit(data);

            if (res.success) {
                alert("✅ 儲存成功");
                this.modal.hide();
                this.loadUnits();
            } else {
                alert("失敗: " + res.error);
            }
        } catch (e) { console.error(e); } 
        finally { btn.disabled = false; }
    }

    applySortAndFilter() {
        // ... (簡化，實際實作應包含排序與過濾)
        this.displayList = this.units; 
        document.getElementById('tbody').innerHTML = UnitListTemplate.renderRows(this.displayList);
    }
    
    handleSort(key) {} 
    filterData(val) {}
}
