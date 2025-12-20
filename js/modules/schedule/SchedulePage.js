import { UnitService } from "../../services/firebase/UnitService.js";
import { userService } from "../../services/firebase/UserService.js";
import { ScheduleService } from "../../services/firebase/ScheduleService.js";
import { PreScheduleService } from "../../services/firebase/PreScheduleService.js";
import { ScoringService } from "../../services/ScoringService.js";
import { RuleEngine } from "../ai/RuleEngine.js";
import { AutoScheduler } from "../ai/AutoScheduler.js";
import { SchedulePageTemplate } from "./templates/SchedulePageTemplate.js"; // 確保引入 Template

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
            preSchedule: null,
            // 新增上月相關狀態
            previousMonthSchedule: null,
            prevMonthInfo: null
        };
        // ... (其餘 constructor 保持不變)
        this.versionsModal = null; 
        this.scoreModal = null;
        this.settingsModal = null; 
        this.generatedVersions = [];
        this.handleGlobalClick = this.handleGlobalClick.bind(this);
    }

    // ... (handleGlobalClick, cleanup, render, afterRender 保持不變) ...

    handleGlobalClick(e) {
        // 保留供未來擴充全域點擊事件
    }

    cleanup() {
        document.removeEventListener('click', this.handleGlobalClick);
        const backdrops = document.querySelectorAll('.modal-backdrop');
        backdrops.forEach(b => b.remove());
    }

    async render() {
        // ... (保持原有的 render HTML/CSS 不變) ...
        // 建議在 <style> 中加入針對唯讀格子的樣式
        const style = `
            <style>
                /* ... 原本的 CSS ... */
                .schedule-grid th, .schedule-grid td { 
                    vertical-align: middle; 
                    white-space: nowrap; 
                    padding: 0; 
                    height: 38px; 
                    border-color: #dee2e6;
                    text-align: center; 
                }
                /* ... 其他 CSS ... */
                
                /* 新增：上月唯讀格子樣式 */
                .prev-month-cell {
                    background-color: #e9ecef !important;
                    color: #6c757d;
                    opacity: 0.8;
                }
                
                /* 覆蓋：移除原本週末的強制背景色，只保留紅字 */
                .text-danger { color: #dc3545 !important; }
            </style>
        `;
        // ... (回傳原本的 HTML結構) ...
        
        // 為了節省篇幅，這裡省略重複的 HTML string，請保持您原本的 render() 內容
        // 只要確保 CSS 部分有被應用即可
        return super.render ? super.render() : this._originalRender(); // 假設您有父類別或直接貼上原本代碼
    }
    
    // 輔助函式：為了不破壞您原本的 render，請將原本的 render 函式內容貼回，
    // 或直接使用您原本的 render 方法，只需確認 CSS 沒有衝突。
    _originalRender() {
        // (請將您原本的 render() 內容放在這，或直接在原本的位置修改)
        // 這裡僅示意，請使用您上傳的原始碼中的 render()
        return `... (原始 HTML) ...`; 
    }

    // ==========================================
    // 1. 修改 loadData：獲取上個月資料
    // ==========================================
    async loadData() {
        const { currentUnitId, year, month } = this.state;
        
        // 1. 載入單位設定
        let unitData = await UnitService.getUnitByIdWithCache(currentUnitId);
        if (!unitData.settings) {
            const settingsOnly = await UnitService.getUnitSettings(currentUnitId);
            unitData = { ...unitData, ...settingsOnly };
        }
        this.state.unitSettings = unitData;

        // 2. 載入預班與本月班表
        this.state.preSchedule = await PreScheduleService.getPreSchedule(currentUnitId, year, month);
        this.state.scheduleData = await ScheduleService.getSchedule(currentUnitId, year, month);

        // 3. (新增) 載入上個月班表資料
        let prevYear = year;
        let prevMonth = month - 1;
        if (prevMonth === 0) {
            prevMonth = 12;
            prevYear--;
        }
        
        try {
            const prevMonthSchedule = await ScheduleService.getSchedule(currentUnitId, prevYear, prevMonth);
            this.state.previousMonthSchedule = prevMonthSchedule;
            
            const prevDaysInMonth = new Date(prevYear, prevMonth, 0).getDate();
            this.state.prevMonthInfo = {
                year: prevYear,
                month: prevMonth,
                daysInMonth: prevDaysInMonth,
                displayDays: [] // 存放最後 6 天
            };
            
            // 計算最後 6 天 (例如 25, 26, 27, 28, 29, 30)
            for (let i = 5; i >= 0; i--) {
                this.state.prevMonthInfo.displayDays.push(prevDaysInMonth - i);
            }
        } catch (error) {
            console.warn('無法載入上月排班資料:', error);
            this.state.previousMonthSchedule = null;
            this.state.prevMonthInfo = null;
        }

        // 4. 初始化本月班表 (如果不存在)
        if (!this.state.scheduleData) {
            if (!this.state.preSchedule) {
                this.state.staffList = []; 
                document.getElementById('schedule-container').innerHTML = `
                    <div class="alert alert-warning m-5 text-center">
                        <h4><i class="fas fa-exclamation-triangle"></i> 無法建立排班表</h4>
                        <p class="mb-4">找不到 ${year}年${month}月 的預班表資料。</p>
                        <a href="#/pre-schedule/manage" class="btn btn-primary">前往預班管理</a>
                    </div>`;
                throw new Error("中止載入：無預班表");
            }
            this.state.scheduleData = {
                unitId: currentUnitId, year, month,
                assignments: {},
                logs: [],
                version: 0
            };
            this.performReset(false); 
        }
        
        this.state.daysInMonth = new Date(year, month, 0).getDate();

        // 5. 處理人員名單
        let finalStaffList = [];
        const unitUsers = await userService.getUsersByUnit(currentUnitId);
        const userMap = {};
        unitUsers.forEach(u => userMap[u.uid] = u);

        if (this.state.preSchedule && this.state.preSchedule.staffIds) {
            const promises = this.state.preSchedule.staffIds.map(async (uid) => {
                if (userMap[uid]) return userMap[uid];
                try { return await userService.getUserData(uid); } catch (e) { return null; }
            });
            const results = await Promise.all(promises);
            finalStaffList = results.filter(u => u !== null);
        } else {
            finalStaffList = unitUsers;
        }
        this.state.staffList = finalStaffList;
        
        const unitName = this.state.unitSettings.unitName || '未命名單位';
        const titleEl = document.getElementById('schedule-title');
        if(titleEl) titleEl.textContent = `${unitName} ${year}年${month}月`;
    }

    // ... (renderSchedule 保持不變，它會呼叫下方的 renderHeader 和 renderStaffRow) ...
    renderSchedule() {
        const { staffList, scheduleData, daysInMonth, unitSettings } = this.state;
        if (!staffList || staffList.length === 0) return;

        const thead = document.getElementById('schedule-thead');
        if(thead) thead.innerHTML = this.renderHeader(daysInMonth);

        const tbody = document.getElementById('schedule-tbody');
        if(tbody) {
            tbody.innerHTML = staffList.map(staff => 
                this.renderStaffRow(staff, scheduleData.assignments[staff.uid] || {}, daysInMonth, unitSettings)
            ).join('');
            tbody.innerHTML += this.renderStatsRow(daysInMonth, scheduleData.assignments, unitSettings);
        }
        this.calculateScore();
    }

    // ==========================================
    // 2. 修改 renderHeader：加入上月日期
    // ==========================================
    renderHeader(daysInMonth) {
        const { prevMonthInfo } = this.state;

        let html = `<tr>
            <th class="sticky-col first-col cursor-pointer" data-sort="staffId">職編 <i class="fas fa-sort sort-icon"></i></th>
            <th class="sticky-col second-col cursor-pointer" data-sort="name">姓名 <i class="fas fa-sort sort-icon"></i></th>
            <th class="sticky-col third-col">備註<br><span style="font-size:0.65rem; color:#666;">(狀態/偏好)</span></th>
        `;

        // (A) 渲染上月最後 6 天
        if (prevMonthInfo && prevMonthInfo.displayDays) {
            prevMonthInfo.displayDays.forEach(day => {
                const dateObj = new Date(prevMonthInfo.year, prevMonthInfo.month - 1, day);
                const weekStr = ['日','一','二','三','四','五','六'][dateObj.getDay()];
                // 樣式：灰色背景，透明度高一點
                html += `<th class="bg-secondary text-white" style="min-width:40px; opacity: 0.7;">
                    ${prevMonthInfo.month}/${day}<br><span style="font-size:0.75rem">${weekStr}</span>
                </th>`;
            });
        }

        // (B) 渲染本月日期
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(this.state.year, this.state.month - 1, d);
            const dayOfWeek = date.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            const weekStr = ['日','一','二','三','四','五','六'][dayOfWeek];
            
            // 修改：假日只標紅字，移除 bg-light-gray 以保持白色背景(或依需求)
            html += `<th class="${isWeekend ? 'text-danger' : ''}">
                ${d}<br><span style="font-size:0.75rem">${weekStr}</span>
            </th>`;
        }
        
        // 右側固定統計欄
        html += `<th class="sticky-col right-col-4">OFF</th>
                 <th class="sticky-col right-col-3">假日</th>
                 <th class="sticky-col right-col-2">小夜</th>
                 <th class="sticky-col right-col-1">大夜</th>
                 </tr>`;
        return html;
    }

    // ... (_renderRemarks 保持不變) ...
    _renderRemarks(staff, preSchedule) {
        // (保持原代碼)
        let html = '';
        const constraints = staff.constraints || {};
        const uid = staff.uid;
        if (constraints.isPregnant) html += '<span class="badge bg-danger me-1" title="懷孕">孕</span>';
        if (constraints.isPostpartum) html += '<span class="badge bg-warning text-dark me-1" title="哺乳">哺</span>';
        if (constraints.canBatch) html += '<span class="badge bg-info text-dark me-1" title="可包班">包</span>';

        if (preSchedule && preSchedule.submissions && preSchedule.submissions[uid]) {
            const sub = preSchedule.submissions[uid];
            if (sub.preferences) {
                const p1 = sub.preferences.priority1 || '-';
                const p2 = sub.preferences.priority2 || '-';
                if(p1 !== '-' || p2 !== '-') {
                     html += `<div class="mt-1 small text-primary" style="font-size:0.65rem; line-height:1;"><i class="fas fa-heart"></i> ${p1}>${p2}</div>`;
                }
            }
            if (sub.notes) {
                html += `<div class="mt-1 text-muted text-truncate fst-italic border-top pt-1" title="${sub.notes}" style="font-size: 0.65rem; line-height:1; max-width: 100%;">
                            ${sub.notes}
                         </div>`;
            }
        }
        if(staff.note) {
             html += `<div class="text-dark small border-top mt-1 pt-1" title="${staff.note}">📝 ${staff.note}</div>`;
        }
        return html;
    }

    // ==========================================
    // 3. 修改 renderStaffRow：渲染上月班別
    // ==========================================
    renderStaffRow(staff, assignments, daysInMonth, unitSettings) {
        const uid = staff.uid;
        const wishes = this.state.preSchedule?.submissions?.[uid]?.wishes || {};
        const remarksHtml = this._renderRemarks(staff, this.state.preSchedule);
        const { prevMonthInfo, previousMonthSchedule } = this.state;

        let html = `<tr>
            <td class="sticky-col first-col">${staff.staffId || ''}</td>
            <td class="sticky-col second-col">
                <div class="fw-bold">${staff.name}</div>
                <div class="small text-muted" style="font-size:0.7rem;">${staff.title||''}</div>
            </td>
            <td class="sticky-col third-col">
                ${remarksHtml}
            </td>
        `;

        // (A) 渲染上月資料 (唯讀)
        if (prevMonthInfo && prevMonthInfo.displayDays) {
            const prevAssignments = previousMonthSchedule?.assignments?.[uid] || {};
            prevMonthInfo.displayDays.forEach(day => {
                const code = prevAssignments[day] || '';
                
                // 樣式：淡化處理
                let style = 'background-color: #e9ecef; color: #6c757d; opacity: 0.8;';
                if (code === 'N') style = 'background-color: #495057; color: #fff; opacity: 0.6;';
                else if (code === 'E') style = 'background-color: #ffc107; color: #000; opacity: 0.5;';
                else if (code === 'D') style = 'background-color: #d1e7dd; color: #0f5132; opacity: 0.6;';
                
                html += `<td style="${style}" title="上月 ${day} 日 (唯讀)">
                    <span style="font-size: 0.85rem;">${code === 'M_OFF' ? 'OFF' : code}</span>
                </td>`;
            });
        }
        
        // 統計變數
        let countOFF = 0, countHolidayOFF = 0, countE = 0, countN = 0;

        // (B) 渲染本月資料
        for (let d = 1; d <= daysInMonth; d++) {
            const shift = assignments[d] || '';
            const wish = wishes[d];

            const date = new Date(this.state.year, this.state.month - 1, d);
            const dayOfWeek = date.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
            
            // 統計
            if (shift === 'OFF' || shift === 'M_OFF') {
                countOFF++;
                if (isWeekend) countHolidayOFF++;
            } else if (shift === 'E') countE++;
            else if (shift === 'N') countN++;

            let cellStyle = this.getShiftStyle(shift);
            let markerHtml = '';
            
            if (wish) {
                markerHtml = `<div class="wish-marker" title="預班: ${wish}">●</div>`;
                if (wish !== shift) {
                   cellStyle += 'background-color: #fff3cd !important;'; 
                }
            }
            
            // 修改：移除週末背景色邏輯，保持表格乾淨
            // if (isWeekend) cellStyle += 'background-color: #f8f9fa;'; 

            html += `<td class="shift-cell wish-cell" style="${cellStyle}" data-uid="${uid}" data-day="${d}">
                ${markerHtml}
                <input type="text" class="shift-input" value="${shift}" maxlength="3" data-uid="${uid}" data-day="${d}" 
                       style="background:transparent; color: inherit;">
            </td>`;
        }

        // 統計欄位
        html += `<td class="sticky-col right-col-4 text-center fw-bold">${countOFF}</td>
                 <td class="sticky-col right-col-3 text-center fw-bold text-success">${countHolidayOFF}</td>
                 <td class="sticky-col right-col-2 text-center fw-bold text-warning-dark">${countE}</td>
                 <td class="sticky-col right-col-1 text-center fw-bold text-danger">${countN}</td>
                 </tr>`;
        return html;
    }

    // ==========================================
    // 4. 修改 renderStatsRow：底部統計補白
    // ==========================================
    renderStatsRow(daysInMonth, assignments, unitSettings) {
        const staffReq = unitSettings.staffRequirements || {}; 
        const availableShifts = unitSettings.settings?.shifts || [
            {code: 'D', name: '白班'}, {code: 'E', name: '小夜'}, {code: 'N', name: '大夜'}
        ];
        const { prevMonthInfo } = this.state;
        
        let rowsHtml = '';

        availableShifts.forEach(shiftDef => {
            const code = shiftDef.code;
            const name = shiftDef.name;

            rowsHtml += `<tr class="stats-row">
                <td class="sticky-col first-col"></td>
                <td class="sticky-col second-col fw-bold text-end pe-2">${name}</td>
                <td class="sticky-col third-col small text-muted">實際/需求</td>
            `;

            // (A) 上月欄位補白 (空 TD)
            if (prevMonthInfo && prevMonthInfo.displayDays) {
                prevMonthInfo.displayDays.forEach(() => {
                    rowsHtml += `<td class="bg-light"></td>`;
                });
            }

            // (B) 本月統計
            for (let d = 1; d <= daysInMonth; d++) {
                const date = new Date(this.state.year, this.state.month - 1, d);
                const dayOfWeek = date.getDay(); 
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

                const required = staffReq[code]?.[dayOfWeek] || 0;

                let assigned = 0;
                Object.keys(assignments).forEach(uid => {
                    if (assignments[uid][d] === code) {
                        assigned++;
                    }
                });

                let textClass = 'text-success';
                if (assigned < required) textClass = 'text-danger fw-bold';
                else if (assigned > required) textClass = 'text-primary';

                rowsHtml += `<td class="text-center small ${textClass}" 
                                 title="${name}: 已排${assigned}人 / 需${required}人">
                    ${assigned}/${required}
                </td>`;
            }

            rowsHtml += `<td class="sticky-col right-col-4"></td><td class="sticky-col right-col-3"></td><td class="sticky-col right-col-2"></td><td class="sticky-col right-col-1"></td></tr>`;
        });

        return rowsHtml;
    }
    
    // ... (getShiftStyle, attachEvents, calculateScore, openScoreModal, resetToPreSchedule, performReset, openVersionsModal, renderVersions, renderVersionTable, renderScoreSummary, applyVersion, saveSchedule, openSettingsModal 保持不變) ...

    // 提醒：在 renderVersionTable (AI 排班結果預覽) 裡，因為是使用 SchedulePage 的內部方法，
    // 您可能也需要對 renderVersionTable 做類似 renderHeader/renderStaffRow 的調整，
    // 或者直接讓 renderVersions 改用 SchedulePageTemplate.renderGrid (如下推薦)
    
    renderVersionTable(assignments, scoreResult) {
        // 建議改用 Template 以減少重複代碼，且 Template 已經包含了新功能
        return SchedulePageTemplate.renderGrid(
            { 
                ...this.state, 
                scheduleData: { ...this.state.scheduleData, assignments } // 覆蓋為版本排班
            },
            { staffReport: {} }, // 預覽暫不顯示個別錯誤
            { isInteractive: false, versionIdx: null }
        ) + `
        <div class="mt-3">
            <h6 class="fw-bold">評分細節</h6>
            ${this.renderScoreSummary(scoreResult)}
        </div>`;
    }
}
