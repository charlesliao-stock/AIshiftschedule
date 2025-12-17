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
            scheduleData: null, 
            daysInMonth: 0,
            scoreResult: null,
            sortKey: 'id', 
            sortAsc: true,
            unitMap: {} // ✅ 新增：單位對照表
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
        // ... (樣式與 HTML 結構保持不變，為節省篇幅省略 style 與 modalHtml) ...
        // 請保留您原本的 render() 內容
        const style = `
            <style>
                .schedule-table-wrapper { position: relative; max-height: 100%; width: 100%; overflow: auto; }
                .schedule-grid th, .schedule-grid td { vertical-align: middle; white-space: nowrap; padding: 2px 4px; height: 38px; border-color: #dee2e6; }
                .sticky-col { position: sticky; z-index: 10; }
                .first-col { left: 0; z-index: 11; border-right: 2px solid #ccc !important; width: 60px; }
                .second-col { left: 60px; z-index: 11; width: 80px; }
                .third-col { left: 140px; z-index: 11; border-right: 2px solid #999 !important; width: 60px; }
                .right-col-1 { right: 0; z-index: 11; border-left: 2px solid #ccc !important; width: 45px; } 
                .right-col-2 { right: 45px; z-index: 11; width: 45px; }
                .right-col-3 { right: 90px; z-index: 11; width: 45px; }
                .right-col-4 { right: 135px; z-index: 11; border-left: 2px solid #999 !important; width: 45px; }
                thead .sticky-col { z-index: 15 !important; }
                .bg-light-gray { background-color: #f8f9fa !important; color: #aaa; }
                .shift-input:focus { background-color: #e8f0fe !important; font-weight: bold; outline: none; }
                .cursor-pointer { cursor: pointer; }
                .shift-cell { cursor: pointer; transition: background 0.1s; }
                .shift-cell:hover { background-color: #e9ecef; }
            </style>
        `;
        // ... 中間省略 ... 
        // 為了讓您好複製，這裡僅提供修改過的關鍵方法，其餘請保留
        // 若需要完整版請告知
        
        // ⚠️ 這裡回傳原本的完整 HTML 結構
        // (請使用您上一版 SchedulePage.js 的 render 內容，或直接複製下方的 loadData 與 renderGrid 替換即可)
        return this._originalRender(style); 
    }
    
    // 輔助：保留原版 render 內容的函式 (您可直接用原版 render 取代此函式)
    _originalRender(style) {
        // ... (請將原版 render 內容貼回這裡，或直接修改您檔案中的 render) ...
        // 這裡為了不讓回答過長，重點在於下面的 loadData 和 renderGrid
        return super.render ? super.render() : ''; 
    }

    // ... (afterRender, handleGlobalClick, closeMenu, openSettingsModal, saveSettings 等保持不變) ...

    // ✅ 修正 1: 載入所有單位資料
    async loadData() {
        const container = document.getElementById('schedule-grid-container');
        const loading = document.getElementById('loading-indicator');
        if(loading) loading.style.display = 'block';

        try {
            // 多載入 UnitService.getAllUnits()
            const [unit, staffList, schedule, allUnits] = await Promise.all([
                UnitService.getUnitByIdWithCache(this.state.currentUnitId),
                userService.getUnitStaff(this.state.currentUnitId),
                ScheduleService.getSchedule(this.state.currentUnitId, this.state.year, this.state.month),
                UnitService.getAllUnits() 
            ]);

            this.state.unitSettings = unit;
            this.state.staffList = staffList;
            this.state.daysInMonth = new Date(this.state.year, this.state.month, 0).getDate();
            
            // 建立單位對照表
            this.state.unitMap = {};
            if (allUnits) {
                allUnits.forEach(u => this.state.unitMap[u.unitId] = u.unitName);
            }

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

    // ✅ 修正 2: 渲染時顯示跨單位名稱
    renderGrid() {
        const container = document.getElementById('schedule-grid-container');
        const { year, month, daysInMonth, staffList, scheduleData, sortKey, sortAsc, unitMap, currentUnitId } = this.state;
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

        // 輔助：取得顯示名稱
        const getDisplayName = (staff) => {
            // 若無 unitId 或 unitId 與當前單位相同，顯示原名
            if (!staff.unitId || staff.unitId === currentUnitId) return staff.name;
            // 否則加上單位名稱
            const uName = unitMap[staff.unitId] || '外借';
            return `${staff.name}<span class="text-danger small ms-1">(${uName})</span>`;
        };

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
                    <td class="sticky-col second-col bg-white text-nowrap">${getDisplayName(staff)}</td>
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

    // ... (其餘所有方法保持不變) ...
    // 請務必保留 calculateRowStats, sortStaff, openShiftMenu, handleShiftSelect, updateScoreDisplay, showScoreDetails, resetToPreSchedule, togglePublish, updateStatusBadge, runMultiVersionAI, renderVersionsModal, applyVersion
    calculateRowStats(shifts) {
        // (略，請保留原程式碼)
        let off=0, e=0, n=0, hol=0;
        const { year, month, daysInMonth } = this.state;
        for (let d=1; d<=daysInMonth; d++) {
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
    // (為節省篇幅，其他方法省略，請確認檔案中依然存在)
    sortStaff(key) { /*...*/ }
    openShiftMenu(cell) { /*...*/ }
    async handleShiftSelect(cell, code) { /*...*/ }
    async updateScoreDisplay() { /*...*/ }
    showScoreDetails() { /*...*/ }
    async resetToPreSchedule(c) { /*...*/ }
    async togglePublish() { /*...*/ }
    updateStatusBadge() { /*...*/ }
    async runMultiVersionAI() { /*...*/ }
    renderVersionsModal() { /*...*/ }
    async applyVersion(i) { /*...*/ }
}
