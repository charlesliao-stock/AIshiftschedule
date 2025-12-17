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
        return DashboardTemplate.renderAdmin();
    }

    async afterRender() {
        this.loadStats();
        this.initImpersonationConsole();
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

    // [修正重點] 調整篩選邏輯
    renderTargetUsers(roleFilter) {
        const targetSelect = document.getElementById('admin-target-user');
        const btnSwitch = document.getElementById('btn-start-impersonate');
        
        let filteredStaff = [];
        
        if (roleFilter) {
            if (roleFilter === 'nurse') {
                // 選擇 "一般人員" 時，包含 nurse 和 unit_scheduler，排除管理職
                filteredStaff = this.staffCache.filter(s => 
                    s.role === 'nurse' || s.role === 'unit_scheduler' || !s.role
                );
            } else {
                // 其他角色 (unit_manager 等) 則精確篩選
                filteredStaff = this.staffCache.filter(s => s.role === roleFilter);
            }
        }

        if (filteredStaff.length === 0) {
            targetSelect.innerHTML = `<option value="">無符合條件的人員</option>`;
            targetSelect.disabled = true;
        } else {
            targetSelect.innerHTML = `<option value="">請選擇人員 (${filteredStaff.length}人)</option>` + 
                filteredStaff.map(s => {
                    // 在選單中顯示具體身分，方便辨識
                    const roleLabel = s.role === 'unit_scheduler' ? '排班者' : '護理師';
                    return `<option value="${s.uid}">${s.name} (${roleLabel})</option>`;
                }).join('');
            targetSelect.disabled = false;
        }
        
        btnSwitch.disabled = true;
    }

    getRoleName(role) {
        const map = {
            'unit_manager': '單位主管',
            'unit_scheduler': '排班者',
            'nurse': '一般人員',
            'system_admin': '管理員'
        };
        return map[role] || '人員';
    }
}
