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
            preSchedule: null // 關鍵：儲存預班資料
        };
        this.versionsModal = null; 
        this.scoreModal = null;
        this.settingsModal = null; 
        this.generatedVersions = [];
        
        this.handleGlobalClick = this.handleGlobalClick.bind(this);
    }

    handleGlobalClick(e) {
        // 保留供未來擴充全域點擊事件
    }

    cleanup() {
        document.removeEventListener('click', this.handleGlobalClick);
        const backdrops = document.querySelectorAll('.modal-backdrop');
        backdrops.forEach(b => b.remove());
    }

    async render() {
        const style = `
            <style>
                .schedule-table-wrapper { position: relative; max-height: 75vh; width: 100%; overflow: auto; border: 1px solid #ddd; }
                .schedule-grid th, .schedule-grid td { vertical-align: middle; white-space: nowrap; padding: 0; height: 38px; border-color: #dee2e6; }
                
                /* 固定欄位設定 */
                .sticky-col { position: sticky; z-index: 10; background-color: #fff; }
                .first-col { left: 0; z-index: 11; border-right: 2px solid #ccc !important; width: 60px; text-align: center; }
                .second-col { left: 60px; z-index: 11; width: 80px; text-align: center; }
                .third-col { left: 140px; z-index: 11; border-right: 2px solid #999 !important; width: 100px; max-width: 150px; overflow: hidden; text-overflow: ellipsis; }
                
                /* 右側統計固定欄 */
                .right-col-1 { right: 0; z-index: 11; border-left: 2px solid #ccc !important; width: 45px; background-color: #fff; } 
                .right-col-2 { right: 45px; z-index: 11; width: 45px; background-color: #fff; }
                .right-col-3 { right: 90px; z-index: 11; width: 45px; background-color: #fff; }
                .right-col-4 { right: 135px; z-index: 11; border-left: 2px solid #999 !important; width: 45px; background-color: #fff; }
                
                thead .sticky-col { z-index: 15 !important; background-color: #f8f9fa; }
                
                .bg-light-gray { background-color: #f8f9fa !important; color: #aaa; }
                .shift-input { border: none; width: 100%; height: 100%; text-align: center; background: transparent; font-weight: 500; }
                .shift-input:focus { background-color: #e8f0fe !important; outline: 2px solid #0d6efd; z-index: 5; position: relative; }
                
                .cursor-pointer { cursor: pointer; }
                .sort-icon { font-size: 0.7rem; margin-left: 2px; color: #666; }
                .stats-row td { background-color: #f8f9fa; font-weight: bold; border-top: 2px solid #666 !important; }

                /* 預班標記 */
                .wish-cell { position: relative; }
                .wish-marker { position: absolute; top: 1px; right: 1px; font-size: 0.6rem; color: #dc3545; font-weight: bold; z-index: 4; pointer-events: none; }
            </style>
        `;

        const params = new URLSearchParams(window.location.hash.split('?')[1]);
        this.state.currentUnitId = params.get('unitId');
        this.state.year = parseInt(params.get('year'));
        this.state.month = parseInt(params.get('month'));

        if(!this.state.currentUnitId) return `<div class="alert alert-danger m-4">無效的參數。</div>`;

        const modalHtml = `
            <div class="modal fade" id="versions-modal" tabindex="-1">
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title"><i class="fas fa-robot me-2"></i>AI 智慧排班結果選擇</h5>
                            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body" id="versions-modal-body"></div>
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
                        <div class="modal-body" id="score-modal-body"></div>
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
            <div class="container-fluid mt-3">
                <div class="d-flex justify-content-between align-items-center mb-3 p-3 bg-white shadow-sm rounded">
                    <div class="d-flex align-items-center gap-3">
                        <h4 class="text-gray-800 fw-bold mb-0"><i class="fas fa-calendar-alt"></i> <span id="schedule-title">載入中...</span></h4>
                        <div id="score-display-card" class="d-flex align-items-center px-3 py-1 bg-light rounded border cursor-pointer" onclick="window.routerPage.openScoreModal()">
                            <span class="text-muted me-2 small">評分</span>
                            <h4 class="mb-0 fw-bold text-secondary" id="score-display">--</h4>
                            <span class="ms-1 small">分</span>
                        </div>
                    </div>
                    
                    <div class="d-flex gap-2">
                        <button id="btn-settings" class="btn btn-outline-secondary" onclick="window.routerPage.openSettingsModal()">
                            <i class="fas fa-cog"></i> 設定
                        </button>
                        <button id="btn-reset" class="btn btn-outline-danger" onclick="window.routerPage.resetToPreSchedule()">
                            <i class="fas fa-undo"></i> 重置 (載入預班)
                        </button>
                        <button id="btn-ai-schedule" class="btn btn-primary" onclick="window.routerPage.openVersionsModal()">
                            <i class="fas fa-robot"></i> AI 智慧排班
                        </button>
                        <button id="btn-save" class="btn btn-success" onclick="window.routerPage.saveSchedule()">
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
        
        const settingsEl = document.getElementById('settings-modal');
        if (settingsEl) {
            this.settingsModal = new bootstrap.Modal(settingsEl);
        }
        
        try {
            await this.loadData();
            this.renderSchedule();
            this.attachEvents();
        } catch (e) {
            console.error("Page Load Error:", e);
            document.getElementById('schedule-container').innerHTML = `<div class="alert alert-danger m-4">頁面載入失敗: ${e.message}</div>`;
        }
    }

    async loadData() {
        const { currentUnitId, year, month } = this.state;
        
        // 1. 載入單位設定
        this.state.unitSettings = await UnitService.getUnitSettings(currentUnitId);
        
        // 2. 載入員工列表 (使用 getUsersByUnit 確保一致性)
        this.state.staffList = await userService.getUsersByUnit(currentUnitId);
        
        // 3. 載入預排班表 (Pre-Schedule) - 這是關鍵，必須載入才能顯示 Wishes
        this.state.preSchedule = await PreScheduleService.getPreSchedule(currentUnitId, year, month);
        
        // 4. 載入排班表
        this.state.scheduleData = await ScheduleService.getSchedule(currentUnitId, year, month);
        
        // 如果沒有排班資料，創建一個空的 (並嘗試預填預班)
        if (!this.state.scheduleData) {
            this.state.scheduleData = {
                unitId: currentUnitId, year, month,
                assignments: {},
                logs: [],
                version: 0,
                activeVersion: 0
            };
            // 若為新建立，自動執行一次預班載入 (不提示)
            this.performReset(false);
        }
        
        // 5. 計算天數
        this.state.daysInMonth = new Date(year, month, 0).getDate();
        
        // 6. 更新標題
        const unitName = this.state.unitSettings.unitName || '未命名單位';
        document.getElementById('schedule-title').textContent = `${unitName} ${year}年${month}月`;
    }

    renderSchedule() {
        const { staffList, scheduleData, daysInMonth, unitSettings } = this.state;
        
        if (!staffList || staffList.length === 0) {
            document.getElementById('schedule-tbody').innerHTML = '<tr><td colspan="100" class="text-center py-5">此單位尚無人員資料</td></tr>';
            return;
        }

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

        const thead = document.getElementById('schedule-thead');
        if(thead) thead.innerHTML = this.renderHeader(daysInMonth);

        const tbody = document.getElementById('schedule-tbody');
        if(tbody) {
            tbody.innerHTML = staffList.map(staff => 
                this.renderStaffRow(staff, scheduleData.assignments[staff.uid] || {}, daysInMonth, unitSettings)
            ).join('');
            
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
            const weekStr = ['日','一','二','三','四','五','六'][dayOfWeek];
            html += `<th class="${isWeekend ? 'bg-light-gray text-danger' : ''}">
                ${d}<br><span style="font-size:0.75rem">${weekStr}</span>
            </th>`;
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
        // 取得該員工的預班資料 (Wishes)
        const wishes = this.state.preSchedule?.submissions?.[uid]?.wishes || {};

        let html = `<tr>
            <td class="sticky-col first-col">${staff.staffId || ''}</td>
            <td class="sticky-col second-col">${staff.name}</td>
            <td class="sticky-col third-col small text-truncate" title="${staff.note || ''}">${staff.note || ''}</td>
        `;
        
        let totalHours = 0;
        let totalNights = 0;
        let totalOff = 0;
        let violationCount = 0;

        for (let d = 1; d <= daysInMonth; d++) {
            const shift = assignments[d] || '';
            const wish = wishes[d]; // 檢查是否有預班

            const date = new Date(this.state.year, this.state.month - 1, d);
            const dayOfWeek = date.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            
            // 計算統計
            if (shift === 'OFF' || shift === 'M_OFF') {
                totalOff++;
            } else if (shift) {
                const shiftDef = unitSettings.settings?.shifts?.find(s => s.code === shift);
                const hours = parseFloat(shiftDef?.hours || 0);
                totalHours += hours;
                if (shift === 'N' || shift === 'E') totalNights++;
            }

            // 檢查違規 (簡單版)
            if (typeof RuleEngine !== 'undefined') {
                const validation = RuleEngine.validateStaff(assignments, d, unitSettings.settings?.shifts, unitSettings.rules, staff.constraints, assignments[0], staff.lastMonthConsecutive, d);
                if (validation.errors[d]) violationCount++;
            }

            // 視覺處理：如果班表與 Wish 不同，或 Wish 存在，顯示提示
            let cellStyle = this.getShiftStyle(shift);
            let markerHtml = '';
            
            if (wish) {
                // 如果有 Wish，顯示小標記 (例如紅色的 "預")
                markerHtml = `<div class="wish-marker" title="預班: ${wish}">●</div>`;
                // 如果目前的排班不符合預班，背景色微調提示 (可選)
                if (wish !== shift) {
                   cellStyle += 'background-color: #fff3cd !important;'; // 黃色警示
                }
            }
            if (isWeekend) cellStyle += 'background-color: #f8f9fa;';

            html += `<td class="shift-cell wish-cell" style="${cellStyle}" data-uid="${uid}" data-day="${d}">
                ${markerHtml}
                <input type="text" class="shift-input" value="${shift}" maxlength="3" data-uid="${uid}" data-day="${d}" 
                       style="background:transparent; color: inherit;">
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
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            
            let required = 0;
            let assigned = 0;
            
            shiftCodes.forEach(code => {
                required += staffReq[code]?.[date.getDay()] || 0;
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

        html += `<td class="sticky-col right-col-4"></td><td class="sticky-col right-col-3"></td><td class="sticky-col right-col-2"></td><td class="sticky-col right-col-1"></td></tr>`;
        return html;
    }

    getShiftStyle(shift) {
        // 簡單配色，可根據 ShiftSettings 動態調整
        if (!shift) return '';
        if (shift === 'OFF') return 'background-color: #f0f0f0; color: #999;';
        if (shift === 'M_OFF') return 'background-color: #dc3545; color: white;';
        if (shift === 'N') return 'background-color: #212529; color: white;';
        if (shift === 'E') return 'background-color: #ffc107; color: #000;';
        if (shift === 'D') return 'background-color: #d1e7dd; color: #0f5132;';
        return '';
    }

    attachEvents() {
        document.addEventListener('click', this.handleGlobalClick);
        
        // 排序事件
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

        // 輸入事件
        const tbody = document.getElementById('schedule-tbody');
        if (tbody) {
            tbody.addEventListener('change', (e) => {
                const input = e.target.closest('.shift-input');
                if (input) {
                    const uid = input.dataset.uid;
                    const day = parseInt(input.dataset.day);
                    const shift = input.value.toUpperCase().trim();
                    
                    this.state.scheduleData.assignments[uid] = this.state.scheduleData.assignments[uid] || {};
                    this.state.scheduleData.assignments[uid][day] = shift;
                    
                    // 重新計算樣式與統計
                    this.renderSchedule();
                }
            });
        }
    }

    async calculateScore() {
        const { scheduleData, staffList, unitSettings, preSchedule } = this.state;
        if (!scheduleData || !unitSettings || !preSchedule) return;
        if (typeof ScoringService === 'undefined') return;

        const scoreResult = ScoringService.calculate(scheduleData, staffList, unitSettings, preSchedule);
        this.state.scoreResult = scoreResult;
        
        const scoreDisplay = document.getElementById('score-display');
        if (scoreDisplay) {
            scoreDisplay.textContent = `${scoreResult.totalScore}`;
            scoreDisplay.className = `mb-0 fw-bold ${scoreResult.passed ? 'text-success' : 'text-danger'}`;
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
                            <h6 class="text-${color} fw-bold text-uppercase mb-2">${detail.label}</h6>
                            <div class="h4 fw-bold text-gray-800 mb-2">${detail.score} / ${detail.max} 分</div>
                            <ul class="list-unstyled small mb-0">
                                ${detail.subItems.map(item => `
                                    <li class="d-flex justify-content-between border-bottom py-1">
                                        <span>${item.name}</span> 
                                        <span>${item.value} (${item.grade})</span>
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

    // --- 重置功能 (恢復舊版功能) ---
    resetToPreSchedule() {
        if(confirm("確定重置？將清除所有目前手動排班內容，並載入預班資料。")) {
            this.performReset(true);
        }
    }

    performReset(refreshUI = true) {
        const { preSchedule, staffList } = this.state;
        const newAssignments = {};
        
        // 初始化所有員工的空物件
        staffList.forEach(s => { newAssignments[s.uid] = {}; });
        
        // 填入預班資料
        if (preSchedule && preSchedule.submissions) {
            Object.entries(preSchedule.submissions).forEach(([uid, sub]) => {
                if(sub.wishes && newAssignments[uid]) {
                    Object.entries(sub.wishes).forEach(([d, w]) => { 
                        // M_OFF 轉為 OFF (或保留 M_OFF 視系統邏輯而定)
                        newAssignments[uid][d] = (w === 'M_OFF' ? 'OFF' : w); 
                    });
                }
            });
        }
        
        this.state.scheduleData.assignments = newAssignments;
        if (refreshUI) {
            this.renderSchedule();
            alert("✅ 已重置為預班狀態");
        }
    }

    // --- AI 排班相關 ---
    async openVersionsModal() {
        const { scheduleData, staffList, unitSettings, preSchedule } = this.state;
        
        // 檢查 preSchedule 是否有效，因為 AutoScheduler 需要它
        if (!scheduleData || !unitSettings) {
            alert('資料尚未載入完成，請稍後再試。');
            return;
        }
        
        const modalBody = document.getElementById('versions-modal-body');
        modalBody.innerHTML = `<div class="text-center p-5"><i class="fas fa-spinner fa-spin fa-3x"></i><p class="mt-3">AI 正在努力排班中，請稍候...</p></div>`;
        this.versionsModal.show();

        this.generatedVersions = [];
        const strategies = ['A', 'B', 'C']; 

        // 為了確保 AutoScheduler 拿到正確的預班資料，確保 preSchedule 物件完整
        const aiPreSchedule = preSchedule || { submissions: {}, year: this.state.year, month: this.state.month };

        for (let i = 0; i < strategies.length; i++) {
            const strategyCode = strategies[i];
            
            if (typeof AutoScheduler !== 'undefined') {
                try {
                    // 呼叫 AI 引擎
                    const result = await AutoScheduler.run(scheduleData, staffList, unitSettings, aiPreSchedule, strategyCode);
                    
                    // 計算評分
                    const scoreResult = ScoringService.calculate({ ...scheduleData, assignments: result.assignments }, staffList, unitSettings, aiPreSchedule);
                    
                    this.generatedVersions.push({
                        strategyCode,
                        assignments: result.assignments,
                        scoreResult,
                        logs: result.logs
                    });
                } catch (e) {
                    console.error("AI Error:", e);
                }
            }
        }

        this.renderVersions();
    }

    renderVersions() {
        const modalBody = document.getElementById('versions-modal-body');
        
        if (this.generatedVersions.length === 0) {
            modalBody.innerHTML = `<div class="text-center p-5 text-danger">AI 排班生成失敗，請檢查 Console 或稍後再試。</div>`;
            return;
        }

        let navHtml = `<ul class="nav nav-tabs" id="versionTabs" role="tablist">`;
        let contentHtml = `<div class="tab-content" id="versionTabContent">`;

        this.generatedVersions.forEach((version, index) => {
            const isActive = index === 0;
            const strategyMap = { 'A': '方案 A: 數值平衡', 'B': '方案 B: 願望優先', 'C': '方案 C: 規律作息' };
            const strategyName = strategyMap[version.strategyCode] || `版本 ${index + 1}`;
            const score = version.scoreResult.totalScore;
            const scoreClass = version.scoreResult.passed ? 'bg-success' : 'bg-warning';

            navHtml += `
                <li class="nav-item" role="presentation">
                    <button class="nav-link ${isActive ? 'active' : ''}" id="version-${index}-tab" data-bs-toggle="tab" data-bs-target="#version-${index}" type="button" role="tab">
                        ${strategyName} <span class="badge ${scoreClass} ms-2">${score} 分</span>
                    </button>
                </li>
            `;

            contentHtml += `
                <div class="tab-pane fade ${isActive ? 'show active' : ''}" id="version-${index}" role="tabpanel">
                    <div class="d-flex justify-content-between align-items-center mb-3 pt-3">
                        <h5 class="fw-bold text-primary">${score} 分</h5>
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
            <h6 class="fw-bold">評分細節</h6>
            ${this.renderScoreSummary(scoreResult)}
        </div>
        `;
        return html;
    }

    renderScoreSummary(scoreResult) {
        let html = `<div class="row g-2 small">`;
        Object.keys(scoreResult.details).forEach(key => {
            const detail = scoreResult.details[key];
            const color = detail.score < (detail.max * 0.6) ? 'danger' : 'success';
            html += `
                <div class="col-md-3">
                    <span class="badge bg-light text-dark border">${detail.label}</span>
                    <span class="fw-bold ms-1 text-${color}">${detail.score} / ${detail.max}</span>
                </div>
            `;
        });
        html += `</div>`;
        return html;
    }

    applyVersion(index) {
        const version = this.generatedVersions[index];
        if (version) {
            if(!confirm(`確定套用此 AI 版本 (${version.scoreResult.totalScore}分)？這將覆蓋目前的排班。`)) return;
            
            // 深拷貝以避免參考問題
            this.state.scheduleData.assignments = JSON.parse(JSON.stringify(version.assignments));
            this.state.scheduleData.version = (this.state.scheduleData.version || 0) + 1;
            
            this.versionsModal.hide();
            this.renderSchedule();
            alert(`✅ 已套用 AI 班表。請記得點擊「儲存排班」以寫入資料庫。`);
        }
    }

    async saveSchedule() {
        const { scheduleData, currentUnitId, year, month } = this.state;
        if (!scheduleData) return;

        try {
            await ScheduleService.saveSchedule(currentUnitId, year, month, scheduleData);
            alert('✅ 排班表已成功儲存！');
        } catch (e) {
            alert('儲存失敗: ' + e.message);
        }
    }
    
    openSettingsModal() {
        const { currentUnitId } = this.state;
        if (!currentUnitId) return;

        import('../settings/RuleSettings.js').then(({ RuleSettings }) => {
            const ruleSettings = new RuleSettings(currentUnitId);
            ruleSettings.containerId = 'rule-settings-container-modal';
            this.settingsModal.show();
            
            const container = document.getElementById(ruleSettings.containerId);
            if (container) {
                container.innerHTML = ruleSettings.render();
                // 處理 RuleSettings 的初始化邏輯
                if (ruleSettings.loadRules) {
                    ruleSettings.loadRules(currentUnitId).then(() => {});
                }
                if (ruleSettings.afterRender) {
                    setTimeout(() => ruleSettings.afterRender(), 50);
                }
            }
        });
    }
}
