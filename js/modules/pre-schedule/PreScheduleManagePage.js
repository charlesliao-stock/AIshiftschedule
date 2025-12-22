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
        
        // 權限與模擬邏輯
        if (user.isImpersonating) {
            if (user.unitId) {
                const u = await UnitService.getUnitById(user.unitId);
                if(u) units = [u];
            }
            this.unitSelect.disabled = true; // 鎖定
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

        // 🔴 關鍵修正：確保選單值正確，並強制觸發載入
        this.targetUnitId = units[0].unitId;
        this.unitSelect.value = this.targetUnitId;
        
        // 綁定切換
        this.unitSelect.addEventListener('change', (e) => {
            this.targetUnitId = e.target.value;
            this.loadList(this.targetUnitId);
        });

        // 立即載入
        await this.loadList(this.targetUnitId);
    }
    
    // 補上之前省略的 loadList，確保它能運作
    async loadList(unitId) {
        console.log("Loading pre-schedule list for unit:", unitId);
        // 這裡需要呼叫 Service 取得列表並渲染，因您之前未提供此 Template 的完整渲染邏輯
        // 假設 Template 有提供 renderListRows (若無請根據實際情況調整)
        // 這裡示範基本邏輯：
        try {
            const list = await PreScheduleService.getPreSchedulesList(unitId);
            // 假設您有一個容器 id="pre-schedule-list-tbody" 在 Template 中
            // 如果您的 Template 結構不同，請調整這裡
            /* const tbody = document.getElementById('pre-schedule-list-tbody');
            if(tbody) {
                tbody.innerHTML = list.map(item => `<tr><td>...</td></tr>`).join('');
            }
            */
        } catch(e) {
            console.error("Load list error:", e);
        }
    }
}
