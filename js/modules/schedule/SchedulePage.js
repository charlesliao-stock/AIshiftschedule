import { UnitService } from "../../services/firebase/UnitService.js";
import { userService } from "../../services/firebase/UserService.js";
import { ScheduleService } from "../../services/firebase/ScheduleService.js";
import { PreScheduleService } from "../../services/firebase/PreScheduleService.js";
import { RuleEngine } from "../ai/RuleEngine.js";
import { AutoScheduler } from "../ai/AutoScheduler.js";
import { ScoringService } from "../../services/ScoringService.js";

export class SchedulePage {
    constructor() {
        this.state = {
            currentUnitId: null, year: null, month: null,
            unitSettings: null, staffList: [], 
            scheduleData: null, // { assignments, prevAssignments, ... }
            daysInMonth: 0,
            scoreResult: null,
            sortKey: 'id', // 預設依職編排序
            sortAsc: true
        };
        this.versionsModal = null; 
        this.scoreModal = null;
        this.settingsModal = null; // 新增設定 Modal
        this.generatedVersions = [];
        this.handleGlobalClick = this.handleGlobalClick.bind(this);
    }

    cleanup() {
        document.removeEventListener('click', this.handleGlobalClick);
        this.closeMenu();
        const backdrops = document.querySelectorAll('.modal-backdrop');
        backdrops.forEach(b => b.remove());
    }

    async render() {
        // 內嵌 CSS 以支援複雜的左右固定表格
        const style = `
            <style>
                .schedule-table-wrapper { position: relative; max-height: 100%; width: 100%; overflow: auto; }
                .schedule-grid th, .schedule-grid td { vertical-align: middle; white-space: nowrap; padding: 2px 4px; height: 38px; border-color: #dee2e6; }
                /* Sticky Columns 設定 */
                .sticky-col { position: sticky; z-index: 10; }
                .first-col { left: 0; z-index: 11; border-right: 2px solid #ccc !important; width: 60px; }
                .second-col { left: 60px; z-index: 11; width: 80px; }
                .third-col { left: 140px; z-index: 11; border-right: 2px solid #999 !important; width: 60px; }
                /* 右側固定欄位 */
                .right-col-1 { right: 0; z-index: 11; border-left: 2px solid #ccc !important; width: 45px; } 
                .right-col-2 { right: 45px; z-index: 11; width: 45px; }
                .right-col-3 { right: 90px; z-index: 11; width: 45px; }
                .right-col-4 { right: 135px; z-index: 11; border-left: 2px solid #999 !important; width: 45px; }
                thead .sticky-col { z-index: 15 !important; }
                /* 其他樣式 */
                .bg-light-gray { background-color: #f8f9fa !important; color: #aaa; }
                .shift-input:focus { background-color: #e8f0fe !important; font-weight: bold; outline: none; }
                .cursor-pointer { cursor: pointer; }
                .shift-cell { cursor: pointer; transition: background 0.1s; }
                .shift-cell:hover { background-color: #e9ecef; }
            </style>
        `;

        const params = new URLSearchParams(window.location.hash.split('?')[1]);
        this.state.currentUnitId = params.get('unitId');
        this.state.year = parseInt(params.get('year'));
        this.state.month = parseInt(params.get('month'));

        if(!this.state.currentUnitId) return `<div class="alert alert-danger m-4">無效的參數。</div>`;

        // 設定 Modal HTML (優化版：分組顯示)
        const modalHtml = `
            <div class="modal fade" id="settings-modal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header bg-secondary text-white">
                            <h5 class="modal-title"><i class="fas fa-sliders-h me-2"></i>規則與評分設定</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <form id="settings-form">
                                <div class="card mb-4 border-left-primary">
                                    <div class="card-header bg-light fw-bold text-primary">
                                        1. 排班限制與例外 (Rules & Exceptions)
                                    </div>
                                    <div class="card-body">
                                        <div class="row g-3">
                                            <div class="col-md-12">
                                                <div class="form-check form-switch">
                                                    <input class="form-check-input" type="checkbox" id="set-interval-11h">
                                                    <label class="form-check-label fw-bold" for="set-interval-11h">啟用「班別間隔 11 小時」檢查</label>
                                                    <div class="form-text small text-muted">防止逆向排班 (如小夜接白班)，確保休息時間。</div>
                                                </div>
                                            </div>
                                            <hr class="my-2 text-muted">
                                            <div class="col-md-6">
                                                <label class="form-label fw-bold">連續上班天數上限 (一般)</label>
                                                <div class="input-group">
                                                    <input type="number" class="form-control" id="set-max-consecutive" value="6" min="1" max="14">
                                                    <span class="input-group-text">天</span>
                                                </div>
                                            </div>
                                            <div class="col-md-6 d-flex align-items-center">
                                                <div class="form-check mt-4">
                                                    <input class="form-check-input" type="checkbox" id="set-allow-long-leave">
                                                    <label class="form-check-label" for="set-allow-long-leave">
                                                        <strong>允許長假例外：</strong>
                                                        長假/積假人員可連上 7 天
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div class="card mb-3 border-left-success">
                                    <div class="card-header bg-light fw-bold text-success">
                                        2. 預班保障與 AI 權重 (Preferences & Scoring)
                                    </div>
                                    <div class="card-body">
                                        <div class="row g-3">
                                            <div class="col-md-12 mb-2">
                                                <div class="form-check form-switch">
                                                    <input class="form-check-input" type="checkbox" id="set-guarantee-preschedule">
                                                    <label class="form-check-label fw-bold" for="set-guarantee-preschedule">預班絕對保障 (Hard Lock)</label>
                                                    <div class="form-text small">開啟後，員工預班直接鎖定，不可被 AI 更動 (若人力不足可能導致排班失敗)。</div>
                                                </div>
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label fw-bold">Rank 1 (第一志願) 加分權重</label>
                                                <input type="range" class="form-range" id="set-weight-p1" min="10" max="100" step="10">
                                                <div class="d-flex justify-content-between small text-muted">
                                                    <span>10</span><span id="val-weight-p1" class="fw-bold text-success">--</span><span>100</span>
                                                </div>
                                            </div>
                                            <div class="col-md-6">
                                                <label class="form-label fw-bold">Rank 2 (第二志願) 加分權重</label>
                                                <input type="range" class="form-range" id="set-weight-p2" min="5" max="50" step="5">
                                                <div class="d-flex justify-content-between small text-muted">
                                                    <span>5</span><span id="val-weight-p2" class="fw-bold text-success">--</span><span>50</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                            <button type="button" class="btn btn-primary" onclick="window.routerPage.saveSettings()">儲存設定</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        return `
            ${style}
            <div class="container-fluid p-0 h-100 d-flex flex-column">
                <div class="schedule-toolbar p-3 bg-white border-bottom d-flex align-items-center gap-3 justify-content-between">
                    <div class="d-flex align-items-center gap-2">
                        <h4 class="mb-0 fw-bold text-primary"><i class="bi bi-calendar-week"></i> 排班作業</h4>
                        <span id="schedule-status-badge" class="badge bg-secondary">載入中</span>
                        <div id="loading-indicator" class="spinner-border spinner-border-sm text-primary" style="display:none;"></div>
                    </div>

                    <div class="d-flex align-items-center gap-3">
                        <div id="score-display-card" class="d-flex align-items-center px-3 py-1 bg-light rounded border cursor-pointer" onclick="window.routerPage.showScoreDetails()">
                            <span class="text-muted me-2 small">排班評分</span>
                            <h3 class="mb-0 fw-bold text-secondary" id="score-display">--</h3>
                            <span class="ms-1 small">分</span>
                        </div>

                        <button id="btn-settings" class="btn btn-outline-secondary" title="規則與評分設定">
                            <i class="fas fa-cog"></i> 設定
                        </button>

                        <button id="btn-auto-schedule" class="btn btn-outline-primary"><i class="bi bi-robot"></i> AI 排班</button>
                        <button id="btn-clear" class="btn btn-outline-danger"><i class="bi bi-arrow-counterclockwise"></i> 重置</button>
                        <button id="btn-publish" class="btn btn-success"><i class="bi bi-check-circle"></i> 發布班表</button>
                    </div>
                </div>

                <div class="flex-grow-1 overflow-auto bg-light p-3" id="schedule-grid-container">
                    </div>
            </div>

            <div class="modal fade" id="score-modal" tabindex="-1">
                <div class="modal-dialog modal-lg modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header bg-success text-white">
                            <h5 class="modal-title">排班品質評分報告</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" id="score-details-body"></div>
                    </div>
                </div>
            </div>
            
            <div class="modal fade" id="versions-modal" tabindex="-1">
                <div class="modal-dialog modal-xl modal-dialog-scrollable">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">AI 智慧排班結果選擇</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div id="ai-progress-container" class="mb-3" style="display:none;">
                                <div id="ai-progress-text" class="mb-1 text-primary">正在運算中...</div>
                                <div class="progress"><div id="ai-progress-bar" class="progress-bar progress-bar-striped progress-bar-animated" style="width: 0%"></div></div>
                            </div>
                            <ul class="nav nav-tabs" id="versionTabs" role="tablist">
                                <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#v1">版本 1</button></li>
                                <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#v2">版本 2</button></li>
                                <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#v3">版本 3</button></li>
                            </ul>
                            <div class="tab-content p-3 border border-top-0" id="versionTabContent">
                                <div class="tab-pane fade show active" id="v1"></div>
                                <div class="tab-pane fade" id="v2"></div>
                                <div class="tab-pane fade" id="v3"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            ${modalHtml}
        `;
    }

    async afterRender() {
        this.versionsModal = new bootstrap.Modal(document.getElementById('versions-modal'));
        this.scoreModal = new bootstrap.Modal(document.getElementById('score-modal'));
        this.settingsModal = new bootstrap.Modal(document.getElementById('settings-modal'));
        window.routerPage = this;

        document.getElementById('btn-auto-schedule').addEventListener('click', () => this.runMultiVersionAI());
        document.getElementById('btn-clear').addEventListener('click', () => this.resetToPreSchedule());
        document.getElementById('btn-publish').addEventListener('click', () => this.togglePublish());
        
        // 綁定設定按鈕
        document.getElementById('btn-settings').addEventListener('click', () => this.openSettingsModal());

        // Range input 連動顯示
        document.getElementById('set-weight-p1').addEventListener('input', (e) => document.getElementById('val-weight-p1').textContent = e.target.value);
        document.getElementById('set-weight-p2').addEventListener('input', (e) => document.getElementById('val-weight-p2').textContent = e.target.value);

        document.removeEventListener('click', this.handleGlobalClick); 
        document.addEventListener('click', this.handleGlobalClick);

        await this.loadData();
    }

    handleGlobalClick(e) {
        if (!e.target.closest('.shift-menu') && !e.target.closest('.shift-cell') && this.state.activeMenu) {
            this.closeMenu();
        }
    }

    closeMenu() {
        if (this.state.activeMenu) { this.state.activeMenu.remove(); this.state.activeMenu = null; }
    }
    
    async loadData() {
        const container = document.getElementById('schedule-grid-container');
        const loading = document.getElementById('loading-indicator');
        if(loading) loading.style.display = 'block';

        try {
            const [unit, staffList, schedule] = await Promise.all([
                UnitService.getUnitByIdWithCache(this.state.currentUnitId),
                userService.getUnitStaff(this.state.currentUnitId),
                ScheduleService.getSchedule(this.state.currentUnitId, this.state.year, this.state.month)
            ]);

            this.state.unitSettings = unit;
            this.state.staffList = staffList;
            this.state.daysInMonth = new Date(this.state.year, this.state.month, 0).getDate();
            
            if (!schedule) {
                const newSched = await ScheduleService.createEmptySchedule(
                    this.state.currentUnitId, this.state.year, this.state.month, staffList.map(s=>s.uid)
                );
                this.state.scheduleData = newSched;
                await this.resetToPreSchedule(false);
            } else {
                this.state.scheduleData = schedule;
                this.renderGrid();
                this.updateStatusBadge();
                this.updateScoreDisplay();
            }
        } catch (error) {
            console.error(error);
            container.innerHTML = `<div class="alert alert-danger m-3">載入失敗: ${error.message}</div>`;
        } finally {
            if(loading) loading.style.display = 'none';
        }
    }

    // 開啟設定視窗
    openSettingsModal() {
        const rules = this.state.unitSettings?.settings?.rules || {};
        const constraints = rules.constraints || {};
        const weights = rules.weights || {};

        // 填入數值
        document.getElementById('set-interval-11h').checked = constraints.minInterval11h !== false; // 預設 true
        document.getElementById('set-max-consecutive').value = rules.maxConsecutiveWork || 6;
        document.getElementById('set-allow-long-leave').checked = !!constraints.allowLongLeaveException;
        document.getElementById('set-guarantee-preschedule').checked = !!constraints.guaranteePreSchedule;
        
        const w1 = weights.rank1 || 50;
        const w2 = weights.rank2 || 20;
        document.getElementById('set-weight-p1').value = w1;
        document.getElementById('val-weight-p1').textContent = w1;
        document.getElementById('set-weight-p2').value = w2;
        document.getElementById('val-weight-p2').textContent = w2;

        this.settingsModal.show();
    }

    // 儲存設定
    async saveSettings() {
        // 保留舊的設定，只更新變動部分
        const currentRules = this.state.unitSettings?.settings?.rules || {};
        const currentConstraints = currentRules.constraints || {};
        const currentWeights = currentRules.weights || {};

        const newRules = {
            ...currentRules, // 保留可能存在的其他規則
            maxConsecutiveWork: parseInt(document.getElementById('set-max-consecutive').value),
            constraints: {
                ...currentConstraints,
                minInterval11h: document.getElementById('set-interval-11h').checked,
                allowLongLeaveException: document.getElementById('set-allow-long-leave').checked,
                guaranteePreSchedule: document.getElementById('set-guarantee-preschedule').checked
            },
            weights: {
                ...currentWeights,
                rank1: parseInt(document.getElementById('set-weight-p1').value),
                rank2: parseInt(document.getElementById('set-weight-p2').value)
            }
        };

        try {
            const currentSettings = this.state.unitSettings.settings || {};
            const updatedSettings = {
                ...currentSettings,
                rules: newRules
            };

            await UnitService.updateUnit(this.state.currentUnitId, { settings: updatedSettings });
            
            this.state.unitSettings.settings = updatedSettings;
            
            alert("設定已儲存！");
            this.settingsModal.hide();
        } catch (e) {
            console.error(e);
            alert("儲存失敗: " + e.message);
        }
    }

    renderGrid() {
        const container = document.getElementById('schedule-grid-container');
        const { year, month, daysInMonth, staffList, scheduleData, sortKey, sortAsc } = this.state;
        const assignments = scheduleData.assignments || {};
        const prevAssignments = scheduleData.prevAssignments || {};

        const prevMonthLastDate = new Date(year, month - 1, 0); 
        const prevLastDayVal = prevMonthLastDate.getDate();
        const prevDaysToShow = [];
        for(let i=5; i>=0; i--) { prevDaysToShow.push(prevLastDayVal - i); }

        staffList.sort((a, b) => {
            const valA = a[sortKey] || '';
            const valB = b[sortKey] || '';
            return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        });

        let html = `
            <div class="schedule-table-wrapper shadow-sm bg-white rounded">
                <table class="table table-bordered table-sm text-center mb-0 align-middle schedule-grid">
                    <thead class="bg-light">
                        <tr>
                            <th class="sticky-col first-col bg-light cursor-pointer" onclick="window.routerPage.sortStaff('id')">
                                職編 ${sortKey==='id' ? (sortAsc?'↑':'↓') : ''}
                            </th>
                            <th class="sticky-col second-col bg-light">姓名</th>
                            <th class="sticky-col third-col bg-light">備註</th>
        `;
        prevDaysToShow.forEach(d => html += `<th class="text-muted bg-light-gray" style="font-size:0.8rem">${d}</th>`);
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month - 1, d);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const weekStr = ['日','一','二','三','四','五','六'][date.getDay()];
            html += `<th class="${isWeekend?'text-danger':''}" style="font-size:0.9rem">${d}<div style="font-size:0.7rem">${weekStr}</div></th>`;
        }
        html += `
                            <th class="sticky-col right-col-4 bg-light text-primary">OFF</th>
                            <th class="sticky-col right-col-3 bg-light">小夜</th>
                            <th class="sticky-col right-col-2 bg-light">大夜</th>
                            <th class="sticky-col right-col-1 bg-light">假日</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        staffList.forEach(staff => {
            const uid = staff.uid;
            const userShifts = assignments[uid] || {};
            const prevUserShifts = prevAssignments[uid] || {};
            const stats = this.calculateRowStats(userShifts);

            html += `
                <tr>
                    <td class="sticky-col first-col bg-white fw-bold">${staff.id || ''}</td>
                    <td class="sticky-col second-col bg-white">${staff.name}</td>
                    <td class="sticky-col third-col bg-white small text-muted text-truncate" title="${staff.note || ''}">${staff.note || ''}</td>
            `;
            prevDaysToShow.forEach(d => { html += `<td class="bg-light-gray text-muted small">${prevUserShifts[d] || '-'}</td>`; });
            for (let d = 1; d <= daysInMonth; d++) {
                const val = userShifts[d] || '';
                html += `<td class="p-0 shift-cell" data-staff-id="${uid}" data-day="${d}" onclick="window.routerPage.openShiftMenu(this)" style="${val==='OFF'?'background:#f0f0f0':''}">
                            ${val}
                         </td>`;
            }
            html += `
                    <td class="sticky-col right-col-4 bg-white fw-bold text-primary" id="stat-off-${uid}">${stats.off}</td>
                    <td class="sticky-col right-col-3 bg-white" id="stat-e-${uid}">${stats.e}</td>
                    <td class="sticky-col right-col-2 bg-white" id="stat-n-${uid}">${stats.n}</td>
                    <td class="sticky-col right-col-1 bg-white" id="stat-hol-${uid}">${stats.hol}</td>
                </tr>
            `;
        });
        html += `</tbody></table></div>`;
        container.innerHTML = html;
    }

    calculateRowStats(shifts) {
        let off = 0, e = 0, n = 0, hol = 0;
        const { year, month, daysInMonth } = this.state;
        for (let d = 1; d <= daysInMonth; d++) {
            const s = shifts[d];
            if (!s) continue;
            if (['OFF', 'M_OFF'].includes(s)) off++;
            if (s === 'E') e++;
            if (s === 'N') n++;
            const date = new Date(year, month - 1, d);
            const w = date.getDay();
            if ((w === 0 || w === 6) && !['OFF', 'M_OFF'].includes(s)) hol++;
        }
        return { off, e, n, hol };
    }

    sortStaff(key) {
        if (this.state.sortKey === key) this.state.sortAsc = !this.state.sortAsc;
        else { this.state.sortKey = key; this.state.sortAsc = true; }
        this.renderGrid();
    }

    openShiftMenu(cell) {
        const shifts = this.state.unitSettings?.settings?.shifts || [
            {code:'D', name:'白班', color:'#fff'},
            {code:'E', name:'小夜', color:'#fff'},
            {code:'N', name:'大夜', color:'#fff'}
        ];
        this.closeMenu();
        const menu = document.createElement('div');
        menu.className = 'shift-menu shadow rounded border bg-white';
        menu.style.position = 'absolute'; menu.style.zIndex = '1000'; menu.style.padding = '5px';
        const opts = [{ code: '', name: '清除', color: 'transparent' }, { code: 'OFF', name: '休假', color: '#e5e7eb' }];
        [...shifts, ...opts].forEach(s => {
            if(s.code === 'OFF' || s.code === '') return;
        });
        
        const renderItem = (s) => {
            const item = document.createElement('div');
            item.className = 'p-1'; item.style.cursor = 'pointer';
            item.innerHTML = `<span style="display:inline-block;width:15px;height:15px;background:${s.color};border:1px solid #ddd;margin-right:5px;"></span> ${s.code}`;
            item.onclick = () => this.handleShiftSelect(cell, s.code);
            menu.appendChild(item);
        };
        renderItem({ code: '', name: '清除', color: '#fff' });
        renderItem({ code: 'OFF', name: '休假', color: '#eee' });
        shifts.forEach(s => renderItem(s));
        const rect = cell.getBoundingClientRect();
        menu.style.top = `${rect.bottom + window.scrollY}px`; 
        menu.style.left = `${rect.left + window.scrollX}px`;
        document.body.appendChild(menu);
        this.state.activeMenu = menu;
    }

    async handleShiftSelect(cell, code) {
        this.closeMenu();
        const uid = cell.dataset.staffId;
        const day = cell.dataset.day;
        if (!this.state.scheduleData.assignments[uid]) this.state.scheduleData.assignments[uid] = {};
        this.state.scheduleData.assignments[uid][day] = code;
        cell.textContent = code;
        cell.style.background = code === 'OFF' ? '#f0f0f0' : '';
        const stats = this.calculateRowStats(this.state.scheduleData.assignments[uid]);
        document.getElementById(`stat-off-${uid}`).textContent = stats.off;
        document.getElementById(`stat-e-${uid}`).textContent = stats.e;
        document.getElementById(`stat-n-${uid}`).textContent = stats.n;
        document.getElementById(`stat-hol-${uid}`).textContent = stats.hol;
        await ScheduleService.updateShift(this.state.currentUnitId, this.state.year, this.state.month, uid, day, code);
        this.updateScoreDisplay();
    }

    async updateScoreDisplay() {
        const { scheduleData, staffList, unitSettings, year, month } = this.state;
        if (!scheduleData || !scheduleData.assignments) return;
        const preSchedule = await PreScheduleService.getPreSchedule(this.state.currentUnitId, year, month);
        const fullPreSchedule = { ...preSchedule, assignments: scheduleData.prevAssignments };
        const result = ScoringService.calculate(scheduleData, staffList, unitSettings, fullPreSchedule);
        this.state.scoreResult = result;
        const el = document.getElementById('score-display');
        if(el) {
            el.textContent = result.totalScore;
            el.className = `h4 mb-0 fw-bold ${result.totalScore>=80?'text-success':(result.totalScore>=60?'text-warning':'text-danger')}`;
        }
    }

    showScoreDetails() {
        if (!this.state.scoreResult) return alert("尚未計算分數");
        const details = this.state.scoreResult.details;
        let html = '<div class="accordion" id="scoreAccordion">';
        Object.entries(details).forEach(([key, cat], idx) => {
             html += `
                <div class="accordion-item">
                    <h2 class="accordion-header">
                        <button class="accordion-button ${idx===0?'':'collapsed'}" type="button" data-bs-toggle="collapse" data-bs-target="#c-${key}">
                            <div class="d-flex w-100 justify-content-between me-3 align-items-center">
                                <span>${cat.label}</span>
                                <span class="badge bg-primary rounded-pill">${Math.round(cat.score)}分</span>
                            </div>
                        </button>
                    </h2>
                    <div id="c-${key}" class="accordion-collapse collapse ${idx===0?'show':''}">
                        <div class="accordion-body">
                            <ul class="list-group list-group-flush">
                                ${cat.subItems ? cat.subItems.map(item => `
                                    <li class="list-group-item d-flex justify-content-between align-items-center">
                                        <div><span>${item.name}</span><small class="text-muted d-block" style="font-size:0.75rem">${item.desc || ''}</small></div>
                                        <span>${item.value} <span class="badge bg-secondary">${item.grade}</span></span>
                                    </li>`).join('') : '<li class="list-group-item text-muted">無細項</li>'}
                            </ul>
                        </div>
                    </div>
                </div>`;
        });
        html += '</div>';
        document.getElementById('score-details-body').innerHTML = html;
        this.scoreModal.show();
    }

    async resetToPreSchedule(showConfirm = true) {
        if(showConfirm && !confirm("確定重置？將清除所有已排班別。")) return;
        const loading = document.getElementById('loading-indicator');
        if(loading) loading.style.display = 'block';
        try {
            const preSchedule = await PreScheduleService.getPreSchedule(this.state.currentUnitId, this.state.year, this.state.month);
            const newAssignments = {};
            this.state.staffList.forEach(s => { newAssignments[s.uid] = {}; });
            if (preSchedule && preSchedule.submissions) {
                Object.entries(preSchedule.submissions).forEach(([uid, sub]) => {
                    if(sub.wishes && newAssignments[uid]) {
                        Object.entries(sub.wishes).forEach(([d, w]) => { newAssignments[uid][d] = (w === 'M_OFF' ? 'OFF' : w); });
                    }
                });
            }
            this.state.scheduleData.assignments = newAssignments;
            await ScheduleService.updateAllAssignments(this.state.currentUnitId, this.state.year, this.state.month, newAssignments, this.state.scheduleData.prevAssignments);
            this.renderGrid();
            this.updateScoreDisplay();
            if(showConfirm) alert("✅ 已重置。");
        } catch(e) { console.error(e); alert("重置失敗"); } finally { if(loading) loading.style.display = 'none'; }
    }

    async togglePublish() {
        if(!this.state.scheduleData) return;
        const currentStatus = this.state.scheduleData.status;
        const newStatus = currentStatus === 'published' ? 'draft' : 'published';
        if(confirm(`確定要 ${newStatus==='published'?'發布':'撤回'} 嗎？`)) {
            await ScheduleService.updateStatus(this.state.currentUnitId, this.state.year, this.state.month, newStatus);
            this.state.scheduleData.status = newStatus;
            this.updateStatusBadge();
            alert(`班表已${newStatus==='published'?'發布':'撤回'}`);
        }
    }

    updateStatusBadge() {
        const badge = document.getElementById('schedule-status-badge');
        const btn = document.getElementById('btn-publish');
        if(!badge || !this.state.scheduleData) return;
        const status = this.state.scheduleData.status;
        if (status === 'published') {
            badge.className = 'badge bg-success'; badge.textContent = '已發布';
            if(btn) { btn.textContent = '撤回班表'; btn.classList.replace('btn-success', 'btn-warning'); }
        } else {
            badge.className = 'badge bg-secondary'; badge.textContent = '草稿';
            if(btn) { btn.textContent = '發布班表'; btn.classList.replace('btn-warning', 'btn-success'); }
        }
    }

    async runMultiVersionAI() {
        if (!confirm("確定執行智慧排班？\n系統將平行運算三種策略：\n1. 數值平衡 (A)\n2. 願望優先 (B)\n3. 規律作息 (C)")) return;
        
        this.versionsModal.show();
        const progressBar = document.getElementById('ai-progress-bar');
        const progressText = document.getElementById('ai-progress-text');
        const tabList = document.getElementById('versionTabs');
        const tabContent = document.getElementById('versionTabContent');
        const progressContainer = document.getElementById('ai-progress-container');

        progressContainer.style.display = 'block';
        tabList.style.display = 'none';
        tabContent.style.display = 'none';
        progressBar.style.width = '0%';

        try {
            this.generatedVersions = [];
            
            let prevY = this.state.year, prevM = this.state.month - 1;
            if(prevM===0) { prevM=12; prevY--; }
            
            let preScheduleData = { 
                assignments: this.state.scheduleData.prevAssignments || {},
                submissions: {} 
            };
            try {
                const rawPre = await PreScheduleService.getPreSchedule(this.state.currentUnitId, this.state.year, this.state.month);
                if(rawPre) preScheduleData.submissions = rawPre.submissions;
            } catch(e) {}

            const versions = [
                { code: 'A', name: '方案 A：數值平衡 (公平優先)' },
                { code: 'B', name: '方案 B：願望優先 (滿意度高)' },
                { code: 'C', name: '方案 C：規律作息 (減少換班)' }
            ];
            
            for (let i = 0; i < 3; i++) {
                const ver = versions[i];
                const percent = Math.round(((i+1) / 3) * 100);
                progressBar.style.width = `${percent}%`;
                progressText.textContent = `正在運算 ${ver.name}...`;
                
                const result = await AutoScheduler.run(
                    this.state.scheduleData, 
                    this.state.staffList, 
                    this.state.unitSettings, 
                    preScheduleData,
                    ver.code
                );
                
                const scoreData = { ...this.state.scheduleData, assignments: result.assignments };
                const scoreRes = ScoringService.calculate(scoreData, this.state.staffList, this.state.unitSettings, preScheduleData);
                
                this.generatedVersions.push({ 
                    id: i + 1, 
                    assignments: result.assignments, 
                    score: scoreRes,
                    label: ver.name,
                    logs: result.logs
                });
                
                await new Promise(r => setTimeout(r, 100));
            }

            progressContainer.style.display = 'none';
            tabList.style.display = 'flex';
            tabContent.style.display = 'block';
            this.renderVersionsModal();

        } catch (e) { 
            console.error(e);
            alert("演算失敗: " + e.message); 
            this.versionsModal.hide();
        }
    }

    renderVersionsModal() {
        this.generatedVersions.forEach((v, idx) => {
            const tabPane = document.getElementById(`v${v.id}`);
            if(!tabPane) return;
            
            const scoreColor = v.score.totalScore >= 80 ? 'text-success' : (v.score.totalScore >= 60 ? 'text-warning' : 'text-danger');
            
            let previewHtml = `
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <div>
                        <h4 class="${scoreColor} fw-bold mb-0">${v.score.totalScore} 分</h4>
                        <small class="text-muted">策略偏好：${v.label}</small>
                    </div>
                    <button class="btn btn-primary" onclick="window.routerPage.applyVersion(${idx})">
                        <i class="bi bi-check-lg"></i> 套用此版本
                    </button>
                </div>
                <div class="table-responsive border rounded" style="max-height: 400px;">
                    <table class="table table-sm table-bordered text-center mb-0" style="font-size:0.8rem;">
                        <thead class="bg-light sticky-top">
                            <tr>
                                <th style="background:#fff; z-index:20;">人員</th>
                                ${Array.from({length:this.state.daysInMonth},(_,i)=>`<th>${i+1}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${this.state.staffList.map(s => `
                                <tr>
                                    <td class="fw-bold bg-white sticky-col first-col" style="left:0;">${s.name}</td>
                                    ${Array.from({length:this.state.daysInMonth},(_,i)=>{
                                        const val = v.assignments[s.uid]?.[i+1] || '';
                                        let bg = '#fff', color = '#000';
                                        if(val==='OFF'||val==='M_OFF') { bg='#f0f0f0'; color='#ccc'; }
                                        else if(val==='N') { bg='#343a40'; color='#fff'; }
                                        else if(val==='E') { bg='#ffc107'; color='#000'; }
                                        else if(val==='D') { bg='#fff'; color='#0d6efd'; }
                                        
                                        return `<td style="background:${bg};color:${color}">${val}</td>`;
                                    }).join('')}
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="mt-3">
                    <h6 class="fw-bold border-bottom pb-2">評分細節</h6>
                    <div class="row g-2">
                        ${Object.values(v.score.details).map(d => 
                            `<div class="col-6 col-md-4">
                                <div class="d-flex justify-content-between border rounded p-2 bg-light">
                                    <span class="small">${d.label}</span> 
                                    <span class="fw-bold ${d.score < d.max * 0.6 ? 'text-danger' : 'text-success'}">
                                        ${Math.round(d.score)} / ${d.max}
                                    </span>
                                </div>
                             </div>`
                        ).join('')}
                    </div>
                </div>
            `;
            
            tabPane.innerHTML = previewHtml;
        });
    }

    async applyVersion(index) {
        const selected = this.generatedVersions[index];
        if (!selected) return;

        if(!confirm(`確定套用「版本 ${selected.id} (${selected.score.totalScore}分)」？\n這將覆蓋目前的排班表內容。`)) return;

        const loading = document.getElementById('loading-indicator');
        if(loading) loading.style.display = 'block';

        try {
            this.state.scheduleData.assignments = JSON.parse(JSON.stringify(selected.assignments));
            
            await ScheduleService.updateAllAssignments(
                this.state.currentUnitId, 
                this.state.year, 
                this.state.month, 
                this.state.scheduleData.assignments,
                this.state.scheduleData.prevAssignments
            );

            this.versionsModal.hide();
            this.renderGrid();
            this.updateScoreDisplay();
            
            alert(`✅ 已成功套用版本 ${selected.id}！`);
        } catch(e) {
            console.error(e);
            alert("套用失敗: " + e.message);
        } finally {
            if(loading) loading.style.display = 'none';
        }
    }
}
