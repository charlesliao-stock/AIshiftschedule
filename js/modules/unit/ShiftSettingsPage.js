import { UnitService } from "../../services/firebase/UnitService.js";
import { authService } from "../../services/firebase/AuthService.js";
import { ShiftSettingsTemplate } from "./templates/ShiftSettingsTemplate.js"; 

export class ShiftSettingsPage {
    constructor() { this.shifts = []; this.targetUnitId = null; this.modal = null; }

    async render() {
        return ShiftSettingsTemplate.renderLayout() + ShiftSettingsTemplate.renderModal();
    }

    async afterRender() {
        this.modal = new bootstrap.Modal(document.getElementById('shift-modal'));
        const unitSelect = document.getElementById('unit-select');
        window.routerPage = this;

        const user = authService.getProfile();
        
        let availableUnits = [];
        
        // 🔴 新增：模擬狀態判斷與鎖定
        if (user.isImpersonating) {
            if (user.unitId) {
                const u = await UnitService.getUnitById(user.unitId);
                if(u) availableUnits = [u];
            }
            unitSelect.disabled = true; // 鎖定
        }
        else if (user.role === 'system_admin') {
            availableUnits = await UnitService.getAllUnits();
            unitSelect.disabled = false;
        } else {
            availableUnits = await UnitService.getUnitsByManager(user.uid);
            if(availableUnits.length === 0 && user.unitId) {
                const u = await UnitService.getUnitById(user.unitId);
                if(u) availableUnits.push(u);
            }
            unitSelect.disabled = availableUnits.length <= 1;
        }

        if (availableUnits.length === 0) {
            unitSelect.innerHTML = '<option value="">無權限</option>';
            unitSelect.disabled = true;
        } else {
            unitSelect.innerHTML = availableUnits.map(u => `<option value="${u.unitId}">${u.unitName}</option>`).join('');
            
            // 預設選取第一個並載入
            this.targetUnitId = availableUnits[0].unitId;
            unitSelect.value = this.targetUnitId;
            this.loadData(this.targetUnitId);
        }

        unitSelect.addEventListener('change', (e) => {
            this.targetUnitId = e.target.value;
            this.loadData(this.targetUnitId);
        });

        // 綁定其他按鈕事件 (維持原樣)
        document.getElementById('btn-add').addEventListener('click', () => this.openModal());
        document.getElementById('btn-save').addEventListener('click', () => this.saveShift());
    }

    // loadData, openModal, saveShift, deleteShift 維持原樣...
    async loadData(unitId) {
        const unit = await UnitService.getUnitById(unitId);
        this.shifts = unit?.settings?.shifts || [];
        document.getElementById('table-body').innerHTML = ShiftSettingsTemplate.renderRows(this.shifts);
    }
    
    openModal(idx = -1) { /* ... */ }
    async saveShift() { /* ... */ }
    async deleteShift(idx) { /* ... */ }
}
