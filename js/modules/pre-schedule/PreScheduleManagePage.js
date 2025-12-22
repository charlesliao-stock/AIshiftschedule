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
        // 若 Template 中 ID 不同，請自行調整 (這裡假設是 unit-selector)
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
        
        // 顯示選單容器 (依您的 Template ID 調整)
        const container = document.getElementById('unit-selector-container');
        if(container) container.style.display = 'block';

        // 🔴【關鍵修正】明確設定目標 ID
        // 如果正在模擬，直接取 user.unitId，否則取選單第一個
        if (user.isImpersonating) {
            this.targetUnitId = user.unitId;
        } else {
            this.targetUnitId = units[0].unitId;
        }

        // 同步 UI
        this.unitSelect.value = this.targetUnitId;
        
        // 綁定事件
        this.unitSelect.addEventListener('change', (e) => {
            this.targetUnitId = e.target.value;
            this.loadList(this.targetUnitId);
        });

        // 立即載入
        console.log("🚀 載入預班列表, UnitID:", this.targetUnitId);
        await this.loadList(this.targetUnitId);
    }
    
    async loadList(unitId) {
        if(!unitId) return;
        
        // 假設 Template 裡有列表容器
        // 因不確定您的 Template 結構，這裡做一個通用處理
        // 您可能需要根據 PreScheduleManageTemplate.js 來調整 renderList 的位置
        try {
            // 這裡呼叫 Service 取得資料
            const list = await PreScheduleService.getPreSchedulesList(unitId);
            
            // 呼叫 Template 的渲染方法 (如果有的話)
            // document.getElementById('schedule-list-container').innerHTML = PreScheduleManageTemplate.renderList(list);
            
            // 或是暫時用 console 確認資料已抓到
            console.log("✅ 預班資料讀取成功:", list);
            
            // 如果介面沒出來，請確認 Template 是否有 renderList 方法，或是手動渲染 DOM
            // 範例手動渲染：
            /*
            const tbody = document.querySelector('tbody'); 
            if(tbody) tbody.innerHTML = list.map(item => `<tr><td>${item.year}-${item.month}</td><td>${item.status}</td></tr>`).join('');
            */

        } catch(e) {
            console.error("Load list error:", e);
        }
    }
}
