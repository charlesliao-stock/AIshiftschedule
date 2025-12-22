import { UnitService } from "../../services/firebase/UnitService.js";
import { userService } from "../../services/firebase/UserService.js";
import { authService } from "../../services/firebase/AuthService.js";
import { GroupSettingsTemplate } from "./templates/GroupSettingsTemplate.js"; 

export class GroupSettingsPage {
    constructor() { 
        this.groups = []; 
        this.staffList = []; 
        this.targetUnitId = null; 
        this.modal = null; 
    }

    async render() {
        return GroupSettingsTemplate.renderLayout() + GroupSettingsTemplate.renderModal();
    }

    async afterRender() {
        this.modal = new bootstrap.Modal(document.getElementById('group-modal'));
        const unitSelect = document.getElementById('unit-select');
        window.routerPage = this; 
        
        const user = authService.getProfile();
        
        let units = [];
        
        // 🔴 新增：模擬狀態判斷與鎖定
        if (user.isImpersonating) {
            if (user.unitId) {
                const u = await UnitService.getUnitById(user.unitId);
                if(u) units = [u];
            }
            unitSelect.disabled = true; // 鎖定
        }
        else if (user.role === 'system_admin') {
            units = await UnitService.getAllUnits();
            unitSelect.disabled = false;
        } else {
            units = await UnitService.getUnitsByManager(user.uid);
            if(units.length === 0 && user.unitId) {
                const u = await UnitService.getUnitById(user.unitId);
                if(u) units.push(u);
            }
            unitSelect.disabled = units.length <= 1;
        }

        if (units.length === 0) { 
            unitSelect.innerHTML = '<option value="">無權限</option>'; unitSelect.disabled = true; 
        } else {
            unitSelect.innerHTML = units.map(u => `<option value="${u.unitId}">${u.unitName}</option>`).join('');
            
            // 預設選取並載入
            this.targetUnitId = units[0].unitId;
            unitSelect.value = this.targetUnitId;
            this.loadData(this.targetUnitId);
        }

        unitSelect.addEventListener('change', (e) => {
            this.targetUnitId = e.target.value;
            this.loadData(this.targetUnitId);
        });

        // 綁定其他按鈕 (維持原樣)
        document.getElementById('btn-add').addEventListener('click', () => {
            document.getElementById('new-group-name').value = '';
            this.modal.show();
        });
        document.getElementById('btn-save-group').addEventListener('click', () => this.addGroup());
    }

    // loadData, addGroup, deleteGroup, saveAssignments 維持原樣...
    async loadData(unitId) {
        try {
            const unit = await UnitService.getUnitById(unitId);
            this.groups = unit?.groups || [];
            this.staffList = await userService.getUsersByUnit(unitId);
            this.staffList.sort((a,b) => (a.staffId || '').localeCompare(b.staffId || ''));
            
            document.getElementById('group-list').innerHTML = GroupSettingsTemplate.renderGroupList(this.groups);
            document.getElementById('staff-tbody').innerHTML = GroupSettingsTemplate.renderStaffRows(this.staffList, this.groups);
            
            // 綁定下拉選單變更
            document.querySelectorAll('.group-select').forEach(sel => {
                sel.addEventListener('change', () => this.saveAssignments());
            });
        } catch (e) { console.error(e); }
    }
    
    async addGroup() { /* ... */ }
    async deleteGroup(idx) { /* ... */ }
    async saveAssignments() { /* ... */ }
}
