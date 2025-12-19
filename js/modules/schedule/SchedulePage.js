import { UnitService } from "../../services/firebase/UnitService.js";
import { userService } from "../../services/firebase/UserService.js";
import { ScheduleService } from "../../services/firebase/ScheduleService.js";
import { PreScheduleService } from "../../services/firebase/PreScheduleService.js";
import { ScoringService } from "../../services/ScoringService.js";

// 引用 AI 模組
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
        
        // ✅ 修正點 1：確保 handleGlobalClick 存在後再 bind
        this.handleGlobalClick = this.handleGlobalClick.bind(this);
    }

    // ✅ 修正點 2：補上漏掉的方法
    handleGlobalClick(e) {
        // 如果未來有點擊空白處關閉選單的需求，寫在這裡
        // 目前保留空函式以防止 bind 報錯
    }

    cleanup() {
        document.removeEventListener('click', this.handleGlobalClick);
        // this.closeMenu(); // 若無此方法可註解掉
        const backdrops = document.querySelectorAll('.modal-backdrop');
        backdrops.forEach(b => b.remove());
    }

    async render() {
        const style = `
            <style>
                .schedule-table-wrapper { position: relative; max-height: 100%; width: 100%; overflow: auto; }
                .schedule-grid th, .schedule-grid td { vertical-align: middle; white-space: nowrap; padding: 2px 4px; height: 38px; border-color: #dee2e6; }
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
                .shift-input:focus { background-color: #e8f0fe !important; font-weight: bold; outline: none; }
                .cursor-pointer { cursor: pointer; }
                .shift-cell { cursor: pointer; transition: background 0.1s; }
                .shift-cell:hover { background-color: #e9ecef; }
                .sort-icon { font-size: 0.7rem; margin-left: 2px; color: #666; }
                .stats-row td { background-color: #f8f9fa; font-weight: bold; border-top: 2px solid #666 !important; }
            </style>
        `;

        const params = new URLSearchParams(window.location.hash.split('?')[1]);
        this.state.currentUnitId = params.get('unitId');
        this.state.year = parseInt(params.get('year'));
        this.state.month = parseInt(params.get('month'));

        if(!this.state.currentUnitId) return `<div class="alert alert-danger m-4">無效的參數。</div>`;

        // ✅ 修正點 3：補上 settings-modal 的 HTML 結構
        const modalHtml = `
            <div class="modal fade" id="versions-modal" tabindex="-1">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title"><i class="fas fa-robot me-2"></i>AI 智慧排班結果選擇</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" id="versions-modal-body">
                            </div>
                    </div>
                </div>
            </div>
            <div class="modal fade" id="score-modal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header bg-success text-white">
                            <h5 class="modal-title"><i class="fas fa-star me-2"></i>排班品質評分細節</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" id="score-modal-body">
                            </div>
                    </div>
                </div>
            </div>
            <div class="modal fade" id="settings-modal" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">規則與評分設定</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div id="rule-settings-container-modal"></div>
                    </div>
                </div>
            </div>
        `;

        return `
            ${style}
            ${modalHtml}
            <div class="container-fluid mt-4">
                <div class="d-flex justify-content-between align-items-center mb-3">
                    <h3 class="text-gray-800 fw-bold"><i class="fas fa-calendar-alt"></i> 排班作業：<span id="schedule-title">載入中...</span></h3>
                    <div class="d-flex gap-2">
                        <button id="btn-settings" class="btn btn-secondary shadow-sm" onclick="window.routerPage.openSettingsModal()">
                            <i class="fas fa-cog"></i> 規則與評分設定
                        </button>
                        <button id="btn-ai-schedule" class="btn btn-primary shadow-sm" onclick="window.routerPage.openVersionsModal()">
                            <i class="fas fa-robot"></i> AI 智慧排班
                        </button>
                        <button id="btn-save" class="btn btn-success shadow-sm" onclick="window.routerPage.saveSchedule()">
                            <i class="fas fa-save"></i> 儲存排班
                        </button>
                    </div>
                </div>
                
                <div id="schedule-container" class="card shadow mb-4">
                    <div class="card-body p-0">
                        <div class="schedule-table-wrapper">
                            <table class="table table-bordered schedule-grid mb-0">
                                <thead id="schedule-thead"></thead>
                                <tbody id="schedule-tbody"></tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async afterRender() {
        window.routerPage = this; 
        this.versionsModal = new bootstrap.Modal(document.getElementById('versions-modal'));
        this.scoreModal = new bootstrap.Modal(document.getElementById('score-modal'));
        
        // 確保 settings-modal 存在後再初始化
        const settingsEl = document.getElementById('settings-modal');
        if (settingsEl) {
            this.settingsModal = new bootstrap.Modal(settingsEl);
        }
        
        await this.loadData();
        this.renderSchedule();
        this.attachEvents();
    }

    async loadData() {
        const { currentUnitId, year, month } = this.state;
        
        // 1. 載入單位設定
        this.state.unitSettings = await UnitService.getUnitSettings(currentUnitId);
        
        // 2. 載入員工列表
        this.state.staffList = await userService.getStaffListByUnit(currentUnitId);
        
        // 3. 載入預排班表 (Pre-Schedule)
        this.state.preSchedule = await PreScheduleService.getPreSchedule(currentUnitId, year, month);
        
        // 4. 載入排班表
        this.state.scheduleData = await ScheduleService.getSchedule(currentUnitId, year, month);
        if (!this.state.scheduleData) {
            this.state.scheduleData = {
                unitId: currentUnitId, year, month,
                assignments: {},
                logs: [],
                version: 0,
                activeVersion: 0
            };
        }
        
        // 5. 計算天數
        this.state.daysInMonth = new Date(year, month, 0).getDate();
        
        // 6. 更新標題
        const unitName = this.state.unitSettings.unitName || '未命名單位';
        document.getElementById('schedule-title').textContent = `${unitName} ${year}年${month}月`;
    }

    renderSchedule() {
        const { staffList, scheduleData, daysInMonth, unitSettings } = this.state;
        const staffMap = {};
        staffList.forEach(s => staffMap[s.uid] = s);

        // 排序員工列表
        staffList.sort((a, b) => {
            const valA = a[this.state.sortKey] || '';
            const valB = b[this.state.sortKey] || '';
            if (valA < valB) return this.state.sortAsc ? -1 : 1;
            if (valA > valB) return this.state.sortAsc ? 1 : -1;
            return 0;
        });

        // 渲染表頭
        const thead = document.getElementById('schedule-thead');
        if(thead) thead.innerHTML = this.renderHeader(daysInMonth);

        // 渲染表身
        const tbody = document.getElementById('schedule-tbody');
        if(tbody) {
            tbody.innerHTML = staffList.map(staff => this.renderStaffRow(staff, scheduleData.assignments[staff.uid] || {}, daysInMonth, unitSettings)).join('');
            // 渲染統計行
            tbody.innerHTML += this.renderStatsRow(daysInMonth, scheduleData.assignments, unitSettings);
        }

        // 重新計算評分
        this.calculateScore();
    }

    renderHeader(daysInMonth) {
        let html = `<tr>
            <th class="sticky-col first-col cursor-pointer" data-sort="staffId">ID <i class="fas fa-sort sort-icon"></i></th>
            <th class="sticky-col second-col cursor-pointer" data-sort="name">姓名 <i class="fas fa-sort sort-icon"></i></th>
            <th class="sticky-col third-col">備註</th>
        `;
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(this.state.year, this.state.month - 1, d);
            const dayOfWeek = date.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            html += `<th class="${isWeekend ? 'bg-light-gray' : ''}">${d}</th>`;
        }
        html += `<th class="sticky-col right-col-4">總時</th>
                 <th class="sticky-col right-col-3">夜班</th>
                 <th class="sticky-col right-col-2">休假</th>
                 <th class="sticky-col right-col-1">違規</th>
                 </tr>`;
        return html;
    }

    renderStaffRow(staff, assignments, daysInMonth, unitSettings) {
        const uid = staff.uid;
        let html = `<tr>
            <td class="sticky-col first-col">${staff.staffId}</td>
            <td class="sticky-col second-col">${staff.name}</td>
            <td class="sticky-col third-col small text-truncate" title="${staff.constraints?.isPregnant ? '懷孕' : ''}">${staff.constraints?.isPregnant ? '🤰' : ''}</td>
        `;
        
        let totalHours = 0;
        let totalNights = 0;
        let totalOff = 0;
        let violationCount = 0;

        for (let d = 1; d <= daysInMonth; d++) {
            const shift = assignments[d] || '';
            const date = new Date(this.state.year, this.state.month - 1, d);
            const dayOfWeek = date.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const shiftClass = this.getShiftClass(shift);
            
            // 計算統計數據
            if (shift === 'OFF' || shift === 'M_OFF') {
                totalOff++;
            } else if (shift) {
                const shiftDef = unitSettings.settings?.shifts?.find(s => s.code === shift);
                const hours = parseFloat(shiftDef?.hours || 0);
                totalHours += hours;
                if (shift === 'N' || shift === 'E') totalNights++;
            }

            // 檢查單日違規 (僅檢查硬性規則)
            // 這裡假設 RuleEngine.validateStaff 可用，若無則跳過
            if (typeof RuleEngine !== 'undefined') {
                const validation = RuleEngine.validateStaff(assignments, d, unitSettings.settings?.shifts, unitSettings.rules, staff.constraints, assignments[0], staff.lastMonthConsecutive, d);
                if (validation.errors[d]) violationCount++;
            }

            html += `<td class="shift-cell ${shiftClass} ${isWeekend ? 'bg-light-gray' : ''}" data-uid="${uid}" data-day="${d}">
                <input type="text" class="form-control form-control-sm text-center shift-input" value="${shift}" maxlength="3" data-uid="${uid}" data-day="${d}">
            </td>`;
        }

        html += `<td class="sticky-col right-col-4 text-end fw-bold">${totalHours.toFixed(1)}</td>
                 <td class="sticky-col right-col-3 text-end fw-bold">${totalNights}</td>
                 <td class="sticky-col right-col-2 text-end fw-bold">${totalOff}</td>
                 <td class="sticky-col right-col-1 text-end fw-bold ${violationCount > 0 ? 'text-danger' : 'text-success'}">${violationCount}</td>
                 </tr>`;
        return html;
    }

    renderStatsRow(daysInMonth, assignments, unitSettings) {
        const staffReq = unitSettings.staffRequirements || {};
        const shiftCodes = unitSettings.settings?.shifts?.map(s => s.code) || ['D', 'E', 'N'];
        
        let html = `<tr class="stats-row">
            <td class="sticky-col first-col"></td>
            <td class="sticky-col second-col fw-bold">人力需求</td>
            <td class="sticky-col third-col"></td>
        `;

        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(this.state.year, this.state.month - 1, d);
            const dayOfWeek = date.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            
            let required = 0;
            let assigned = 0;
            
            shiftCodes.forEach(code => {
                required += staffReq[code]?.[dayOfWeek] || 0;
            });

            Object.keys(assignments).forEach(uid => {
                const shift = assignments[uid][d];
                if (shift && shift !== 'OFF' && shift !== 'M_OFF') {
                    assigned++;
                }
            });

            const diff = assigned - required;
            const diffClass = diff > 0 ? 'text-success' : (diff < 0 ? 'text-danger' : 'text-dark');

            html += `<td class="${isWeekend ? 'bg-light-gray' : ''} text-center small fw-bold ${diffClass}" title="需求: ${required}, 實際: ${assigned}">
                ${assigned}/${required}
            </td>`;
        }

        html += `<td class="sticky-col right-col-4"></td>
                 <td class="sticky-col right-col-3"></td>
                 <td class="sticky-col right-col-2"></td>
                 <td class="sticky-col right-col-1"></td>
                 </tr>`;
        return html;
    }

    getShiftClass(shift) {
        switch (shift) {
            case 'D': return 'bg-info text-white';
            case 'E': return 'bg-warning text-dark';
            case 'N': return 'bg-dark text-white';
            case 'OFF': return 'bg-light text-dark';
            case 'M_OFF': return 'bg-danger text-white';
            default: return '';
        }
    }

    attachEvents() {
        document.addEventListener('click', this.handleGlobalClick);
        
        const thead = document.getElementById('schedule-thead');
        if (thead) {
            thead.addEventListener('click', (e) => {
                const target = e.target.closest('th[data-sort]');
                if (target) {
                    const sortKey = target.dataset.sort;
                    if (this.state.sortKey === sortKey) {
                        this.state.sortAsc = !this.state.sortAsc;
                    } else {
                        this.state.sortKey = sortKey;
                        this.state.sortAsc = true;
                    }
                    this.renderSchedule();
                }
            });
        }

        const tbody = document.getElementById('schedule-tbody');
        if (tbody) {
            tbody.addEventListener('change', (e) => {
                const input = e.target.closest('.shift-input');
                if (input) {
                    const uid = input.dataset.uid;
                    const day = parseInt(input.dataset.day);
                    const shift = input.value.toUpperCase().trim();
                    
                    // 更新數據
                    this.state.scheduleData.assignments[uid] = this.state.scheduleData.assignments[uid] || {};
                    this.state.scheduleData.assignments[uid][day] = shift;
                    
                    // 更新單元格樣式
                    const cell = input.closest('.shift-cell');
                    cell.className = `shift-cell ${this.getShiftClass(shift)} ${cell.classList.contains('bg-light-gray') ? 'bg-light-gray' : ''}`;
                    
                    // 重新渲染以更新統計數據和違規計數
                    this.renderSchedule();
                }
            });
        }
    }

    // --- 評分相關 ---
    async calculateScore() {
        const { scheduleData, staffList, unitSettings, preSchedule } = this.state;
        if (!scheduleData || !unitSettings || !preSchedule) return;

        // 若 ScoringService 未載入，則忽略
        if (typeof ScoringService === 'undefined') return;

        const scoreResult = ScoringService.calculate(scheduleData, staffList, unitSettings, preSchedule);
        this.state.scoreResult = scoreResult;
        
        // 更新評分顯示
        const scoreDisplay = document.getElementById('score-display');
        if (scoreDisplay) {
            scoreDisplay.textContent = `${scoreResult.totalScore} 分`;
            scoreDisplay.className = `badge fs-6 ${scoreResult.passed ? 'bg-success' : 'bg-warning'}`;
        }
    }

    openScoreModal(versionIndex = -1) {
        const scoreResult = versionIndex === -1 ? this.state.scoreResult : this.generatedVersions[versionIndex].scoreResult;
        if (!scoreResult) return;

        const body = document.getElementById('score-modal-body');
        let html = `<div class="row">`;
        
        Object.keys(scoreResult.details).forEach(key => {
            const detail = scoreResult.details[key];
            const colorMap = { fairness: 'primary', regularity: 'warning', satisfaction: 'info', efficiency: 'success', cost: 'secondary' };
            const color = colorMap[key] || 'secondary';
            
            html += `
                <div class="col-md-6 mb-4">
                    <div class="card border-left-${color} shadow h-100">
                        <div class="card-body">
                            <div class="row no-gutters align-items-center">
                                <div class="col mr-2">
                                    <div class="text-xs fw-bold text-${color} text-uppercase mb-1">${detail.label}</div>
                                    <div class="h5 mb-0 fw-bold text-gray-800">${detail.score} / ${detail.max} 分</div>
                                </div>
                                <div class="col-auto">
                                    <i class="fas fa-chart-line fa-2x text-gray-300"></i>
                                </div>
                            </div>
                            <hr class="my-2">
                            <ul class="list-unstyled small">
                                ${detail.subItems.map(item => `
                                    <li>
                                        <span class="fw-bold">${item.name}:</span> 
                                        <span class="float-end">${item.value} (${item.grade})</span>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    </div>
                </div>
            `;
        });
        
        html += `</div>`;
        body.innerHTML = html;
        this.scoreModal.show();
    }

    // --- AI 排班相關 ---
    async openVersionsModal() {
        const { scheduleData, staffList, unitSettings, preSchedule } = this.state;
        if (!scheduleData || !unitSettings || !preSchedule) {
            alert('資料尚未載入完成，請稍後再試。');
            return;
        }
        
        const modalBody = document.getElementById('versions-modal-body');
        modalBody.innerHTML = `<div class="text-center p-5"><i class="fas fa-spinner fa-spin fa-3x"></i><p class="mt-3">AI 正在努力排班中，請稍候...</p></div>`;
        this.versionsModal.show();

        this.generatedVersions = [];
        const strategies = ['A', 'B', 'C']; 

        for (let i = 0; i < strategies.length; i++) {
            const strategyCode = strategies[i];
            
            // 呼叫 AutoScheduler
            if (typeof AutoScheduler !== 'undefined') {
                const result = await AutoScheduler.run(scheduleData, staffList, unitSettings, preSchedule, strategyCode);
                
                // 計算評分
                const scoreResult = ScoringService.calculate({ ...scheduleData, assignments: result.assignments }, staffList, unitSettings, preSchedule);
                
                this.generatedVersions.push({
                    strategyCode,
                    assignments: result.assignments,
                    scoreResult,
                    logs: result.logs
                });
            }
        }

        this.renderVersions();
    }

    renderVersions() {
        const modalBody = document.getElementById('versions-modal-body');
        
        if (this.generatedVersions.length === 0) {
            modalBody.innerHTML = `<div class="text-center p-5 text-danger">AI 排班生成失敗，請檢查 AutoScheduler。</div>`;
            return;
        }

        let navHtml = `<ul class="nav nav-tabs" id="versionTabs" role="tablist">`;
        let contentHtml = `<div class="tab-content" id="versionTabContent">`;

        this.generatedVersions.forEach((version, index) => {
            const isActive = index === 0;
            const strategyMap = {
                'A': '方案 A: 數值平衡 (公平優先)',
                'B': '方案 B: 願望優先 (滿意度高)',
                'C': '方案 C: 規律作息 (減少換班)'
            };
            const strategyName = strategyMap[version.strategyCode] || `版本 ${index + 1}`;
            const score = version.scoreResult.totalScore;
            const scoreClass = version.scoreResult.passed ? 'bg-success' : 'bg-warning';

            navHtml += `
                <li class="nav-item" role="presentation">
                    <button class="nav-link ${isActive ? 'active' : ''}" id="version-${index}-tab" data-bs-toggle="tab" data-bs-target="#version-${index}" type="button" role="tab">
                        版本 ${index + 1} <span class="badge ${scoreClass} ms-2">${score} 分</span>
                    </button>
                </li>
            `;

            contentHtml += `
                <div class="tab-pane fade ${isActive ? 'show active' : ''}" id="version-${index}" role="tabpanel">
                    <div class="d-flex justify-content-between align-items-center mb-3 pt-3">
                        <h5 class="fw-bold text-primary">${score} 分</h5>
                        <span class="badge bg-secondary">${strategyName}</span>
                        <button class="btn btn-primary btn-sm" onclick="window.routerPage.applyVersion(${index})">套用此版本</button>
                    </div>
                    ${this.renderVersionTable(version.assignments, version.scoreResult)}
                </div>
            `;
        });

        navHtml += `</ul>`;
        contentHtml += `</div>`;

        modalBody.innerHTML = navHtml + contentHtml;
    }

    renderVersionTable(assignments, scoreResult) {
        const { staffList, daysInMonth, unitSettings } = this.state;
        
        let html = `<div class="schedule-table-wrapper" style="max-height: 50vh;">
            <table class="table table-bordered schedule-grid mb-0">
                <thead id="version-thead">
                    ${this.renderHeader(daysInMonth)}
                </thead>
                <tbody>
                    ${staffList.map(staff => this.renderStaffRow(staff, assignments[staff.uid] || {}, daysInMonth, unitSettings)).join('')}
                    ${this.renderStatsRow(daysInMonth, assignments, unitSettings)}
                </tbody>
            </table>
        </div>
        <div class="mt-3">
            <h6 class="fw-bold">評分細節 <button class="btn btn-sm btn-outline-success ms-2" onclick="window.routerPage.openScoreModal(${this.generatedVersions.findIndex(v => v.assignments === assignments)})">查看完整評分</button></h6>
            ${this.renderScoreSummary(scoreResult)}
        </div>
        `;
        return html;
    }

    renderScoreSummary(scoreResult) {
        let html = `<div class="row g-2 small">`;
        Object.keys(scoreResult.details).forEach(key => {
            const detail = scoreResult.details[key];
            const colorMap = { fairness: 'primary', regularity: 'warning', satisfaction: 'info', efficiency: 'success', cost: 'secondary' };
            const color = colorMap[key] || 'secondary';
            
            html += `
                <div class="col-md-3">
                    <span class="badge bg-${color}">${detail.label}</span>
                    <span class="fw-bold ms-1">${detail.score} / ${detail.max}</span>
                </div>
            `;
        });
        html += `</div>`;
        return html;
    }

    applyVersion(index) {
        const version = this.generatedVersions[index];
        if (version) {
            this.state.scheduleData.assignments = version.assignments;
            this.state.scheduleData.version = (this.state.scheduleData.version || 0) + 1;
            this.state.scheduleData.activeVersion = this.state.scheduleData.version;
            this.versionsModal.hide();
            this.renderSchedule();
            alert(`已套用版本 ${index + 1}。請記得儲存排班。`);
        }
    }

    // --- 儲存與設定 ---
    async saveSchedule() {
        const { scheduleData, currentUnitId, year, month } = this.state;
        if (!scheduleData) return;

        try {
            await ScheduleService.saveSchedule(currentUnitId, year, month, scheduleData);
            alert('排班表已成功儲存！');
        } catch (e) {
            alert('儲存失敗: ' + e.message);
        }
    }
    
    openSettingsModal() {
        const { currentUnitId } = this.state;
        if (!currentUnitId) return;

        // ✅ 修正點 4：優化設定頁面載入邏輯
        // 使用 RuleSettings.js 載入內容並放入 Modal
        import('../settings/RuleSettings.js').then(({ RuleSettings }) => {
            const ruleSettings = new RuleSettings(currentUnitId);
            // 指定 Modal 內的容器 ID (這個 ID 是在上面 render 方法的 modalHtml 中定義的)
            ruleSettings.containerId = 'rule-settings-container-modal';
            
            // 先顯示 Modal，再載入內容
            this.settingsModal.show();
            
            // 呼叫 render (RuleSettings 會自動處理載入與 DOM 更新)
            const container = document.getElementById(ruleSettings.containerId);
            if (container) {
                container.innerHTML = ruleSettings.render();
            }
        });
    }
}
