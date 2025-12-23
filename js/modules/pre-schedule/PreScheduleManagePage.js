import { PreScheduleService } from "../../services/firebase/PreScheduleService.js";
import { UnitService } from "../../services/firebase/UnitService.js";
import { authService } from "../../services/firebase/AuthService.js";
import { PreScheduleManageTemplate } from "./templates/PreScheduleManageTemplate.js";

export class PreScheduleManagePage {
    constructor() {
        this.targetUnitId = null;
        this.unitSelect = null;
        this.createModal = null;
    }

    async render() {
        const today = new Date();
        return PreScheduleManageTemplate.renderLayout(today.getFullYear(), today.getMonth() + 1);
    }

    async afterRender() {
        window.routerPage = this; // 綁定給 HTML onclick 使用
        this.unitSelect = document.getElementById('unit-selector');
        
        // 初始化 Modal
        const modalEl = document.getElementById('create-pre-modal');
        if(modalEl) this.createModal = new bootstrap.Modal(modalEl);

        if(!this.unitSelect) return; 

        let retries = 0;
        while (!authService.getProfile() && retries < 10) { await new Promise(r => setTimeout(r, 200)); retries++; }
        const user = authService.getProfile();
        
        let units = [];
        
        // 權限與鎖定邏輯
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

        // 明確設定目標 ID 並同步
        if (user.isImpersonating) {
            this.targetUnitId = user.unitId;
        } else {
            this.targetUnitId = units[0].unitId;
        }

        // 設定 UI 值
        this.unitSelect.value = this.targetUnitId;
        
        // 綁定事件
        this.unitSelect.addEventListener('change', (e) => {
            this.targetUnitId = e.target.value;
            this.loadList(this.targetUnitId);
        });

        // 強制觸發載入
        console.log("🚀 PreScheduleManagePage 強制載入:", this.targetUnitId);
        await this.loadList(this.targetUnitId);
    }
    
    // 供 HTML onchange 呼叫
    handleUnitChange(val) {
        this.targetUnitId = val;
        this.loadList(val);
    }

    async loadList(unitId) {
        if(!unitId) return;
        const tbody = document.getElementById('pre-schedule-list-tbody');
        if(tbody) tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>';

        try {
            const list = await PreScheduleService.getPreSchedulesList(unitId);
            console.log("✅ 預班資料:", list);
            
            // 🔴 關鍵修正：呼叫 Template.renderList
            if (tbody) {
                tbody.innerHTML = PreScheduleManageTemplate.renderList(list);
            }
        } catch(e) {
            console.error("Load list error:", e);
            if(tbody) tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger">載入失敗: ${e.message}</td></tr>`;
        }
    }

    // 開啟 Modal
    openCreateModal() {
        if(this.createModal) this.createModal.show();
    }

    // 建立新預班
    async createPreSchedule() {
        const val = document.getElementById('new-pre-month').value; // YYYY-MM
        const closeDate = document.getElementById('new-pre-close').value;
        
        if(!val || !closeDate) { alert('請填寫完整'); return; }
        
        const [y, m] = val.split('-');
        
        // 這裡需要根據您的 PreScheduleService.createPreSchedule 實作來傳遞參數
        // 這裡做一個簡單示範
        alert(`功能開發中：開啟 ${y}年${m}月 預班，截止日 ${closeDate}`);
        // await PreScheduleService.createPreSchedule(...)
        if(this.createModal) this.createModal.hide();
    }
}
