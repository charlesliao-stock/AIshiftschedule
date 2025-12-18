import { UnitService } from "../../services/firebase/UnitService.js";
import { userService } from "../../services/firebase/UserService.js";
import { ScheduleService } from "../../services/firebase/ScheduleService.js";
import { PreScheduleService } from "../../services/firebase/PreScheduleService.js";
import { ScoringService } from "../../services/ScoringService.js";

// ✅ 修正引用路徑：從 modules/schedule/ 連到 modules/ai/
import { RuleEngine } from "../ai/RuleEngine.js";
import { AutoScheduler } from "../ai/AutoScheduler.js";

export class SchedulePage {
    // ... (constructor 與其他部分保持不變) ...

    // 🔥 輔助：取得班別顏色
    getShiftColor(code) {
        if (!code) return '#ffffff';
        if (code === 'OFF' || code === 'M_OFF') return '#f0f0f0'; // 灰色
        
        const shifts = this.state.unitSettings?.settings?.shifts || [];
        const shiftDef = shifts.find(s => s.code === code);
        return shiftDef ? shiftDef.color : '#ffffff';
    }

    // 🔥 輔助：取得班別文字顏色 (深底配白字)
    getShiftTextColor(code) {
        if (code === 'OFF' || code === 'M_OFF') return '#333';
        // 簡單判斷：若不是 OFF，預設白字 (因為通常班別顏色較深)
        // 也可以根據 shiftDef.color 亮度計算
        return '#fff'; 
    }

    // 渲染主表格
    renderGrid() {
        // ... (取得資料與 Header 部分同前版) ...
        const { year, month, daysInMonth, staffList, scheduleData } = this.state;
        const assignments = scheduleData.assignments || {};

        // 建立每日統計物件 (初始為 0)
        const dailyCounts = {};
        for(let d=1; d<=daysInMonth; d++) dailyCounts[d] = {D:0, E:0, N:0, OFF:0};

        let html = `...`; // (Table Header HTML 同前)

        staffList.forEach(staff => {
            const uid = staff.uid;
            const userShifts = assignments[uid] || {};
            // 計算該員統計
            const stats = this.calculateRowStats(userShifts);

            html += `<tr>...`; // (職編/姓名/備註 HTML)

            // 渲染每一天
            for (let d = 1; d <= daysInMonth; d++) {
                const val = userShifts[d] || '';
                
                // 累加每日統計
                if (val && dailyCounts[d]) {
                    const key = (val === 'M_OFF') ? 'OFF' : val;
                    if (dailyCounts[d][key] !== undefined) dailyCounts[d][key]++;
                }

                // 🎨 應用顏色
                const bgColor = this.getShiftColor(val);
                const textColor = this.getShiftTextColor(val);

                html += `<td class="p-0 shift-cell" 
                            data-staff-id="${uid}" 
                            data-day="${d}" 
                            onclick="window.routerPage.openShiftMenu(this)" 
                            style="background-color:${bgColor}; color:${textColor}; cursor:pointer;">
                            ${val}
                         </td>`;
            }

            // 右側統計欄位 (給予 ID 以便即時更新)
            html += `
                <td id="stat-off-${uid}">${stats.off}</td>
                <td id="stat-e-${uid}">${stats.e}</td>
                <td id="stat-n-${uid}">${stats.n}</td>
                <td id="stat-hol-${uid}">${stats.hol}</td>
            </tr>`;
        });

        // 底部每日統計列 (給予 ID)
        html += `<tr class="fw-bold bg-light" style="border-top:2px solid #999">
                    <td colspan="3">每日人力</td>`;
        // 上月留空
        // ...
        
        // 本月每日
        const reqMatrix = this.state.unitSettings?.staffRequirements || { D:[], E:[], N:[] };
        for (let d = 1; d <= daysInMonth; d++) {
            const w = new Date(year, month - 1, d).getDay();
            const reqD = parseInt(reqMatrix.D?.[w] || 0);
            const reqE = parseInt(reqMatrix.E?.[w] || 0);
            const reqN = parseInt(reqMatrix.N?.[w] || 0);
            const c = dailyCounts[d];

            html += `<td class="p-1" id="daily-stat-${d}" style="font-size:0.7rem; line-height:1.2">
                        ${this.renderDailyStatCell(c, reqD, reqE, reqN)}
                     </td>`;
        }
        html += `</tr></tbody></table></div>`;
        
        container.innerHTML = html;
    }

    // 輔助：產生每日統計格 HTML
    renderDailyStatCell(counts, reqD, reqE, reqN) {
        // 紅字: 缺人, 綠字: 剛好, 橘字: 超過
        const getStyle = (curr, req) => {
            if (curr < req) return 'color:red; font-weight:bold;';
            if (curr > req) return 'color:orange;';
            return 'color:green;';
        };

        return `
            <div style="${getStyle(counts.D, reqD)}">D:${counts.D}/${reqD}</div>
            <div style="${getStyle(counts.E, reqE)}">E:${counts.E}/${reqE}</div>
            <div style="${getStyle(counts.N, reqN)}">N:${counts.N}/${reqN}</div>
        `;
    }

    // 🔥 關鍵修正：當使用者修改班別時，觸發即時重算
    async handleShiftSelect(cell, code) {
        this.closeMenu();
        const uid = cell.dataset.staffId;
        const day = parseInt(cell.dataset.day);

        // 1. 更新資料
        if (!this.state.scheduleData.assignments[uid]) this.state.scheduleData.assignments[uid] = {};
        this.state.scheduleData.assignments[uid][day] = code;

        // 2. 更新該格顏色
        cell.textContent = code;
        cell.style.backgroundColor = this.getShiftColor(code);
        cell.style.color = this.getShiftTextColor(code);

        // 3. 🔥 即時更新所有統計數據 (不重新渲染整個表格)
        this.updateAllStats();

        // 4. 存檔 (非同步)
        await ScheduleService.updateShift(this.state.currentUnitId, this.state.year, this.state.month, uid, day, code);
        this.updateScoreDisplay(); // 更新總分
    }

    // 🔥 全新：即時計算並更新 DOM
    updateAllStats() {
        const { year, month, daysInMonth, staffList, scheduleData } = this.state;
        const assignments = scheduleData.assignments;
        const reqMatrix = this.state.unitSettings?.staffRequirements || { D:[], E:[], N:[] };
        const dailyCounts = {};

        // 初始化每日計數
        for(let d=1; d<=daysInMonth; d++) dailyCounts[d] = {D:0, E:0, N:0, OFF:0};

        // 遍歷所有人
        staffList.forEach(staff => {
            const uid = staff.uid;
            const shifts = assignments[uid] || {};
            
            // 1. 更新個人統計 (右側)
            const stats = this.calculateRowStats(shifts);
            const elOff = document.getElementById(`stat-off-${uid}`);
            if (elOff) elOff.textContent = stats.off;
            const elE = document.getElementById(`stat-e-${uid}`);
            if (elE) elE.textContent = stats.e;
            const elN = document.getElementById(`stat-n-${uid}`);
            if (elN) elN.textContent = stats.n;
            const elHol = document.getElementById(`stat-hol-${uid}`);
            if (elHol) elHol.textContent = stats.hol;

            // 2. 累加每日統計
            for (let d = 1; d <= daysInMonth; d++) {
                const s = shifts[d];
                if (s) {
                    const key = (s === 'M_OFF') ? 'OFF' : s;
                    if (dailyCounts[d][key] !== undefined) dailyCounts[d][key]++;
                }
            }
        });

        // 3. 更新底部每日統計 DOM
        for (let d = 1; d <= daysInMonth; d++) {
            const cell = document.getElementById(`daily-stat-${d}`);
            if (cell) {
                const w = new Date(year, month - 1, d).getDay();
                const reqD = parseInt(reqMatrix.D?.[w] || 0);
                const reqE = parseInt(reqMatrix.E?.[w] || 0);
                const reqN = parseInt(reqMatrix.N?.[w] || 0);
                
                cell.innerHTML = this.renderDailyStatCell(dailyCounts[d], reqD, reqE, reqN);
            }
        }
    }

    // AI 結果預覽視窗 (也應用顏色)
    renderVersionsModal() {
        this.generatedVersions.forEach((v, idx) => {
            const tabPane = document.getElementById(`v${v.id}`);
            if(!tabPane) return;
            // ... (Header HTML)
            
            let tableHtml = `<table ...><thead>...</thead><tbody>`;
            
            this.state.staffList.forEach(s => {
                tableHtml += `<tr><td class="fw-bold sticky-col first-col">${s.name}</td>`;
                
                for (let d = 1; d <= this.state.daysInMonth; d++) {
                    const val = v.assignments[s.uid]?.[d] || '';
                    // 🎨 應用顏色
                    const bg = this.getShiftColor(val);
                    const color = this.getShiftTextColor(val);
                    
                    tableHtml += `<td style="background:${bg}; color:${color};">${val}</td>`;
                }
                tableHtml += `</tr>`;
            });
            tableHtml += `</tbody></table>`;
            // ... (Footer HTML)
            
            tabPane.innerHTML = `...${tableHtml}...`;
        });
    }
}
