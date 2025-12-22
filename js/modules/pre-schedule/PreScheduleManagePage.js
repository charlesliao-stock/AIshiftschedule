import { PreScheduleService } from "../../services/firebase/PreScheduleService.js";
import { UnitService } from "../../services/firebase/UnitService.js";
import { authService } from "../../services/firebase/AuthService.js";
import { PreScheduleManageTemplate } from "./templates/PreScheduleManageTemplate.js";

export class PreScheduleManagePage {
    constructor() {
        this.targetUnitId = null;
        this.unitSelect = null;
    }

    async render() {
        const today = new Date();
        return PreScheduleManageTemplate.renderLayout(today.getFullYear(), today.getMonth() + 1);
    }

    async afterRender() {
        this.unitSelect = document.getElementById('unit-selector');
        if(!this.unitSelect) return; 

        let retries = 0;
        while (!authService.getProfile() && retries < 10) { await new Promise(r => setTimeout(r, 200)); retries++; }
        const user = authService.getProfile();
        
        let units = [];
        
        // --- 關鍵修改：模擬鎖定 ---
        if (user.isImpersonating) {
            if (user.unitId) {
                const u = await UnitService.getUnitById(user.unitId);
                if(u) units = [u];
            }
            this.unitSelect.disabled = true;
        }
        else if (user.role === 'system_admin') {
            units = await UnitService.getAllUnits();
            this.unitSelect.disabled = false;
        } 
        else {
            units = await UnitService.getUnitsByManager(user.uid);
            if(units.length === 0 && user.unitId) {
                 const u = await UnitService.getUnitById(user.unitId);
                 if(u) units.push(u);
            }
            this.unitSelect.disabled = units.length <= 1;
        }
        
        if (units.length === 0) {
            this.unitSelect.innerHTML = '<option value="">無權限</option>';
            return;
        }

        this.unitSelect.innerHTML = units.map(u => `<option value="${u.unitId}">${u.unitName}</option>`).join('');
        document.getElementById('unit-selector-container').style.display = 'block';

        this.targetUnitId = units[0].unitId;
        this.unitSelect.value = this.targetUnitId;
        
        this.unitSelect.addEventListener('change', (e) => {
            this.targetUnitId = e.target.value;
            this.loadList(this.targetUnitId);
        });

        this.loadList(this.targetUnitId);
    }
    
    async loadList(unitId) {
        // 載入該單位的預班列表 (邏輯省略，維持原樣)
        console.log("Loading pre-schedule list for unit:", unitId);
    }
}
