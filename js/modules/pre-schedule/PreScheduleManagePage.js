import { PreScheduleService } from "../../services/firebase/PreScheduleService.js";
import { UnitService } from "../../services/firebase/UnitService.js";
import { userService } from "../../services/firebase/UserService.js";
import { authService } from "../../services/firebase/AuthService.js";

export class PreScheduleManagePage {
    constructor() {
        this.targetUnitId = null;
        this.preSchedules = [];
        this.unitData = null;
        this.selectedStaff = [];
        this.modal = null;
        this.isEditMode = false;
        this.editingScheduleId = null;
        this.unitMap = {}; // ✅ 新增單位對照表
    }

    async render() {
        // ... (render 保持不變) ...
        const user = authService.getProfile();
        const isAdmin = user.role === 'system_admin' || user.originalRole === 'system_admin';
        
        let unitOptions = '<option value="">載入中...</option>';
        let unitSelectDisabled = '';

        try {
            let units = [];
            if (isAdmin) {
                units = await UnitService.getAllUnits();
                unitOptions = `<option value="" disabled selected>請選擇管理單位...</option>` + 
                              units.map(u => `<option value="${u.unitId}">${u.unitName}</option>`).join('');
            } else {
                units = await UnitService.getUnitsByManager(user.uid);
                if(units.length === 0 && user.unitId) {
                    const u = await UnitService.getUnitById(user.unitId);
                    if(u) units.push(u);
                }

                if (units.length > 0) {
                    unitOptions = units.map(u => `<option value="${u.unitId}">${u.unitName}</option>`).join('');
                } else {
                    unitOptions = '<option value="">無權限</option>';
                    unitSelectDisabled = 'disabled';
                }
            }
        } catch (e) { console.error(e); }

        return `
            <div class="container-fluid mt-4">
                <div class="mb-3">
                    <h3 class="text-gray-800 fw-bold"><i class="fas fa-calendar-check text-primary me-2"></i> 預班管理與審核</h3>
                    <p class="text-muted small mb-0">設定每月的預班開放時間、規則限制與參與人員。</p>
                </div>

                <div class="card shadow-sm mb-4 border-left-primary">
                    <div class="card-body py-2 d-flex align-items-center flex-wrap gap-2">
                        <label class="fw-bold mb-0 text-nowrap"><i class="fas fa-hospital-user me-1"></i>管理單位：</label>
                        <select id="unit-select" class="form-select w-auto fw-bold text-primary" ${unitSelectDisabled}>
                            ${unitOptions}
                        </select>
                        <div class="vr mx-2"></div>
                        <button id="btn-add" class="btn btn-primary w-auto text-nowrap" disabled>
                            <i class="fas fa-plus"></i> 新增預班表
                        </button>
                    </div>
                </div>

                <div class="card shadow">
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead class="table-light">
                                    <tr>
                                        <th>預班月份</th>
                                        <th>開放區間</th>
                                        <th>參與人數</th>
                                        <th>狀態</th>
                                        <th class="text-end pe-3">操作</th>
                                    </tr>
                                </thead>
                                <tbody id="table-body">
                                    <tr><td colspan="5" class="text-center py-5 text-muted">請先選擇單位</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="modal fade" id="pre-modal" tabindex="-1">
                    <div class="modal-dialog modal-xl">
                        <div class="modal-content">
                            <div class="modal-header bg-light">
                                <h5 class="modal-title fw-bold" id="modal-title">新增預班表</h5>
                                <button class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <form id="pre-form">
                                    <div class="d-flex justify-content-end align-items-center mb-3">
                                        <button type="button" class="btn btn-sm btn-outline-info" id="btn-import-last">
                                            <i class="fas fa-history"></i> 帶入上月設定
                                        </button>
                                    </div>
                                    <div class="row g-2 align-items-center mb-3 bg-light p-2 rounded">
                                        <div class="col-md-3"><label class="small fw-bold">預班月份</label><input type="month" id="edit-month" class="form-control form-control-sm" required></div>
                                        <div class="col-md-3"><label class="small fw-bold">開放日期 (起)</label><input type="date" id="edit-open" class="form-control form-control-sm" required></div>
                                        <div class="col-md-3"><label class="small fw-bold">截止日期 (迄)</label><input type="date" id="edit-close" class="form-control form-control-sm" required></div>
                                        <div class="col-md-3"><div class="form-check form-switch mt-4"><input class="form-check-input" type="checkbox" id="edit-showNames"><label class="form-check-label small fw-bold">顯示預班者姓名</label></div></div>
                                    </div>
                                    <h6 class="text-primary fw-bold border-bottom pb-1 mb-2"><i class="fas fa-sliders-h"></i> 限制參數</h6>
                                    <div class="row g-3 mb-3">
                                        <div class="col-md-3"><label class="small fw-bold">預班上限 (含假)</label><input type="number" id="edit-maxOff" class="form-control form-control-sm" value="8"></div>
                                        <div class="col-md-3"><label class="small fw-bold text-danger">假日上限</label><input type="number" id="edit-maxHoliday" class="form-control form-control-sm" value="2"></div>
                                        <div class="col-md-3"><label class="small fw-bold text-success">每日保留人數</label><input type="number" id="edit-reserved" class="form-control form-control-sm" value="0" min="0"></div>
                                    </div>
                                    <div class="row g-3 mb-3 bg-light p-2 rounded mx-0">
                                        <div class="col-md-6"><label class="small fw-bold text-primary">夜班種類數限制</label><select id="edit-shiftTypes" class="form-select form-select-sm" onchange="window.routerPage.handleTypeLimitChange(this.value)"><option value="2">2 種</option><option value="3">3 種</option></select></div>
                                        <div class="col-md-6 d-flex align-items-center" id="container-allow3"><div class="form-check form-switch mt-4"><input class="form-check-input" type="checkbox" id="edit-allow3"><label class="form-check-label fw-bold">同意同仁自願選擇 3 種班</label></div></div>
                                    </div>
                                    <h6 class="text-primary fw-bold border-bottom pb-1 mb-2"><i class="fas fa-users-cog"></i> 每日各班人力限制 (Min/Max)</h6>
                                    <div id="group-limits-container" class="mb-3"></div>
                                    <h6 class="text-primary fw-bold border-bottom pb-1 mb-2 d-flex justify-content-between align-items-center">
                                        <span><i class="fas fa-user-check"></i> 參與人員 (<span id="staff-count">0</span>)</span>
                                        <div class="input-group input-group-sm w-auto">
                                            <input type="text" id="staff-search" class="form-control" placeholder="搜尋跨單位支援人員...">
                                            <button type="button" class="btn btn-outline-secondary" id="btn-search-staff"><i class="fas fa-search"></i></button>
                                        </div>
                                    </h6>
                                    <div id="search-results-dropdown" class="list-group position-absolute w-50 shadow" style="z-index: 1060; display: none; right: 20px;"></div>
                                    <div class="table-responsive border rounded" style="max-height: 300px; overflow-y: auto;">
                                        <table class="table table-sm table-hover align-middle mb-0 text-center small">
                                            <thead class="table-light sticky-top">
                                                <tr>
                                                    <th class="text-start ps-3">姓名</th>
                                                    <th>職編</th>
                                                    <th>職級</th>
                                                    <th>屬性</th>
                                                    <th width="150">預班組別</th>
                                                    <th>操作</th>
                                                </tr>
                                            </thead>
                                            <tbody id="staff-list-tbody"></tbody>
                                        </table>
                                    </div>
                                </form>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary w-auto" data-bs-dismiss="modal">取消</button>
                                <button type="button" id="btn-save" class="btn btn-primary w-auto">儲存設定</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async afterRender() {
        this.modal = new bootstrap.Modal(document.getElementById('pre-modal'));
        const unitSelect = document.getElementById('unit-select');
        window.routerPage = this;

        // ✅ 初始化單位對照表
        const allUnits = await UnitService.getAllUnits();
        allUnits.forEach(u => this.unitMap[u.unitId] = u.unitName);

        unitSelect.addEventListener('change', () => this.loadList(unitSelect.value));
        document.getElementById('btn-add').addEventListener('click', () => this.openModal(null));
        document.getElementById('btn-save').addEventListener('click', () => this.savePreSchedule());
        document.getElementById('btn-search-staff').addEventListener('click', () => this.searchStaff());
        
        document.getElementById('staff-search').addEventListener('keypress', (e) => {
            if(e.key === 'Enter') { e.preventDefault(); this.searchStaff(); }
        });

        document.getElementById('btn-import-last').addEventListener('click', () => this.importLastMonthSettings());
        document.getElementById('edit-month').addEventListener('change', () => this.setDefaultDates());

        const user = authService.getProfile();
        const isAdmin = user.role === 'system_admin' || user.originalRole === 'system_admin';
        
        if (!isAdmin && unitSelect.value) {
            this.loadList(unitSelect.value);
        }
    }

    // ... (loadList, goToEdit, setDefaultDates, handleTypeLimitChange 保持不變) ...
    // 為節省篇幅省略，請保留原程式碼

    async openModal(index = null) {
        if (!this.targetUnitId) { alert("請先選擇單位"); return; }
        
        const form = document.getElementById('pre-form');
        if (form) form.reset();
        
        document.getElementById('search-results-dropdown').innerHTML = '';
        this.isEditMode = (index !== null);
        
        try {
            this.unitData = await UnitService.getUnitById(this.targetUnitId);
            if (!this.unitData) throw new Error("單位資料讀取失敗");
        } catch(e) { alert(e.message); return; }

        const groups = this.unitData.groups || [];

        if (this.isEditMode) {
            const data = this.preSchedules[index];
            this.editingScheduleId = data.id;
            document.getElementById('modal-title').textContent = "修改預班設定";
            document.getElementById('edit-month').value = `${data.year}-${String(data.month).padStart(2,'0')}`;
            document.getElementById('edit-month').disabled = true; 
            
            const s = data.settings || {};
            // ... (填入表單值) ...
            document.getElementById('edit-open').value = s.openDate || '';
            document.getElementById('edit-close').value = s.closeDate || '';
            document.getElementById('edit-maxOff').value = s.maxOffDays || 8;
            document.getElementById('edit-maxHoliday').value = s.maxHoliday || 2;
            document.getElementById('edit-reserved').value = s.reservedStaff || 0;
            document.getElementById('edit-showNames').checked = !!s.showOtherNames;
            
            const limit = s.shiftTypesLimit || '2';
            document.getElementById('edit-shiftTypes').value = limit;
            document.getElementById('edit-allow3').checked = !!s.allowThreeTypesVoluntary;
            this.handleTypeLimitChange(limit.toString());

            const savedStaffIds = data.staffIds || [];
            const savedSettings = data.staffSettings || {};
            const supportStaffIds = data.supportStaffIds || [];

            const promises = savedStaffIds.map(uid => userService.getUserData(uid));
            const users = await Promise.all(promises);

            // ✅ 修正：確保 unitId 被儲存，供 renderStaffList 使用
            this.selectedStaff = users.filter(u => u).map(s => ({
                uid: s.uid, name: s.name, rank: s.rank, staffId: s.staffId,
                unitId: s.unitId, // 關鍵
                tempGroup: savedSettings[s.uid]?.group || s.group || '',
                isSupport: supportStaffIds.includes(s.uid) || s.unitId !== this.targetUnitId
            }));
            
            this.renderGroupInputs(groups, s.groupLimits || {});

        } else {
            document.getElementById('modal-title').textContent = "新增預班表";
            document.getElementById('edit-month').disabled = false;
            // ... (日期初始化) ...
            const today = new Date();
            const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
            document.getElementById('edit-month').value = nextMonth.toISOString().slice(0, 7);
            
            this.setDefaultDates(); 
            this.renderGroupInputs(groups, {});
            this.handleTypeLimitChange('2');
            
            const staff = await userService.getUsersByUnit(this.targetUnitId);
            this.selectedStaff = staff.map(s => ({ 
                uid: s.uid, name: s.name, rank: s.rank, staffId: s.staffId, 
                unitId: s.unitId, // 關鍵
                tempGroup: s.group || '', isSupport: false
            }));
        }

        this.renderStaffList(groups);
        this.modal.show();
    }

    renderStaffList(groups) {
        const tbody = document.getElementById('staff-list-tbody');
        document.getElementById('staff-count').textContent = this.selectedStaff.length;
        const groupOpts = `<option value="">(無)</option>` + groups.map(g => `<option value="${g}">${g}</option>`).join('');

        tbody.innerHTML = this.selectedStaff.map((u, idx) => {
            // ✅ 修正：顯示原單位名稱
            const isSupport = u.unitId !== this.targetUnitId;
            const unitBadge = isSupport 
                ? `<span class="badge bg-warning text-dark" title="原單位: ${this.unitMap[u.unitId]||u.unitId}">支援</span>` 
                : `<span class="badge bg-light text-dark border">本單位</span>`;
            
            const nameDisplay = isSupport 
                ? `${u.name} <span class="text-muted small">(${this.unitMap[u.unitId] || '外'})</span>` 
                : u.name;

            return `
            <tr class="${isSupport ? 'table-warning' : ''}">
                <td class="text-start ps-3 fw-bold">${nameDisplay}</td>
                <td><small>${u.staffId || '-'}</small></td>
                <td><span class="badge bg-light text-dark border">${u.rank || '-'}</span></td>
                <td>${unitBadge}</td>
                <td>
                    <select class="form-select form-select-sm py-0 staff-group-select" 
                            onchange="window.routerPage.updateStaffGroup(${idx}, this.value)">
                        ${groupOpts.replace(`value="${u.tempGroup}"`, `value="${u.tempGroup}" selected`)}
                    </select>
                </td>
                <td>
                    <button type="button" class="btn btn-sm text-danger" onclick="window.routerPage.removeStaff(${idx})">
                        <i class="fas fa-times"></i>
                    </button>
                </td>
            </tr>
        `}).join('');
    }

    // ... (updateStaffGroup, removeStaff, renderGroupInputs 保持不變) ...
    updateStaffGroup(idx, val) { this.selectedStaff[idx].tempGroup = val; }
    removeStaff(idx) { this.selectedStaff.splice(idx, 1); this.renderStaffList(this.unitData.groups || []); }
    renderGroupInputs(groups, values={}) { /*...原代碼...*/ const container = document.getElementById('group-limits-container'); if(groups.length===0){container.innerHTML='<div class="text-muted small">無組別</div>';return;} container.innerHTML=`<div class="table-responsive"><table class="table table-bordered table-sm text-center mb-0 align-middle"><thead class="table-light"><tr><th>組別</th><th>每班至少</th><th>小夜至少</th><th>大夜至少</th><th>小夜最多</th><th>大夜最多</th></tr></thead><tbody>${groups.map(g=>{const v=values[g]||{};return `<tr><td class="fw-bold bg-light">${g}</td><td><input type="number" class="form-control form-control-sm text-center g-min-d" data-group="${g}" value="${v.minD??0}" min="0"></td><td><input type="number" class="form-control form-control-sm text-center g-min-e" data-group="${g}" value="${v.minE??0}" min="0"></td><td><input type="number" class="form-control form-control-sm text-center g-min-n" data-group="${g}" value="${v.minN??0}" min="0"></td><td><input type="number" class="form-control form-control-sm text-center g-max-e" data-group="${g}" value="${v.maxE??''}" placeholder="不限"></td><td><input type="number" class="form-control form-control-sm text-center g-max-n" data-group="${g}" value="${v.maxN??''}" placeholder="不限"></td></tr>`;}).join('')}</tbody></table></div>`; }

    // ✅ 修正 3: 搜尋與新增人員時，正確處理單位名稱
    async searchStaff() {
        const keyword = document.getElementById('staff-search').value.trim();
        const container = document.getElementById('search-results-dropdown');
        if (!keyword) return;

        container.style.display = 'block';
        container.innerHTML = '<div class="list-group-item text-center"><span class="spinner-border spinner-border-sm"></span> 搜尋中...</div>';

        try {
            const results = await userService.searchUsers(keyword);
            if (results.length === 0) {
                container.innerHTML = '<div class="list-group-item text-muted text-center">無結果</div>';
                setTimeout(() => container.style.display = 'none', 1500);
                return;
            }

            container.innerHTML = results.map(u => {
                const isAdded = this.selectedStaff.some(s => s.uid === u.uid);
                // 取得單位名稱
                const uName = this.unitMap[u.unitId] || u.unitName || '未知單位';
                
                return `
                    <button type="button" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center ${isAdded ? 'disabled bg-light' : ''}"
                        onclick="window.routerPage.addStaffFromSearch('${u.uid}', '${u.name}', '${u.rank||''}', '${u.staffId||''}', '${u.group||''}', '${u.unitId}')">
                        <div>
                            <strong>${u.name}</strong> <small class="text-muted">(${u.staffId || ''})</small>
                            <br><small class="text-muted">${uName}</small>
                        </div>
                        ${isAdded ? '<span class="badge bg-secondary">已加入</span>' : '<span class="badge bg-primary"><i class="fas fa-plus"></i></span>'}
                    </button>
                `;
            }).join('');
        } catch(e) { console.error(e); }
    }

    addStaffFromSearch(uid, name, rank, staffId, group, userUnitId) {
        const isSupport = userUnitId !== this.targetUnitId;
        // 傳入 unitId
        this.selectedStaff.push({ uid, name, rank, staffId, unitId: userUnitId, tempGroup: group, isSupport });
        document.getElementById('search-results-dropdown').style.display = 'none';
        document.getElementById('staff-search').value = '';
        this.renderStaffList(this.unitData.groups || []);
    }

    // ... (importLastMonthSettings, savePreSchedule, deletePreSchedule 保持不變) ...
    // 為節省篇幅省略，請保留原程式碼
    async importLastMonthSettings() { /*...*/ }
    async savePreSchedule() { /*...原代碼...*/ const btn=document.getElementById('btn-save'); btn.disabled=true; const monthStr=document.getElementById('edit-month').value; const [year,month]=monthStr.split('-').map(Number); const groupLimits={}; document.querySelectorAll('.g-min-d').forEach(input=>{const g=input.dataset.group; const row=input.closest('tr'); groupLimits[g]={minD:parseInt(row.querySelector('.g-min-d').value)||0, minE:parseInt(row.querySelector('.g-min-e').value)||0, minN:parseInt(row.querySelector('.g-min-n').value)||0, maxE:row.querySelector('.g-max-e').value?parseInt(row.querySelector('.g-max-e').value):null, maxN:row.querySelector('.g-max-n').value?parseInt(row.querySelector('.g-max-n').value):null};}); const staffSettings={}; this.selectedStaff.forEach(s=>staffSettings[s.uid]={group:s.tempGroup}); const supportStaffIds=this.selectedStaff.filter(s=>s.isSupport).map(s=>s.uid); const data={unitId:this.targetUnitId, year, month, settings:{openDate:document.getElementById('edit-open').value, closeDate:document.getElementById('edit-close').value, maxOffDays:parseInt(document.getElementById('edit-maxOff').value), maxHoliday:parseInt(document.getElementById('edit-maxHoliday').value), reservedStaff:parseInt(document.getElementById('edit-reserved').value)||0, showOtherNames:document.getElementById('edit-showNames').checked, shiftTypesLimit:parseInt(document.getElementById('edit-shiftTypes').value), allowThreeTypesVoluntary:document.getElementById('edit-allow3').checked, groupLimits:groupLimits}, staffIds:this.selectedStaff.map(s=>s.uid), staffSettings:staffSettings, supportStaffIds:supportStaffIds, status:'open'}; try{if(this.isEditMode){await PreScheduleService.updatePreScheduleSettings(this.editingScheduleId, data);}else{const exists=await PreScheduleService.checkPreScheduleExists(this.targetUnitId, year, month); if(exists)throw new Error("該月份預班表已存在！"); await PreScheduleService.createPreSchedule(data);} alert("✅ 儲存成功"); this.modal.hide(); this.loadList(this.targetUnitId);} catch(e){alert("失敗: "+e.message);} finally{btn.disabled=false;} }
    async deletePreSchedule(id) { /*...*/ if(confirm("確定刪除？")){await PreScheduleService.deletePreSchedule(id); this.loadList(this.targetUnitId);} }
}
