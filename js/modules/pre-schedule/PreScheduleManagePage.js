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
        
        // 顯示選單容器
        const container = document.getElementById('unit-selector-container');
        if(container) container.style.display = 'block';

        // 🔴 關鍵修正：明確設定目標 ID 並同步
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

        // 🚀 強制觸發載入
        console.log("🚀 PreScheduleManagePage 強制載入:", this.targetUnitId);
        await this.loadList(this.targetUnitId);
    }
    
    async loadList(unitId) {
        if(!unitId) return;
        
        // 載入該單位的預班列表
        try {
            // 這裡呼叫 Service 取得資料
            const list = await PreScheduleService.getPreSchedulesList(unitId);
            console.log("✅ 預班資料讀取成功:", list);
            
            // 假設 Template 裡有列表容器 id="pre-schedule-list-tbody"
            // 如果您的 Template 使用了不同的渲染方法，請在這裡呼叫
            // 例如：PreScheduleManageTemplate.renderList(list) 
            
            // 這裡提供一個基本的渲染範例，確保您能看到資料
            const tbody = document.querySelector('tbody'); 
            if(tbody) {
                if(list.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted p-4">尚無預班資料，請點擊「開啟新預班」</td></tr>';
                } else {
                    tbody.innerHTML = list.map(item => `
                        <tr>
                            <td class="fw-bold">${item.year}-${String(item.month).padStart(2,'0')}</td>
                            <td>${item.status === 'open' ? '<span class="badge bg-success">進行中</span>' : '<span class="badge bg-secondary">已截止</span>'}</td>
                            <td>${item.staffIds ? item.staffIds.length : 0} 人</td>
                            <td>${item.submissions ? Object.keys(item.submissions).length : 0} 人</td>
                            <td>
                                <button class="btn btn-sm btn-primary" onclick="window.location.hash='/pre-schedule/edit?id=${item.id}'">管理</button>
                            </td>
                        </tr>
                    `).join('');
                }
            }

        } catch(e) {
            console.error("Load list error:", e);
        }
    }
}
