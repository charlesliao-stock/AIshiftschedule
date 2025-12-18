import { PreScheduleService } from "../../services/firebase/PreScheduleService.js";
import { authService } from "../../services/firebase/AuthService.js";
import { userService } from "../../services/firebase/UserService.js";
import { UnitService } from "../../services/firebase/UnitService.js";
import { PreScheduleSubmitTemplate } from "./templates/PreScheduleSubmitTemplate.js"; 

export class PreScheduleSubmitPage {
    constructor() {
        const today = new Date();
        let targetMonth = today.getMonth() + 1 + 1; 
        let targetYear = today.getFullYear();
        if (targetMonth > 12) { targetMonth -= 12; targetYear++; }

        this.year = targetYear;
        this.month = targetMonth;
        this.realUser = null;       
        this.currentUser = null;    
        this.targetUnitId = null;   
        this.currentUnit = null;    
        this.preSchedulesList = []; 
        this.currentSchedule = null; 
        this.myWishes = {};
        this.unitAggregate = {}; 
        this.unitNames = {}; 
        this.unitStaffMap = {};
        this.isReadOnly = false;
        this.isAdminMode = false;
        this.isImpersonating = false; 
        this.shiftTypes = {
            'OFF':   { label: 'OFF',  color: '#dc3545', bg: '#dc3545', text: 'white' },
            'M_OFF': { label: 'M',    color: '#212529', bg: '#212529', text: 'white' }, 
            'D':     { label: '白',   color: '#0d6efd', bg: '#0d6efd', text: 'white' },
            'E':     { label: '小',   color: '#ffc107', bg: '#ffc107', text: 'black' },
            'N':     { label: '大',   color: '#212529', bg: '#212529', text: 'white' },
            'NO_D':  { label: '勿白', color: '#adb5bd', bg: '#f8f9fa', text: '#0d6efd', border: '1px solid #0d6efd' },
            'NO_E':  { label: '勿小', color: '#adb5bd', bg: '#f8f9fa', text: '#ffc107', border: '1px solid #ffc107' },
            'NO_N':  { label: '勿大', color: '#adb5bd', bg: '#f8f9fa', text: '#212529', border: '1px solid #212529' }
        };
    }

    async render() {
        return PreScheduleSubmitTemplate.renderLayout(this.year, this.month);
    }

    async afterRender() {
        let retries = 0;
        while (!authService.getProfile() && retries < 10) { await new Promise(r => setTimeout(r, 200)); retries++; }
        this.realUser = authService.getProfile();
        if (!this.realUser) { alert("無法讀取使用者資訊"); return; }

        window.routerPage = this;
        this.bindEvents();

        if (this.realUser.role === 'system_admin' || this.realUser.originalRole === 'system_admin') {
            this.isAdminMode = true;
            this.setupAdminUI();
            const tbody = document.getElementById('schedule-list-tbody');
            if (tbody) tbody.innerHTML = `<tr><td colspan="5" class="p-5 text-center text-muted">請先選擇上方「管理員模式」的單位與人員...</td></tr>`;
            document.getElementById('list-view').style.display = 'block';
        } else {
            this.initRegularUser();
        }
    }

    bindEvents() {
        document.getElementById('btn-back').addEventListener('click', () => this.showListView());
        document.getElementById('btn-submit').addEventListener('click', () => this.handleSubmit());
        document.addEventListener('click', (e) => {
            const menu = document.getElementById('user-shift-menu');
            if(menu && !e.target.closest('#user-shift-menu')) menu.style.display = 'none';
        });
        
        const btnPrev = document.getElementById('btn-prev-year');
        const btnNext = document.getElementById('btn-next-year');
        const selectMonth = document.getElementById('month-select');
        const btnLoad = document.getElementById('btn-load');

        if(btnPrev) btnPrev.addEventListener('click', () => { this.year--; document.getElementById('display-year').textContent = this.year; });
        if(btnNext) btnNext.addEventListener('click', () => { this.year++; document.getElementById('display-year').textContent = this.year; });
        if(selectMonth) selectMonth.addEventListener('change', (e) => this.month = parseInt(e.target.value));
        if(btnLoad) btnLoad.addEventListener('click', () => this.tryLoadSchedule());
    }

    // ... (initRegularUser, setupAdminUI, handleAdminSwitch, loadContextData, tryLoadSchedule, showListView, calculateAggregate, renderCalendar, toggleDay, handleRightClick, applyShiftFromMenu, checkLimits, updateCounters 保持原樣) ...
    // (為了節省篇幅，這部分代碼與先前相同，請保留)
    
    async initRegularUser() {
        this.targetUnitId = this.realUser.unitId;
        this.currentUser = this.realUser;
        this.isImpersonating = false;
        if (!this.targetUnitId) { alert("您的帳號尚未綁定單位，無法使用預班功能。"); return; }
        await this.loadContextData(); 
        this.tryLoadSchedule();
    }

    async setupAdminUI() {
        document.getElementById('admin-impersonate-section').style.display = 'block';
        const unitSelect = document.getElementById('admin-unit-select');
        const userSelect = document.getElementById('admin-user-select');
        const btn = document.getElementById('btn-impersonate');

        try {
            const units = await UnitService.getAllUnits();
            unitSelect.innerHTML = `<option value="">選擇單位</option>` + units.map(u => `<option value="${u.unitId}">${u.unitName}</option>`).join('');
        } catch(e) {}

        unitSelect.addEventListener('change', async () => {
            if(!unitSelect.value) return;
            userSelect.innerHTML = '<option>載入中...</option>';
            const staff = await userService.getUnitStaff(unitSelect.value);
            userSelect.innerHTML = `<option value="">選擇人員</option>` + staff.map(u => `<option value="${u.uid}">${u.name}</option>`).join('');
        });

        btn.addEventListener('click', async () => {
            const uid = userSelect.value;
            const unitId = unitSelect.value;
            if(!uid || !unitId) return alert("請選擇單位與人員");
            this.handleAdminSwitch(unitId, uid);
        });
    }

    async handleAdminSwitch(unitId, userId) {
        try {
            this.targetUnitId = unitId;
            const targetUser = await userService.getUserData(userId);
            this.currentUser = targetUser;
            this.isImpersonating = true;
            await this.loadContextData();
            document.getElementById('detail-view').style.display = 'none';
            document.getElementById('list-view').style.display = 'block';
            this.tryLoadSchedule();
        } catch (e) { alert("切換身份失敗: " + e.message); }
    }

    async loadContextData() {
        this.currentUnit = await UnitService.getUnitById(this.targetUnitId);
        const staff = await userService.getUnitStaff(this.targetUnitId);
        this.unitStaffMap = {};
        staff.forEach(s => this.unitStaffMap[s.uid] = s.name);
    }

    async tryLoadSchedule() {
        if(!this.targetUnitId) return;
        const tbody = document.getElementById('schedule-list-tbody');
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-5"><span class="spinner-border text-primary"></span></td></tr>';
        
        const allSchedules = await PreScheduleService.getPreSchedulesList(this.targetUnitId);
        this.preSchedulesList = allSchedules;
        
        if (allSchedules.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="py-5 text-muted text-center">此單位目前無預班表</td></tr>';
            return;
        }
        
        const now = new Date().toISOString().split('T')[0];
        tbody.innerHTML = allSchedules.map(p => {
            let status = '開放中';
            if (now < p.settings.openDate) status = '未開放';
            else if (now > p.settings.closeDate) status = '已截止';
            
            return `<tr>
                <td class="fw-bold fs-5 text-primary">${p.year}-${String(p.month).padStart(2,'0')}</td>
                <td>${this.currentUnit.unitName}</td>
                <td>${p.settings.openDate} ~ ${p.settings.closeDate}</td>
                <td>${status}</td>
                <td><button class="btn btn-sm btn-primary" onclick="window.routerPage.openSchedule('${p.id}', ${status==='已截止'})">填寫預班</button></td>
            </tr>`;
        }).join('');
        this.showListView();
    }

    showListView() {
        document.getElementById('list-view').style.display = 'block';
        document.getElementById('detail-view').style.display = 'none';
    }

    openSchedule(id, isExpired) {
        this.currentSchedule = this.preSchedulesList.find(s => s.id === id);
        if (!this.currentSchedule) return;
        
        this.isReadOnly = (this.isAdminMode && !this.isImpersonating) ? false : isExpired;

        document.getElementById('list-view').style.display = 'none';
        document.getElementById('detail-view').style.display = 'block';
        document.getElementById('calendar-header-title').textContent = `${this.currentUnit.unitName} ${this.currentSchedule.year}年${this.currentSchedule.month}月`;

        const mySub = (this.currentSchedule.submissions && this.currentSchedule.submissions[this.currentUser.uid]) || {};
        this.myWishes = mySub.wishes || {};
        document.getElementById('wish-notes').value = mySub.notes || '';

        const settings = this.currentSchedule.settings;
        document.getElementById('limit-total').textContent = settings.maxOffDays;
        document.getElementById('limit-holiday').textContent = settings.maxHoliday || 0;

        const disabled = this.isReadOnly;
        const submitBtn = document.getElementById('btn-submit');
        if (submitBtn) {
            submitBtn.disabled = disabled;
            submitBtn.textContent = disabled ? "已截止 / 唯讀" : "提交預班";
        }
        document.querySelectorAll('#detail-view textarea').forEach(i => i.disabled = disabled);

        const canBatch = this.currentUser.constraints?.canBatch;
        const maxTypes = settings.shiftTypesLimit || 2; 
        const unitShifts = this.currentUnit.settings?.shifts || [{code:'D', name:'白'}, {code:'E', name:'小'}, {code:'N', name:'大'}];
        const savedPref = mySub.preferences || {};

        document.getElementById('preference-container').innerHTML = 
            PreScheduleSubmitTemplate.renderPreferencesForm(canBatch, maxTypes, savedPref, unitShifts, settings);

        // ✅ 綁定 Radio Change 事件
        const radios = document.getElementsByName('monthlyMix');
        if (radios.length > 0) {
            radios.forEach(r => {
                r.addEventListener('change', (e) => this.updatePriorityVisibility(e.target.value));
            });
            // 初始化狀態
            const currentMix = document.querySelector('input[name="monthlyMix"]:checked')?.value || '2';
            this.updatePriorityVisibility(currentMix);
        }

        // ✅ 綁定班別選擇事件
        document.querySelectorAll('.shift-cell').forEach(cell => {
            cell.addEventListener('click', (e) => this.toggleDay(e.currentTarget));
            cell.addEventListener('contextmenu', (e) => this.handleRightClick(e));
        });

        this.renderCalendar();
        this.updateCounters();
    }

    updatePriorityVisibility(mixType) {
        const p3 = document.getElementById('priority-3-row');
        if (p3) {
            // 只有在選擇 3 種夜班或啟動同意同仁自願選擇 3 種班時才顯示 P3
            const showMixOption = this.currentSchedule.settings.allowVoluntaryMix3;
            if (mixType === '3' || showMixOption) {
                p3.style.display = 'flex';
            } else {
                p3.style.display = 'none';
            }
        }
    }

    renderCalendar() {
        const calendarBody = document.getElementById('calendar-body');
        if (!calendarBody) return;

        const daysInMonth = new Date(this.year, this.month, 0).getDate();
        const firstDayOfWeek = new Date(this.year, this.month - 1, 1).getDay(); // 0=Sun, 1=Mon

        let html = '';
        let dayCounter = 1;

        // 填補上個月的空白
        html += '<tr>';
        for (let i = 0; i < firstDayOfWeek; i++) {
            html += '<td class="empty-cell"></td>';
        }

        // 渲染本月
        for (let i = 0; i < daysInMonth; i++) {
            const date = dayCounter;
            const dayOfWeek = (firstDayOfWeek + i) % 7;
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const shiftCode = this.myWishes[date] || 'OFF';
            const shiftInfo = this.shiftTypes[shiftCode];
            const isOff = shiftCode === 'OFF';
            const isHoliday = this.currentSchedule.settings.holidays?.includes(date);
            const isMOff = shiftCode === 'M_OFF';
            const isReadOnly = this.isReadOnly;

            // 單位人力需求
            const demand = this.currentSchedule.demand?.[date] || {};
            const demandHtml = Object.entries(demand).map(([shift, count]) => {
                const current = this.unitAggregate[date]?.[shift] || 0;
                const color = current >= count ? 'text-success' : 'text-danger';
                return `<span class="${color} small me-1">${shift} ${current}/${count}</span>`;
            }).join('');

            html += `
                <td class="shift-cell text-center p-1 ${isWeekend ? 'weekend' : ''} ${isHoliday ? 'holiday' : ''} ${isReadOnly ? 'readonly-cell' : ''}" 
                    data-date="${date}" 
                    data-shift="${shiftCode}"
                    style="background-color: ${shiftInfo.bg}; color: ${shiftInfo.text}; border: ${shiftInfo.border || ''};"
                    title="${shiftInfo.label}">
                    <div class="date-label fw-bold">${date}</div>
                    <div class="shift-label fw-bold">${shiftInfo.label}</div>
                    <div class="demand-label">${demandHtml}</div>
                </td>
            `;

            if (dayOfWeek === 6) {
                html += '</tr><tr>';
            }
            dayCounter++;
        }

        // 填補下個月的空白
        const remainingCells = (7 - ((firstDayOfWeek + daysInMonth) % 7)) % 7;
        for (let i = 0; i < remainingCells; i++) {
            html += '<td class="empty-cell"></td>';
        }
        html += '</tr>';

        calendarBody.innerHTML = html;
    }

    toggleDay(cell) {
        if (this.isReadOnly) return;

        const date = parseInt(cell.dataset.date);
        const currentShift = cell.dataset.shift;
        const shifts = ['OFF', 'D', 'E', 'N', 'NO_D', 'NO_E', 'NO_N'];
        let nextShiftIndex = (shifts.indexOf(currentShift) + 1) % shifts.length;
        let nextShiftCode = shifts[nextShiftIndex];

        // 跳過 M_OFF (管理者專用)
        if (nextShiftCode === 'M_OFF') {
            nextShiftIndex = (nextShiftIndex + 1) % shifts.length;
            nextShiftCode = shifts[nextShiftIndex];
        }

        this.myWishes[date] = nextShiftCode;
        this.renderCalendar();
        this.updateCounters();
    }

    handleRightClick(e) {
        e.preventDefault();
        if (this.isReadOnly) return;

        const cell = e.currentTarget;
        const date = parseInt(cell.dataset.date);
        const menu = document.getElementById('user-shift-menu');
        const shifts = ['OFF', 'D', 'E', 'N', 'NO_D', 'NO_E', 'NO_N'];

        menu.innerHTML = shifts.map(shift => {
            const info = this.shiftTypes[shift];
            return `<button class="dropdown-item" data-shift="${shift}" style="color: ${info.color};">${info.label}</button>`;
        }).join('');

        menu.style.display = 'block';
        menu.style.left = `${e.pageX}px`;
        menu.style.top = `${e.pageY}px`;

        menu.querySelectorAll('.dropdown-item').forEach(item => {
            item.onclick = () => {
                this.applyShiftFromMenu(date, item.dataset.shift);
                menu.style.display = 'none';
            };
        });
    }

    applyShiftFromMenu(date, shiftCode) {
        this.myWishes[date] = shiftCode;
        this.renderCalendar();
        this.updateCounters();
    }

    checkLimits() {
        const totalOff = Object.values(this.myWishes).filter(s => s === 'OFF').length;
        const holidayOff = Object.entries(this.myWishes).filter(([date, shift]) => {
            return shift === 'OFF' && this.currentSchedule.settings.holidays?.includes(parseInt(date));
        }).length;

        const totalLimit = parseInt(document.getElementById('limit-total').textContent);
        const holidayLimit = parseInt(document.getElementById('limit-holiday').textContent);

        document.getElementById('current-total').textContent = totalOff;
        document.getElementById('current-holiday').textContent = holidayOff;

        document.getElementById('current-total').classList.toggle('text-danger', totalOff > totalLimit);
        document.getElementById('current-holiday').classList.toggle('text-danger', holidayOff > holidayLimit);

        return totalOff <= totalLimit && holidayOff <= holidayLimit;
    }

    updateCounters() {
        this.checkLimits();
        this.calculateAggregate();
    }

    calculateAggregate() {
        const aggregate = {};
        const staff = this.currentUnit.staff || [];
        const allSubmissions = this.currentSchedule.submissions || {};

        staff.forEach(s => {
            const wishes = allSubmissions[s.uid]?.wishes || {};
            Object.entries(wishes).forEach(([date, shift]) => {
                const day = parseInt(date);
                if (!aggregate[day]) aggregate[day] = {};
                aggregate[day][shift] = (aggregate[day][shift] || 0) + 1;
            });
        });

        // 將自己的預班也加入計算
        Object.entries(this.myWishes).forEach(([date, shift]) => {
            const day = parseInt(date);
            if (!aggregate[day]) aggregate[day] = {};
            aggregate[day][shift] = (aggregate[day][shift] || 0) + 1;
        });

        this.unitAggregate = aggregate;
    }

    async handleSubmit() {
        if (this.isReadOnly) return;

        if (!this.checkLimits()) {
            alert("錯誤：您的休假天數已超過限制，請修正後再提交。");
            return;
        }

        const preferences = {};
        const p1 = document.getElementById('priority-1').value;
        const p2 = document.getElementById('priority-2').value;
        const p3 = document.getElementById('priority-3')?.value || '';
        const showMixOption = this.currentSchedule.settings.allowVoluntaryMix3;
        const limit = this.currentSchedule.settings.shiftTypesLimit || 2;

        const selected = [p1, p2];
        if (p3) selected.push(p3);
        const unique = new Set(selected.filter(s => s !== ''));

        if (selected.length !== unique.size) { alert("偏好順序請勿選擇重複的班別"); return; }

        const canBatch = this.currentUser.constraints?.canBatch;
        const batchPref = document.querySelector('input[name="batchPref"]:checked')?.value || "";

        // 1. 驗證：包班意願與排班偏好順序的衝突
        if (canBatch && batchPref !== "") {
            const batchShift = batchPref === "包小夜" ? "E" : "N";
            const conflictingShift = batchPref === "包小夜" ? "N" : "E";
            
            if (selected.includes(conflictingShift)) {
                alert(`錯誤：您選擇了 ${batchPref}，但排班偏好順序中包含了 ${conflictingShift} 班。兩者互相矛盾，請修正。`);
                return;
            }
        }

        // 2. 驗證：排班偏好順序中不能同時選兩種夜班 (E, N)
        const hasE = selected.includes("E");
        const hasN = selected.includes("N");
        if (hasE && hasN) {
            alert("錯誤：排班偏好順序中不能同時選擇小夜 (E) 和大夜 (N) 兩種夜班。請修正。");
            return;
        }

        preferences.priority1 = p1;
        preferences.priority2 = p2;
        // 修正：僅當 P3 顯示時才儲存
        if (showMixOption && preferences.monthlyMix === '3') {
            preferences.priority3 = p3; 
        } else if (limit === 3) {
            preferences.priority3 = p3;
        }

        const btn = document.getElementById('btn-submit');
        btn.disabled = true;
        try {
            await PreScheduleService.submitPersonalWish(
                this.currentSchedule.unitId, this.currentSchedule.year, this.currentSchedule.month,
                this.currentUser.uid, this.myWishes,
                document.getElementById('wish-notes').value,
                preferences
            );
            
            let msg = '✅ 提交成功！';
            if (this.isImpersonating) msg += `\n(已為 ${this.currentUser.name} 提交)`;
            
            alert(msg);
            this.showListView();
            this.tryLoadSchedule();
        } catch (e) { alert("提交失敗: " + e.message); } finally { btn.disabled = false; }
    }
}
