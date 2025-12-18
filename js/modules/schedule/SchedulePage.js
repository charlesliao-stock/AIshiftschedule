import { UnitService } from "../../services/firebase/UnitService.js";
import { userService } from "../../services/firebase/UserService.js";
import { ScheduleService } from "../../services/firebase/ScheduleService.js";
import { PreScheduleService } from "../../services/firebase/PreScheduleService.js";
import { ScoringService } from "../../services/ScoringService.js";

// ✅ 修正引用路徑
import { RuleEngine } from "../ai/RuleEngine.js";
import { AutoScheduler } from "../ai/AutoScheduler.js";

export class SchedulePage {
    // ... (constructor, cleanup, render, afterRender, loadData 等方法保持與 Turn 20 相同，請直接複製 Turn 20 的代碼，或只替換 renderGrid) ...
    // 為節省篇幅，此處僅提供修改後的 renderGrid 方法，請將其替換入原檔案中

    // ... (前面省略) ...

    renderGrid() {
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

            // ✅ 檢查是否人力不足，若是則標記 hasError
            const hasError = (counts.D < reqD) || (counts.E < reqE) || (counts.N < reqN);
            
            // 設定樣式：若有缺人，加上紅色邊框與背景
            const errorStyle = hasError ? 'border: 3px solid #dc3545 !important; background-color: #ffe6e6 !important;' : '';

            dailyStats[d] = {
                counts,
                style: errorStyle, // 傳遞樣式
                html: `
                    <div style="font-size:0.6rem; line-height:1.1;">
                        <span class="${counts.D < reqD ? 'text-danger fw-bold' : (counts.D > reqD ? 'text-warning' : '')}">D:${counts.D}/${reqD}</span><br>
                        <span class="${counts.E < reqE ? 'text-danger fw-bold' : (counts.E > reqE ? 'text-warning' : '')}">E:${counts.E}/${reqE}</span><br>
                        <span class="${counts.N < reqN ? 'text-danger fw-bold' : (counts.N > reqN ? 'text-warning' : '')}">N:${counts.N}/${reqN}</span>
                    </div>
                `
            };
        }

        let html = `
            <div class="schedule-table-wrapper shadow-sm bg-white rounded">
                <table class="table table-bordered table-sm text-center mb-0 align-middle schedule-grid">
                    <thead class="bg-light">
                        <tr>
                            <th class="sticky-col first-col bg-light cursor-pointer" onclick="window.routerPage.sortStaff('staffId')" title="依職編排序">
                                職編 <span class="sort-icon">${getArrow('staffId')}</span>
                            </th>
                            <th class="sticky-col second-col bg-light cursor-pointer" onclick="window.routerPage.sortStaff('name')" title="依姓名排序">
                                姓名 <span class="sort-icon">${getArrow('name')}</span>
                            </th>
                            <th class="sticky-col third-col bg-light">備註</th>
        `;
        const prevMonthLastDate = new Date(year, month - 1, 0); 
        const prevLastDayVal = prevMonthLastDate.getDate();
        const prevDaysToShow = [];
        for(let i=5; i>=0; i--) { prevDaysToShow.push(prevLastDayVal - i); }
        prevDaysToShow.forEach(d => html += `<th class="text-muted bg-light-gray" style="font-size:0.8rem">${d}</th>`);
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month - 1, d);
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const weekStr = ['日','一','二','三','四','五','六'][date.getDay()];
            
            // ✅ 若當天有缺人，表頭也加上紅色底線提示
            const headerStyle = dailyStats[d].style ? 'border-bottom: 3px solid red;' : '';
            
            html += `<th class="${isWeekend?'text-danger':''}" style="font-size:0.9rem; ${headerStyle}">${d}<div style="font-size:0.7rem">${weekStr}</div></th>`;
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
        // ... (中間渲染 staff rows 保持不變，直接複製原代碼) ...
        staffList.forEach(staff => {
            const uid = staff.uid;
            const userShifts = assignments[uid] || {};
            const prevUserShifts = prevAssignments[uid] || {};
            const stats = this.calculateRowStats(userShifts);
            const noteText = getNoteContent(staff);

            html += `
                <tr>
                    <td class="sticky-col first-col bg-white fw-bold">${staff.staffId || staff.id || ''}</td>
                    <td class="sticky-col second-col bg-white text-nowrap">${getDisplayName(staff)}</td>
                    <td class="sticky-col third-col bg-white small text-muted text-truncate" title="${noteText}">${noteText}</td>
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

        // 統計列 (Footer)
        html += `
            <tr class="stats-row">
                <td class="sticky-col first-col">統計</td>
                <td class="sticky-col second-col">每日人力</td>
                <td class="sticky-col third-col"></td>
        `;
        prevDaysToShow.forEach(() => html += `<td></td>`);
        for (let d = 1; d <= daysInMonth; d++) {
            // ✅ 應用紅框樣式
            html += `<td class="p-1" style="${dailyStats[d].style}">${dailyStats[d].html}</td>`;
        }
        html += `<td colspan="4"></td></tr>`;

        html += `</tbody></table></div>`;
        container.innerHTML = html;
    }

    // ... (其餘 SchedulePage 的方法請務必保留) ...
}
