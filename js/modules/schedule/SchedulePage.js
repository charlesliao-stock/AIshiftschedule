
import { UnitService } from "../../services/firebase/UnitService.js";
import { userService } from "../../services/firebase/UserService.js";
import { ScheduleService } from "../../services/firebase/ScheduleService.js";
import { PreScheduleService } from "../../services/firebase/PreScheduleService.js";
import { ScoringService } from "../../services/ScoringService.js";
import { RuleEngine } from "../ai/RuleEngine.js";
import { AutoScheduler } from "../ai/AutoScheduler.js";

export class SchedulePage {
    constructor() {
        this.state = {
            currentUnitId: null, year: null, month: null,
            unitSettings: null, staffList: [], 
            scheduleData: null, 
            daysInMonth: 0,
            scoreResult: null,
            sortKey: 'staffId', 
            sortAsc: true,
            unitMap: {},
            preSchedule: null 
        };
        this.versionsModal = null; 
        this.scoreModal = null;
        this.settingsModal = null; 
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
        const style = `
            <style>
                .schedule-table-wrapper { position: relative; max-height: 100%; width: 100%; overflow: auto; }
                .schedule-grid th, .schedule-grid td { vertical-align: middle; white-space: nowrap; padding: 2px 4px; height: 38px; border: 1px solid #dee2e6; }
                .sticky-col { position: sticky; z-index: 10; background-color: #fff; }
                .first-col { left: 0; z-index: 11; border-right: 2px solid #ccc !important; width: 60px; }
                .second-col { left: 60px; z-index: 11; width: 80px; }
                .third-col { left: 140px; z-index: 11; border-right: 2px solid #999 !important; width: 100px; max-width: 150px; overflow: hidden; text-overflow: ellipsis; }
                .right-col-1 { right: 0; z-index: 11; border-left: 2px solid #ccc !important; width: 45px; background-color: #fff; } 
                .right-col-2 { right: 45px; z-index: 11; width: 45px; background-color: #fff; }
                .right-col-3 { right: 90px; z-index: 11; width: 45px; background-color: #fff; }
                .right-col-4 { right: 135px; z-index: 11; border-left: 2px solid #999 !important; width: 45px; background-color: #fff; }
                thead .sticky-col { z-index: 15 !important; background-color: #f8f9fa; }
                .bg-light-gray { background-color: #f8f9fa !important; color: #aaa; }
                .cursor-pointer { cursor: pointer; }
                .shift-cell { cursor: pointer; transition: background 0.1s; }
                .shift-cell:hover { background-color: #e9ecef; }
                .stats-row td { background-color: #f8f9fa; font-weight: bold; border-top: 2px solid #666 !important; }
            </style>
        `;

        const params = new URLSearchParams(window.location.hash.split('?')[1]);
        this.state.currentUnitId = params.get('unitId');
        this.state.year = parseInt(params.get('year'));
        this.state.month = parseInt(params.get('month'));

        if(!this.state.currentUnitId) return `<div class="alert alert-danger m-4">無效的參數。</div>`;

        const modalHtml = `
            <div class="modal fade" id="settings-modal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header bg-secondary text-white">
                            <h5 class="modal-title"><i class="fas fa-sliders-h me-2"></i> 排班規則與策略設定</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <ul class="nav nav-tabs mb-3" id="settingTabs" role="tablist">
                                <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#tab-rules">一般規則</button></li>
                                <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#tab-strategies">AI 策略權重</button></li>
                            </ul>
                            
                            <form id="settings-form">
                                <div class="tab-content">
                                    <div class="tab-pane fade show active" id="tab-rules">
                                        <div class="card mb-3 border-left-danger">
                                            <div class="card-header bg-light fw-bold text-danger">1. 硬性規範 (Hard Constraints)</div>
                                            <div class="card-body bg-light">
                                                <div class="row g-3">
                                                    <div class="col-md-6">
                                                        <div class="form-check form-switch">
                                                            <input class="form-check-input" type="checkbox" id="set-interval-11h" checked disabled>
                                                            <label class="form-check-label fw-bold">班距 > 11 小時 (強制)</label>
                                                        </div>
                                                    </div>
                                                    <div class="col-md-6">
                                                        <label class="form-label fw-bold">週班種上限</label>
                                                        <select class="form-select bg-white" id="set-weekly-limit" disabled>
                                                            <option value="2" selected>最多 2 種 (強制)</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div class="card mb-3 border-left-primary">
                                            <div class="card-header bg-light fw-bold text-primary">2. 單位原則 (Unit Rules)</div>
                                            <div class="card-body">
                                                <div class="row g-3">
                                                    <div class="col-md-6">
                                                        <label class="form-label fw-bold">月班種上限</label>
                                                        <select class="form-select" id="set-monthly-limit">
                                                            <option value="2">最多 2 種</option>
                                                            <option value="3">最多 3 種</option>
                                                        </select>
                                                    </div>
                                                    <div class="col-md-6 d-flex align-items-center">
                                                        <div class="form-check ms-2">
                                                            <input class="form-check-input" type="checkbox" id="set-month-continuity">
                                                            <label class="form-check-label"><strong>月初接班：</strong>可順接上月</label>
                                                        </div>
                                                    </div>
                                                    <div class="col-md-6">
                                                        <label class="form-label fw-bold">連續上班上限</label>
                                                        <div class="input-group">
                                                            <input type="number" class="form-control" id="set-max-consecutive" value="6" min="1" max="14">
                                                            <span class="input-group-text">天</span>
                                                        </div>
                                                    </div>
                                                    <div class="col-md-6">
                                                        <div class="form-check mt-4">
                                                            <input class="form-check-input" type="checkbox" id="set-allow-long-leave">
                                                            <label class="form-check-label fw-bold">長假例外 (可連7)</label>
                                                        </div>
                                                    </div>
                                                    <div class="col-md-6">
                                                        <label class="form-label fw-bold text-danger">重平衡嘗試次數</label>
                                                        <input type="number" class="form-control" id="set-rebalance-loop" value="3" min="1" max="10">
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="tab-pane fade" id="tab-strategies">
                                        <div class="alert alert-info py-2 small"><i class="fas fa-info-circle"></i> 調整各策略的評分權重，數值越高代表 AI 越重視該項目。</div>
                                        
                                        <h6 class="fw-bold text-primary mt-3">方案 A：數值平衡 (公平優先)</h6>
                                        <div class="card card-body bg-light mb-3 py-2">
                                            <div class="row align-items-center">
                                                <div class="col-4"><label class="small fw-bold">超額上班扣分</label></div>
                                                <div class="col-8"><input type="range" class="form-range" id="w-a-over" min="-500" max="-10" step="10"></div>
                                                <div class="col-12 form-text mt-0">數值越低(負越多)，越強制平均分配班數。</div>
                                            </div>
                                        </div>

                                        <h6 class="fw-bold text-success mt-3">方案 B：願望優先 (滿意度高)</h6>
                                        <div class="card card-body bg-light mb-3 py-2">
                                            <div class="row align-items-center mb-2">
                                                <div class="col-4"><label class="small fw-bold">第一志願 (P1) 加分</label></div>
                                                <div class="col-8"><input type="range" class="form-range" id="w-b-p1" min="1000" max="10000" step="500"></div>
                                            </div>
                                            <div class="row align-items-center">
                                                <div class="col-4"><label class="small fw-bold">第二志願 (P2) 加分</label></div>
                                                <div class="col-8"><input type="range" class="form-range" id="w-b-p2" min="500" max="5000" step="100"></div>
                                            </div>
                                        </div>

                                        <h6 class="fw-bold text-warning mt-3">方案 C：規律作息 (減少換班)</h6>
                                        <div class="card card-body bg-light mb-3 py-2">
                                            <div class="row align-items-center mb-2">
                                                <div class="col-4"><label class="small fw-bold">連續班別獎勵</label></div>
                                                <div class="col-8"><input type="range" class="form-range" id="w-c-continuity" min="100" max="2000" step="100"></div>
                                            </div>
                                            <div class="row align-items-center">
                                                <div class="col-4"><label class="small fw-bold">頻繁換班懲罰</label></div>
                                                <div class="col-8"><input type="range" class="form-range" id="w-c-pattern" min="-500" max="-10" step="10"></div>
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
                        <button id="btn-settings" class="btn btn-outline-secondary" title="設定"><i class="fas fa-cog"></i> 設定</button>
                        <button id="btn-auto-schedule" class="btn btn-outline-primary"><i class="bi bi-robot"></i> AI 排班</button>
                        <button id="btn-clear" class="btn btn-outline-danger"><i class="bi bi-arrow-counterclockwise"></i> 重置</button>
                        <button id="btn-publish" class="btn btn-success"><i class="bi bi-check-circle"></i> 發布班表</button>
                    </div>
                </div>
                <div class="flex-grow-1 overflow-auto bg-light p-3" id="schedule-grid-container"></div>
            </div>
            <div class="modal fade" id="score-modal" tabindex="-1"><div class="modal-dialog modal-lg modal-dialog-scrollable"><div class="modal-content"><div class="modal-header bg-success text-white"><h5 class="modal-title">排班品質評分報告</h5><button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div><div class="modal-body" id="score-details-body"></div></div></div></div>
            <div class="modal fade" id="versions-modal" tabindex="-1"><div class="modal-dialog modal-xl modal-dialog-scrollable"><div class="modal-content"><div class="modal-header"><h5 class="modal-title">AI 智慧排班結果選擇</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div><div class="modal-body"><div id="ai-progress-container" class="mb-3" style="display:none;"><div id="ai-progress-text" class="mb-1 text-primary">正在運算中...</div><div class="progress"><div id="ai-progress-bar" class="progress-bar progress-bar-striped progress-bar-animated" style="width: 0%"></div></div></div><ul class="nav nav-tabs" id="versionTabs" role="tablist"><li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#v1">版本 1</button></li><li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#v2">版本 2</button></li><li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#v3">版本 3</button></li></ul><div class="tab-content p-3 border border-top-0" id="versionTabContent"><div class="tab-pane fade show active" id="v1"></div><div class="tab-pane fade" id="v2"></div><div class="tab-pane fade" id="v3"></div></div></div></div></div></div>
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
        document.getElementById('btn-settings').addEventListener('click', () => this.openSettingsModal());

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
        // ... (保持原樣)
        const container = document.getElementById('schedule-grid-container');
        const loading = document.getElementById('loading-indicator');
        if(loading) loading.style.display = 'block';
        try {
            const preSchedule = await PreScheduleService.getPreSchedule(this.state.currentUnitId, this.state.year, this.state.month);
            this.state.preSchedule = preSchedule; 
            let staffList = [];
            if (preSchedule && preSchedule.staffSnapshots && preSchedule.staffSnapshots.length > 0) {
                staffList = preSchedule.staffSnapshots;
            } else if (preSchedule && preSchedule.staffIds && preSchedule.staffIds.length > 0) {
                const promises = preSchedule.staffIds.map(uid => userService.getUserData(uid));
                const users = await Promise.all(promises);
                staffList = users.filter(u => u);
            } else {
                staffList = await userService.getUnitStaff(this.state.currentUnitId);
            }
            const [unit, schedule, allUnits] = await Promise.all([
                UnitService.getUnitByIdWithCache(this.state.currentUnitId),
                ScheduleService.getSchedule(this.state.currentUnitId, this.state.year, this.state.month),
                UnitService.getAllUnits()
            ]);
            this.state.unitSettings = unit;
            this.state.staffList = staffList;
            this.state.daysInMonth = new Date(this.state.year, this.state.month, 0).getDate();
            this.state.unitMap = {};
            if (allUnits) { allUnits.forEach(u => this.state.unitMap[u.unitId] = u.unitName); }
            if (!schedule) {
                const newSched = await ScheduleService.createEmptySchedule(this.state.currentUnitId, this.state.year, this.state.month, staffList.map(s=>s.uid));
                this.state.scheduleData = newSched;
                await this.resetToPreSchedule(false);
            } else {
                this.state.scheduleData = schedule;
                this.renderGrid();
                this.updateStatusBadge();
                this.updateScoreDisplay();
            }
        } catch (error) { console.error(error); } finally { if(loading) loading.style.display = 'none'; }
    }

    openSettingsModal() {
        const rules = this.state.unitSettings?.settings?.rules || {};
        const constraints = rules.constraints || {};
        const weights = this.state.unitSettings?.settings?.strategyWeights || {};

        document.getElementById('set-interval-11h').checked = true; 
        document.getElementById('set-weekly-limit').value = "2";
        document.getElementById('set-max-consecutive').value = rules.maxConsecutiveWork || 6;
        document.getElementById('set-allow-long-leave').checked = !!constraints.allowLongLeaveException;
        document.getElementById('set-rebalance-loop').value = rules.rebalanceLoop || 3;
        
        document.getElementById('set-monthly-limit').value = constraints.monthlyShiftLimit || "2"; 
        document.getElementById('set-month-continuity').checked = !!constraints.allowMonthContinuity;

        // 填入策略權重 (若無則使用預設)
        document.getElementById('w-a-over').value = weights.A_overStaffed || -20;
        document.getElementById('w-b-p1').value = weights.B_p1 || 5000;
        document.getElementById('w-b-p2').value = weights.B_p2 || 2000;
        document.getElementById('w-c-continuity').value = weights.C_continuity || 500;
        document.getElementById('w-c-pattern').value = weights.C_pattern || -100;

        this.settingsModal.show();
    }

    async saveSettings() {
        const currentRules = this.state.unitSettings?.settings?.rules || {};
        const newRules = {
            ...currentRules,
            maxConsecutiveWork: parseInt(document.getElementById('set-max-consecutive').value),
            rebalanceLoop: parseInt(document.getElementById('set-rebalance-loop').value),
            constraints: {
                ...currentRules.constraints,
                minInterval11h: true, 
                weeklyShiftLimit: 2, 
                monthlyShiftLimit: parseInt(document.getElementById('set-monthly-limit').value),
                allowMonthContinuity: document.getElementById('set-month-continuity').checked,
                allowLongLeaveException: document.getElementById('set-allow-long-leave').checked,
            }
        };

        // 收集策略權重
        const strategyWeights = {
            A_overStaffed: parseInt(document.getElementById('w-a-over').value),
            B_p1: parseInt(document.getElementById('w-b-p1').value),
            B_p2: parseInt(document.getElementById('w-b-p2').value),
            C_continuity: parseInt(document.getElementById('w-c-continuity').value),
            C_pattern: parseInt(document.getElementById('w-c-pattern').value)
        };

        try {
            const currentSettings = this.state.unitSettings.settings || {};
            const updatedSettings = {
                ...currentSettings,
                rules: newRules,
                strategyWeights: strategyWeights // 儲存權重
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
        // ... (保持原樣，包含紅框邏輯)
        const container = document.getElementById('schedule-grid-container');
        const { year, month, daysInMonth, staffList, scheduleData, sortKey, sortAsc, unitMap, currentUnitId, preSchedule } = this.state;
        const assignments = scheduleData.assignments || {};
        const prevAssignments = scheduleData.prevAssignments || {};

        staffList.sort((a, b) => {
            let valA = '', valB = '';
            if (sortKey === 'staffId') {
                valA = a.staffId || ''; valB = b.staffId || '';
            } else if (sortKey === 'name') {
                valA = a.name || ''; valB = b.name || '';
            } else {
                valA = a.id || ''; valB = b.id || '';
            }
            if (valA < valB) return sortAsc ? -1 : 1;
            if (valA > valB) return sortAsc ? 1 : -1;
            return 0;
        });

        const getArrow = (key) => (sortKey === key ? (sortAsc ? '▲' : '▼') : '');
        const getDisplayName = (staff) => {
            if (!staff.unitId || staff.unitId === currentUnitId) return staff.name;
            const uName = unitMap[staff.unitId] || '外借';
            return `${staff.name}<span class="text-danger small ms-1">(${uName})</span>`;
        };
        const getNoteContent = (staff) => {
            let parts = [];
            const sub = preSchedule?.submissions?.[staff.uid];
            if (sub?.notes) parts.push(sub.notes);
            if (sub?.preferences) {
                const p = sub.preferences;
                let prefStr = '';
                if (p.batch) prefStr += `[包${p.batch}] `;
                let ranks = [];
                if (p.priority1) ranks.push(p.priority1);
                if (p.priority2) ranks.push(p.priority2);
                if (ranks.length > 0) prefStr += ranks.join('>');
                if (prefStr) parts.push(prefStr);
            }
            if (staff.note) parts.push(staff.note);
            return parts.join(' | ');
        };

        const dailyStats = [];
        const reqMatrix = this.state.unitSettings?.staffRequirements || { D:[], E:[], N:[] };
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month - 1, d);
            const w = date.getDay();
            let counts = { D:0, E:0, N:0, OFF:0 };
            staffList.forEach(s => {
                const shift = assignments[s.uid]?.[d];
                if (shift && counts[shift] !== undefined) counts[shift]++;
                else if (shift === 'M_OFF') counts['OFF']++;
            });
            const reqD = reqMatrix.D?.[w] || 0;
            const reqE = reqMatrix.E?.[w] || 0;
            const reqN = reqMatrix.N?.[w] || 0;
            const hasError = (counts.D < reqD) || (counts.E < reqE) || (counts.N < reqN);
            const errorStyle = hasError ? 'border: 3px solid #dc3545 !important; background-color: #ffe6e6 !important;' : '';
            dailyStats[d] = {
                counts,
                style: errorStyle, 
                html: `<div style="font-size:0.6rem; line-height:1.1;">
                        <span class="${counts.D < reqD ? 'text-danger fw-bold' : (counts.D > reqD ? 'text-warning' : '')}">D:${counts.D}/${reqD}</span><br>
                        <span class="${counts.E < reqE ? 'text-danger fw-bold' : (counts.E > reqE ? 'text-warning' : '')}">E:${counts.E}/${reqE}</span><br>
                        <span class="${counts.N < reqN ? 'text-danger fw-bold' : (counts.N > reqN ? 'text-warning' : '')}">N:${counts.N}/${reqN}</span>
                    </div>`
            };
        }

        let html = `<div class="schedule-table-wrapper shadow-sm bg-white rounded"><table class="schedule-grid"><thead class="bg-light"><tr>
            <th class="sticky-col first-col cursor-pointer" onclick="window.routerPage.sortStaff('staffId')">職編 ${getArrow('staffId')}</th>
            <th class="sticky-col second-col cursor-pointer" onclick="window.routerPage.sortStaff('name')">姓名 ${getArrow('name')}</th>
            <th class="sticky-col third-col">備註</th>`;
        
        const prevMonthLastDate = new Date(year, month - 1, 0); 
        const prevDaysToShow = [];
        for(let i=5; i>=0; i--) { prevDaysToShow.push(prevMonthLastDate.getDate() - i); }
        prevDaysToShow.forEach(d => html += `<th class="text-muted bg-light-gray" style="font-size:0.8rem">${d}</th>`);
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month - 1, d);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const weekStr = ['日','一','二','三','四','五','六'][date.getDay()];
            const headerStyle = dailyStats[d].style ? 'border-bottom: 3px solid red;' : '';
            html += `<th class="${isWeekend?'text-danger':''}" style="font-size:0.9rem; ${headerStyle}">${d}<div style="font-size:0.7rem">${weekStr}</div></th>`;
        }
        html += `<th class="sticky-col right-col-4 text-primary">OFF</th><th class="sticky-col right-col-3">小夜</th><th class="sticky-col right-col-2">大夜</th><th class="sticky-col right-col-1">假日</th></tr></thead><tbody>`;
        
        staffList.forEach(staff => {
            const uid = staff.uid;
            const userShifts = assignments[uid] || {};
            const prevUserShifts = prevAssignments[uid] || {};
            const stats = this.calculateRowStats(userShifts);
            const noteText = getNoteContent(staff);
            html += `<tr><td class="sticky-col first-col fw-bold">${staff.staffId || staff.id || ''}</td>
                    <td class="sticky-col second-col text-nowrap">${getDisplayName(staff)}</td>
                    <td class="sticky-col third-col small text-muted text-truncate" title="${noteText}">${noteText}</td>`;
            prevDaysToShow.forEach(d => { html += `<td class="bg-light-gray text-muted small">${prevUserShifts[d] || '-'}</td>`; });
            for (let d = 1; d <= daysInMonth; d++) {
                const val = userShifts[d] || '';
                html += `<td class="shift-cell" data-staff-id="${uid}" data-day="${d}" onclick="window.routerPage.openShiftMenu(this)" style="${val==='OFF'?'background:#f0f0f0':''}">${val}</td>`;
            }
            html += `<td class="sticky-col right-col-4 fw-bold text-primary" id="stat-off-${uid}">${stats.off}</td><td class="sticky-col right-col-3" id="stat-e-${uid}">${stats.e}</td><td class="sticky-col right-col-2" id="stat-n-${uid}">${stats.n}</td><td class="sticky-col right-col-1" id="stat-hol-${uid}">${stats.hol}</td></tr>`;
        });

        html += `<tr class="stats-row"><td class="sticky-col first-col">統計</td><td class="sticky-col second-col">每日人力</td><td class="sticky-col third-col"></td>`;
        prevDaysToShow.forEach(() => html += `<td></td>`);
        for (let d = 1; d <= daysInMonth; d++) {
            html += `<td class="p-1" style="${dailyStats[d].style}">${dailyStats[d].html}</td>`;
        }
        html += `<td colspan="4"></td></tr></tbody></table></div>`;
        container.innerHTML = html;
    }

    // ... (其他方法如 calculateRowStats, sortStaff, openShiftMenu 等保持不變，為節省空間省略)
    calculateRowStats(shifts) { /*...*/ let off=0,e=0,n=0,hol=0;const{year,month,daysInMonth}=this.state;for(let d=1;d<=daysInMonth;d++){const s=shifts[d];if(!s)continue;if(['OFF','M_OFF'].includes(s))off++;if(s==='E')e++;if(s==='N')n++;const date=new Date(year,month-1,d);const w=date.getDay();if((w===0||w===6)&&!['OFF','M_OFF'].includes(s))hol++;}return{off,e,n,hol}; }
    sortStaff(key) { /*...*/ if(this.state.sortKey===key)this.state.sortAsc=!this.state.sortAsc;else{this.state.sortKey=key;this.state.sortAsc=true;}this.renderGrid(); }
    openShiftMenu(cell) { /*...*/ const shifts=this.state.unitSettings?.settings?.shifts||[{code:'D',name:'白',color:'#fff'},{code:'E',name:'小',color:'#fff'},{code:'N',name:'大',color:'#fff'}];this.closeMenu();const menu=document.createElement('div');menu.className='shift-menu shadow rounded border bg-white';menu.style.position='absolute';menu.style.zIndex='1000';menu.style.padding='5px';const renderItem=(s)=>{const item=document.createElement('div');item.className='p-1';item.style.cursor='pointer';item.innerHTML=`<span style="display:inline-block;width:15px;height:15px;background:${s.color};border:1px solid #ddd;margin-right:5px;"></span> ${s.code}`;item.onclick=()=>this.handleShiftSelect(cell,s.code);menu.appendChild(item);};renderItem({code:'',name:'清除',color:'#fff'});renderItem({code:'OFF',name:'休假',color:'#eee'});shifts.forEach(s=>renderItem(s));const rect=cell.getBoundingClientRect();menu.style.top=`${rect.bottom+window.scrollY}px`;menu.style.left=`${rect.left+window.scrollX}px`;document.body.appendChild(menu);this.state.activeMenu=menu; }
    async handleShiftSelect(cell,code) { /*...*/ this.closeMenu();const uid=cell.dataset.staffId;const day=cell.dataset.day;if(!this.state.scheduleData.assignments[uid])this.state.scheduleData.assignments[uid]={};this.state.scheduleData.assignments[uid][day]=code;cell.textContent=code;cell.style.background=code==='OFF'?'#f0f0f0':'';const stats=this.calculateRowStats(this.state.scheduleData.assignments[uid]);document.getElementById(`stat-off-${uid}`).textContent=stats.off;document.getElementById(`stat-e-${uid}`).textContent=stats.e;document.getElementById(`stat-n-${uid}`).textContent=stats.n;document.getElementById(`stat-hol-${uid}`).textContent=stats.hol;await ScheduleService.updateShift(this.state.currentUnitId,this.state.year,this.state.month,uid,day,code);this.updateScoreDisplay(); }
    async updateScoreDisplay() { /*...*/ if(!this.state.scheduleData?.assignments)return;const pre=await PreScheduleService.getPreSchedule(this.state.currentUnitId,this.state.year,this.state.month);const res=ScoringService.calculate(this.state.scheduleData,this.state.staffList,this.state.unitSettings,{...pre,assignments:this.state.scheduleData.prevAssignments});this.state.scoreResult=res;const el=document.getElementById('score-display');if(el){el.textContent=res.totalScore;el.className=`h4 mb-0 fw-bold ${res.totalScore>=80?'text-success':(res.totalScore>=60?'text-warning':'text-danger')}`;} }
    showScoreDetails() { /*...*/ if(!this.state.scoreResult)return alert("無分數");const d=this.state.scoreResult.details;let h='<div class="accordion" id="scoreAccordion">';Object.entries(d).forEach(([k,c],i)=>{h+=`<div class="accordion-item"><h2 class="accordion-header"><button class="accordion-button ${i===0?'':'collapsed'}" type="button" data-bs-toggle="collapse" data-bs-target="#c-${k}"><div class="d-flex w-100 justify-content-between me-3"><span>${c.label}</span><span class="badge bg-primary rounded-pill">${Math.round(c.score)}</span></div></button></h2><div id="c-${k}" class="accordion-collapse collapse ${i===0?'show':''}"><div class="accordion-body"><ul class="list-group list-group-flush">${c.subItems?c.subItems.map(m=>`<li class="list-group-item d-flex justify-content-between"><span>${m.name}</span><span>${m.value}</span></li>`).join(''):''}</ul></div></div></div>`;});h+='</div>';document.getElementById('score-details-body').innerHTML=h;this.scoreModal.show(); }
    async resetToPreSchedule(c=true) { /*...*/ if(c&&!confirm("確定重置？"))return;const l=document.getElementById('loading-indicator');if(l)l.style.display='block';try{const pre=await PreScheduleService.getPreSchedule(this.state.currentUnitId,this.state.year,this.state.month);const newAssign={};this.state.staffList.forEach(s=>{newAssign[s.uid]={};});if(pre?.submissions)Object.entries(pre.submissions).forEach(([u,s])=>{if(s.wishes&&newAssign[u])Object.entries(s.wishes).forEach(([d,w])=>{newAssign[u][d]=(w==='M_OFF'?'OFF':w);});});this.state.scheduleData.assignments=newAssign;await ScheduleService.updateAllAssignments(this.state.currentUnitId,this.state.year,this.state.month,newAssign,this.state.scheduleData.prevAssignments);this.renderGrid();this.updateScoreDisplay();if(c)alert("已重置");}catch(e){console.error(e);}finally{if(l)l.style.display='none';} }
    async togglePublish() { /*...*/ if(!this.state.scheduleData)return;const s=this.state.scheduleData.status==='published'?'draft':'published';if(confirm("確定變更狀態？")){await ScheduleService.updateStatus(this.state.currentUnitId,this.state.year,this.state.month,s);this.state.scheduleData.status=s;this.updateStatusBadge();alert("已更新");} }
    updateStatusBadge() { /*...*/ const b=document.getElementById('schedule-status-badge');const btn=document.getElementById('btn-publish');if(!b||!this.state.scheduleData)return;const s=this.state.scheduleData.status;if(s==='published'){b.className='badge bg-success';b.textContent='已發布';if(btn){btn.textContent='撤回';btn.classList.replace('btn-success','btn-warning');}}else{b.className='badge bg-secondary';b.textContent='草稿';if(btn){btn.textContent='發布';btn.classList.replace('btn-warning','btn-success');}} }
    async runMultiVersionAI() { /*...*/ if(!confirm("AI 排班？"))return;this.versionsModal.show();document.getElementById('ai-progress-container').style.display='block';try{this.generatedVersions=[];let pre={assignments:this.state.scheduleData.prevAssignments||{},submissions:{}};try{const raw=await PreScheduleService.getPreSchedule(this.state.currentUnitId,this.state.year,this.state.month);if(raw)pre.submissions=raw.submissions;}catch(e){}const vers=[{c:'A',n:'數值平衡'},{c:'B',n:'願望優先'},{c:'C',n:'規律作息'}];for(let i=0;i<3;i++){const res=await AutoScheduler.run(this.state.scheduleData,this.state.staffList,this.state.unitSettings,pre,vers[i].c);const score=ScoringService.calculate({...this.state.scheduleData,assignments:res.assignments},this.state.staffList,this.state.unitSettings,pre);this.generatedVersions.push({id:i+1,assignments:res.assignments,score,label:vers[i].n});await new Promise(r=>setTimeout(r,100));}document.getElementById('ai-progress-container').style.display='none';document.getElementById('versionTabs').style.display='flex';document.getElementById('versionTabContent').style.display='block';this.renderVersionsModal();}catch(e){alert("失敗:"+e.message);this.versionsModal.hide();} }
    renderVersionsModal() { /*...*/ this.generatedVersions.forEach((v,i)=>{const p=document.getElementById(`v${v.id}`);if(!p)return;let h=`<div class="d-flex justify-content-between mb-3"><h4>${v.score.totalScore}分</h4><button class="btn btn-primary" onclick="window.routerPage.applyVersion(${i})">套用</button></div><div class="table-responsive border rounded" style="max-height:400px;"><table class="table table-sm table-bordered text-center mb-0" style="font-size:0.8rem;"><thead class="bg-light sticky-top"><tr><th>人員</th>${Array.from({length:this.state.daysInMonth},(_,k)=>`<th>${k+1}</th>`).join('')}</tr></thead><tbody>${this.state.staffList.map(s=>`<tr><td class="fw-bold bg-white sticky-col first-col" style="left:0;">${s.name}</td>${Array.from({length:this.state.daysInMonth},(_,k)=>{const val=v.assignments[s.uid]?.[k+1]||'';let bg='#fff',color='#000';if(val==='OFF'||val==='M_OFF'){bg='#f0f0f0';color='#ccc';}else if(val==='N'){bg='#343a40';color='#fff';}else if(val==='E'){bg='#ffc107';color='#000';}else if(val==='D'){bg='#fff';color='#0d6efd';}return `<td style="background:${bg};color:${color}">${val}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div>`;p.innerHTML=h;}); }
    async applyVersion(i) { /*...*/ const v=this.generatedVersions[i];if(!v)return;if(confirm("套用？")){this.state.scheduleData.assignments=JSON.parse(JSON.stringify(v.assignments));await ScheduleService.updateAllAssignments(this.state.currentUnitId,this.state.year,this.state.month,this.state.scheduleData.assignments,this.state.scheduleData.prevAssignments);this.versionsModal.hide();this.renderGrid();this.updateScoreDisplay();alert("已套用");} }
}
