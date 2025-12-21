import { UnitService } from "../../services/firebase/UnitService.js";
import { userService } from "../../services/firebase/UserService.js";
import { authService } from "../../services/firebase/AuthService.js";
import { DashboardTemplate } from "./templates/DashboardTemplate.js";

export class SystemAdminDashboard {
    constructor(user) { 
        this.user = user; 
        this.staffCache = []; 
    }

    render() {
        const isImpersonating = !!authService.getProfile()?.isImpersonating;
        return DashboardTemplate.renderAdmin(isImpersonating);
    }

    async afterRender() {
        this.loadStats();
        this.initImpersonationConsole();
        
        // 綁定退出按鈕
        const exitBtn = document.getElementById('btn-exit-impersonate');
        if(exitBtn) {
            exitBtn.addEventListener('click', () => authService.stopImpersonation());
        }
    }

    async loadStats() {
        try {
            const units = await UnitService.getAllUnits();
            document.getElementById('total-units').textContent = units.length;
            const staffCount = await userService.getAllStaffCount();
            document.getElementById('total-staff').textContent = staffCount;
        } catch (error) { console.error("Stats Error:", error); }
    }

    async initImpersonationConsole() {
        const unitSelect = document.getElementById('admin-unit-select');
        const roleFilter = document.getElementById('admin-role-filter');
        const targetSelect = document.getElementById('admin-target-user');
        const btnSwitch = document.getElementById('btn-start-impersonate');

        // A. 載入單位
        try {
            const units = await UnitService.getAllUnits();
            unitSelect.innerHTML = `<option value="">請選擇單位</option>` + 
                units.map(u => `<option value="${u.unitId}">${u.unitName}</option>`).join('');
        } catch(e) { console.error(e); }

        // B. 單位改變 -> 載入人員
        unitSelect.addEventListener('change', async () => {
            const unitId = unitSelect.value;
            roleFilter.disabled = true; roleFilter.value = "";
            targetSelect.disabled = true; targetSelect.innerHTML = '<option>請先篩選角色</option>';
            btnSwitch.disabled = true;

            if(!unitId) return;

            try {
                targetSelect.innerHTML = '<option>載入中...</option>';
                this.staffCache = await userService.getUnitStaff(unitId);
                
                // 啟用篩選
                targetSelect.innerHTML = '<option value="">請先篩選角色</option>';
                roleFilter.disabled = false;
            } catch(e) { console.error(e); }
        });

        // C. 角色篩選改變
        roleFilter.addEventListener('change', () => {
            const role = roleFilter.value;
            this.renderTargetUsers(role);
        });

        // D. 目標選擇改變
        targetSelect.addEventListener('change', () => {
            btnSwitch.disabled = !targetSelect.value;
        });

        // E. 執行切換
        btnSwitch.addEventListener('click', async () => {
            const targetUid = targetSelect.value;
            if(!targetUid) return;

            const targetUser = this.staffCache.find(s => s.uid === targetUid);
            if(targetUser) {
                const roleName = this.getRoleName(targetUser.role);
                if(confirm(`確定要切換身分為：${targetUser.name} (${roleName}) 嗎？`)) {
                    authService.impersonate(targetUser);
                }
            }
        });
    }

    // [修正重點] 調整篩選邏輯：支援多職類
    renderTargetUsers(roleFilter) {
        const targetSelect = document.getElementById('admin-target-user');
        const btnSwitch = document.getElementById('btn-start-impersonate');
        
        let filteredStaff = [];
        
        if (roleFilter) {
            if (roleFilter === 'general_staff') {
                // ✅ 關鍵修改：負面表列
                // 只要不是「系統管理員」、「單位主管」、「排班者」，通通算是一般人員
                // 這樣包含：nurse, pharmacist, dietitian, null, undefined...
                const adminRoles = ['system_admin', 'unit_manager', 'unit_scheduler'];
                
                filteredStaff = this.staffCache.filter(s => {
                    // 若有 role，檢查是否為管理職
                    if (s.role && adminRoles.includes(s.role)) return false;
                    // 若同時也是排班者(兼任)，在選擇「一般人員」時是否要顯示？
                    // 為了方便切換，建議排班者可以在「排班者」選項找到，這裡只顯示純一般人員
                    // 但若要包含「兼任排班的一般人員」，則邏輯需調整。
                    // 目前邏輯：嚴格區分。若他是 Scheduler，請選 Scheduler 分類。
                    return true;
                });
            } else {
                // 其他角色 (unit_manager, unit_scheduler) 則精確篩選
                filteredStaff = this.staffCache.filter(s => s.role === roleFilter);
            }
        }

        if (filteredStaff.length === 0) {
            targetSelect.innerHTML = `<option value="">無符合條件的人員</option>`;
            targetSelect.disabled = true;
        } else {
            targetSelect.innerHTML = `<option value="">請選擇人員 (${filteredStaff.length}人)</option>` + 
                filteredStaff.map(s => {
                    // 顯示具體身分 (若 role 有特殊值如 pharmacist，可在此顯示)
                    let roleDisplay = this.getRoleName(s.role);
                    // 如果有 jobTitle 欄位 (未來擴充)，優先顯示
                    if (s.jobTitle) roleDisplay = s.jobTitle;
                    
                    return `<option value="${s.uid}">${s.name} (${roleDisplay})</option>`;
                }).join('');
            targetSelect.disabled = false;
        }
        
        btnSwitch.disabled = true;
    }

    getRoleName(role) {
        if (!role) return '一般人員';
        
        const map = {
            'unit_manager': '單位主管',
            'unit_scheduler': '排班者',
            'system_admin': '系統管理員',
            'nurse': '護理師',
            'pharmacist': '藥師',
            'dietitian': '營養師',
            'therapist': '復健師'
        };
        // 若找不到對應，直接顯示代碼或預設文字
        return map[role] || '一般人員';
    }
}
