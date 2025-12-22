import { UnitService } from "../../services/firebase/UnitService.js";
import { ScheduleService } from "../../services/firebase/ScheduleService.js";
import { PreScheduleService } from "../../services/firebase/PreScheduleService.js";
import { authService } from "../../services/firebase/AuthService.js";

export class ScheduleListPage {
    constructor() { 
        this.targetUnitId = null; 
        this.unitSelect = null;
    }

    async render() {
        return `
            <div class="container-fluid mt-4">
                <div class="mb-3"><h3>排班作業</h3></div>
                
                <div class="card shadow-sm mb-3 border-left-primary">
                    <div class="card-body py-2 d-flex align-items-center gap-2">
                        <label class="fw-bold text-nowrap"><i class="fas fa-hospital-user me-1"></i>選擇單位：</label>
                        <select id="schedule-unit-select" class="form-select w-auto fw-bold text-primary">
                            <option value="">載入中...</option>
                        </select>
                    </div>
                </div>

                <div class="card shadow">
                    <div class="card-header py-3 bg-white text-primary fw-bold">待排班月份清單</div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead class="table-light">
                                    <tr>
                                        <th>月份</th>
                                        <th>預班狀態</th>
                                        <th>正式班表</th>
                                        <th>審核</th>
                                        <th>操作</th>
                                    </tr>
                                </thead>
                                <tbody id="schedule-list-tbody">
                                    <tr><td colspan="5" class="text-center p-4">請選擇單位以載入資料</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async afterRender() {
        this.unitSelect = document.getElementById('schedule-unit-select');
        
        let retries = 0;
        while (!authService.getProfile() && retries < 10) { await new Promise(r => setTimeout(r, 200)); retries++; }
        const user = authService.getProfile();
        
        if (!user) {
            this.unitSelect.innerHTML = '<option>未登入</option>';
            return;
        }

        let units = [];
        
        // --- 關鍵修改：模擬狀態鎖定邏輯 ---
        if (user.isImpersonating) {
            if (user.unitId) {
                const u = await UnitService.getUnitById(user.unitId);
                if (u) units = [u];
            }
            this.unitSelect.disabled = true; // 鎖定
        } 
        else if (user.role === 'system_admin') {
            units = await UnitService.getAllUnits();
            this.unitSelect.disabled = false;
        } 
        else {
            units = await UnitService.getUnitsByManager(user.uid);
            if (units.length === 0 && user.unitId) {
                const u = await UnitService.getUnitById(user.unitId);
                if(u) units.push(u);
            }
            this.unitSelect.disabled = units.length <= 1;
        }

        if (units.length === 0) {
            this.unitSelect.innerHTML = '<option value="">無權限或無單位</option>';
            return;
        }

        this.unitSelect.innerHTML = units.map(u => 
            `<option value="${u.unitId}">${u.unitName} (${u.unitCode})</option>`
        ).join('');

        this.unitSelect.addEventListener('change', () => this.loadSchedules(this.unitSelect.value));

        if (units.length > 0) {
            this.unitSelect.value = units[0].unitId;
            this.loadSchedules(units[0].unitId);
        }
    }

    async loadSchedules(unitId) {
        this.targetUnitId = unitId;
        const tbody = document.getElementById('schedule-list-tbody');
        tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4"><div class="spinner-border text-primary"></div></td></tr>';

        try {
            const today = new Date();
            const year = today.getFullYear();
            const month = today.getMonth() + 1;
            
            const months = [];
            for(let i=0; i<3; i++) {
                let y = year, m = month + i;
                if(m > 12) { m -= 12; y++; }
                months.push({ year: y, month: m });
            }

            const rows = await Promise.all(months.map(async (pre) => {
                const [preData, schedule] = await Promise.all([
                    PreScheduleService.getPreSchedule(unitId, pre.year, pre.month),
                    ScheduleService.getSchedule(unitId, pre.year, pre.month)
                ]);

                let preStatus = '<span class="badge bg-secondary">未開啟</span>';
                if (preData) {
                    if (preData.status === 'open') preStatus = '<span class="badge bg-success">進行中</span>';
                    else if (preData.status === 'closed') preStatus = '<span class="badge bg-dark">已截止</span>';
                }

                let schStatus = '<span class="badge bg-secondary">未建立</span>';
                let approvedStatus = (schedule && schedule.isApproved) ? 
                    '<i class="fas fa-check-circle text-success"></i>' : '<span class="text-muted">-</span>';
                
                let btnClass = 'btn-outline-primary';
                let btnText = '開始排班';
                
                if (schedule) {
                    if (schedule.status === 'published') {
                        schStatus = '<span class="badge bg-success">已發布</span>';
                        btnClass = 'btn-primary';
                        btnText = '檢視';
                    } else {
                        schStatus = '<span class="badge bg-warning text-dark">草稿</span>';
                        btnClass = 'btn-primary';
                        btnText = '繼續排班';
                    }
                }

                return `
                    <tr>
                        <td class="fw-bold">${pre.year}-${String(pre.month).padStart(2,'0')}</td>
                        <td>${preStatus}</td>
                        <td>${schStatus}</td>
                        <td>${approvedStatus}</td>
                        <td>
                            <button class="btn btn-sm ${btnClass}" 
                                onclick="window.location.hash='/schedule/edit?unitId=${unitId}&year=${pre.year}&month=${pre.month}'">
                                ${btnText}
                            </button>
                        </td>
                    </tr>
                `;
            }));

            tbody.innerHTML = rows.join('');
        } catch (error) {
            console.error(error);
            tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-danger">載入失敗</td></tr>';
        }
    }
}
