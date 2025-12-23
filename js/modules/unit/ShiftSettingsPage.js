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
        
        // 🔴 修正：加入模擬狀態鎖定
        if (user.isImpersonating) {
            if (user.unitId) {
                const u = await UnitService.getUnitById(user.unitId);
                if(u) availableUnits = [u];
            }
            unitSelect.disabled = true; // 鎖定!
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
            
            // 預設選取
            if (user.isImpersonating) {
                this.targetUnitId = user.unitId;
            } else {
                this.targetUnitId = availableUnits[0].unitId;
            }
            
            unitSelect.value = this.targetUnitId;
            this.loadData(this.targetUnitId);
        }

        unitSelect.addEventListener('change', (e) => {
            this.targetUnitId = e.target.value;
            this.loadData(this.targetUnitId);
        });

        document.getElementById('btn-add').addEventListener('click', () => this.openModal());
        document.getElementById('btn-save').addEventListener('click', () => this.saveShift());
    }

    async loadData(unitId) {
        if(!unitId) return;
        const unit = await UnitService.getUnitById(unitId);
        this.shifts = unit?.settings?.shifts || [];
        document.getElementById('table-body').innerHTML = ShiftSettingsTemplate.renderRows(this.shifts);
    }
    
    openModal(idx = -1) {
        document.getElementById('edit-idx').value = idx;
        if (idx >= 0) {
            const s = this.shifts[idx];
            document.getElementById('shift-code').value = s.code;
            document.getElementById('shift-name').value = s.name;
            document.getElementById('shift-color').value = s.color;
            document.getElementById('start-time').value = s.startTime;
            document.getElementById('end-time').value = s.endTime;
            document.getElementById('shift-hours').value = s.hours || 8;
        } else {
            document.getElementById('shift-code').value = '';
            document.getElementById('shift-name').value = '';
            document.getElementById('shift-color').value = '#3b82f6';
            document.getElementById('start-time').value = '08:00';
            document.getElementById('end-time').value = '16:00';
            document.getElementById('shift-hours').value = 8;
        }
        this.modal.show();
    }

    async saveShift() {
        const idx = parseInt(document.getElementById('edit-idx').value);
        const hoursInput = document.getElementById('shift-hours').value;
        const hours = (hoursInput === '0' || hoursInput === 0) ? 0 : (parseFloat(hoursInput) || 0);

        const data = { 
            code: document.getElementById('shift-code').value, 
            name: document.getElementById('shift-name').value, 
            color: document.getElementById('shift-color').value, 
            startTime: document.getElementById('start-time').value, 
            endTime: document.getElementById('end-time').value,
            hours: hours
        };
        if(idx === -1) this.shifts.push(data); else this.shifts[idx] = data;
        
        await UnitService.updateUnit(this.targetUnitId, { "settings.shifts": this.shifts });
        this.modal.hide(); 
        document.getElementById('table-body').innerHTML = ShiftSettingsTemplate.renderRows(this.shifts);
    }
    
    async deleteShift(idx) { 
        if(confirm('刪除？')) { 
            this.shifts.splice(idx, 1); 
            await UnitService.updateUnit(this.targetUnitId, { "settings.shifts": this.shifts }); 
            document.getElementById('table-body').innerHTML = ShiftSettingsTemplate.renderRows(this.shifts);
        } 
    }
}
