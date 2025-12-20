// SchedulePage.js - 修改重點：renderHeader() 和 renderStaffRow() 增加上月6天顯示

// 在 loadData() 方法中增加獲取上月排班資料
async loadData() {
    const { currentUnitId, year, month } = this.state;
    
    let unitData = await UnitService.getUnitByIdWithCache(currentUnitId);
    if (!unitData.settings) {
        const settingsOnly = await UnitService.getUnitSettings(currentUnitId);
        unitData = { ...unitData, ...settingsOnly };
    }
    this.state.unitSettings = unitData;

    this.state.preSchedule = await PreScheduleService.getPreSchedule(currentUnitId, year, month);
    this.state.scheduleData = await ScheduleService.getSchedule(currentUnitId, year, month);

    // ✅ 新增：獲取上個月排班資料（用於顯示月底6天）
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth === 0) {
        prevMonth = 12;
        prevYear--;
    }
    
    // 獲取上月排班
    const prevMonthSchedule = await ScheduleService.getSchedule(currentUnitId, prevYear, prevMonth);
    this.state.previousMonthSchedule = prevMonthSchedule;
    
    // 計算上月天數和需要顯示的日期
    const prevDaysInMonth = new Date(prevYear, prevMonth, 0).getDate();
    this.state.prevMonthInfo = {
        year: prevYear,
        month: prevMonth,
        daysInMonth: prevDaysInMonth,
        displayDays: [] // 存儲要顯示的6天日期
    };
    
    // 生成上月最後6天的日期陣列
    for (let i = 5; i >= 0; i--) {
        this.state.prevMonthInfo.displayDays.push(prevDaysInMonth - i);
    }

    // 原有的初始化邏輯...
    if (!this.state.scheduleData) {
        if (!this.state.preSchedule) {
            this.state.staffList = []; 
            document.getElementById('schedule-container').innerHTML = `
                <div class="alert alert-warning m-5 text-center">
                    <h4><i class="fas fa-exclamation-triangle"></i> 無法建立排班表</h4>
                    <p class="mb-4">找不到 ${year}年${month}月 的預班表資料。</p>
                    <p>排班作業必須基於「預班表」進行。請先至【預班管理】完成預班發布與確認。</p>
                    <a href="#/pre-schedule/manage" class="btn btn-primary">前往預班管理</a>
                </div>`;
            throw new Error("中止載入：無預班表");
        }

        console.log("初始化排班表 (基於預班表)...");
        this.state.scheduleData = {
            unitId: currentUnitId, year, month,
            assignments: {},
            logs: [],
            version: 0,
            activeVersion: 0
        };
        this.performReset(false); 
    }
    
    this.state.daysInMonth = new Date(year, month, 0).getDate();

    // 原有的員工列表載入邏輯...
    let finalStaffList = [];
    const unitUsers = await userService.getUsersByUnit(currentUnitId);
    const userMap = {};
    unitUsers.forEach(u => userMap[u.uid] = u);

    if (this.state.preSchedule && this.state.preSchedule.staffIds) {
        const promises = this.state.preSchedule.staffIds.map(async (uid) => {
            if (userMap[uid]) return userMap[uid];
            try {
                return await userService.getUserData(uid);
            } catch (e) {
                return null;
            }
        });
        const results = await Promise.all(promises);
        finalStaffList = results.filter(u => u !== null);
    } else {
        finalStaffList = unitUsers;
    }

    this.state.staffList = finalStaffList;
    
    const unitName = this.state.unitSettings.unitName || '未命名單位';
    document.getElementById('schedule-title').textContent = `${unitName} ${year}年${month}月`;
}

// ✅ 修改 renderHeader() - 加入上月6天
renderHeader(daysInMonth) {
    const { prevMonthInfo } = this.state;
    
    let html = `<tr>
        <th class="sticky-col first-col cursor-pointer" data-sort="staffId">職編 <i class="fas fa-sort sort-icon"></i></th>
        <th class="sticky-col second-col cursor-pointer" data-sort="name">姓名 <i class="fas fa-sort sort-icon"></i></th>
        <th class="sticky-col third-col">備註<br><span style="font-size:0.65rem; color:#666;">(狀態/偏好)</span></th>
    `;
    
    // ✅ 渲染上月最後6天
    if (prevMonthInfo && prevMonthInfo.displayDays) {
        prevMonthInfo.displayDays.forEach(day => {
            const date = new Date(prevMonthInfo.year, prevMonthInfo.month - 1, day);
            const dayOfWeek = date.getDay();
            const weekStr = ['日','一','二','三','四','五','六'][dayOfWeek];
            
            // 上月資料用灰色背景，假日不特別標記
            html += `<th class="bg-secondary text-white" style="opacity: 0.7;">
                ${prevMonthInfo.month}/${day}<br><span style="font-size:0.75rem">${weekStr}</span>
            </th>`;
        });
    }
    
    // 渲染本月日期
    for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(this.state.year, this.state.month - 1, d);
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const weekStr = ['日','一','二','三','四','五','六'][dayOfWeek];
        
        // ✅ 假日與平日使用相同背景色（移除 bg-light-gray）
        html += `<th class="${isWeekend ? 'text-danger' : ''}">
            ${d}<br><span style="font-size:0.75rem">${weekStr}</span>
        </th>`;
    }
    
    html += `<th class="sticky-col right-col-4">OFF</th>
             <th class="sticky-col right-col-3">假日</th>
             <th class="sticky-col right-col-2">小夜</th>
             <th class="sticky-col right-col-1">大夜</th>
             </tr>`;
    return html;
}

// ✅ 修改 renderStaffRow() - 加入上月6天顯示
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
    
    // ✅ 渲染上月最後6天（唯讀，灰色背景）
    if (prevMonthInfo && prevMonthInfo.displayDays && previousMonthSchedule) {
        const prevAssignments = previousMonthSchedule.assignments?.[uid] || {};
        
        prevMonthInfo.displayDays.forEach(day => {
            const shift = prevAssignments[day] || '';
            const date = new Date(prevMonthInfo.year, prevMonthInfo.month - 1, day);
            const dayOfWeek = date.getDay();
            
            // ✅ 上月資料：灰色背景，假日與平日相同
            let cellStyle = 'background-color: #e9ecef; color: #6c757d;'; // 灰色背景
            
            // 根據班別顯示不同顏色（淡化）
            if (shift === 'N') {
                cellStyle = 'background-color: #495057; color: #fff; opacity: 0.6;';
            } else if (shift === 'E') {
                cellStyle = 'background-color: #ffc107; color: #000; opacity: 0.5;';
            } else if (shift === 'D') {
                cellStyle = 'background-color: #d1e7dd; color: #0f5132; opacity: 0.6;';
            } else if (shift === 'OFF' || shift === 'M_OFF') {
                cellStyle = 'background-color: #f0f0f0; color: #999;';
            }
            
            html += `<td style="${cellStyle}" title="上月資料（唯讀）">
                <span style="font-size: 0.9rem;">${shift}</span>
            </td>`;
        });
    }
    
    // 統計變數
    let countOFF = 0;
    let countHolidayOFF = 0;
    let countE = 0;
    let countN = 0;

    // 渲染本月日期（可編輯）
    for (let d = 1; d <= daysInMonth; d++) {
        const shift = assignments[d] || '';
        const wish = wishes[d];

        const date = new Date(this.state.year, this.state.month - 1, d);
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        
        // 統計邏輯
        if (shift === 'OFF' || shift === 'M_OFF') {
            countOFF++;
            if (isWeekend) {
                countHolidayOFF++;
            }
        } else if (shift === 'E') {
            countE++;
        } else if (shift === 'N') {
            countN++;
        }

        let cellStyle = this.getShiftStyle(shift);
        let markerHtml = '';
        
        if (wish) {
            markerHtml = `<div class="wish-marker" title="預班: ${wish}">●</div>`;
            if (wish !== shift) {
               cellStyle += 'background-color: #fff3cd !important;'; 
            }
        }
        
        // ✅ 假日不加特殊背景色
        // if (isWeekend) cellStyle += 'background-color: #f8f9fa;'; // 移除此行

        html += `<td class="shift-cell wish-cell" style="${cellStyle}" data-uid="${uid}" data-day="${d}">
            ${markerHtml}
            <input type="text" class="shift-input" value="${shift}" maxlength="3" data-uid="${uid}" data-day="${d}" 
                   style="background:transparent; color: inherit;">
        </td>`;
    }

    // 渲染統計結果
    html += `<td class="sticky-col right-col-4 text-center fw-bold">${countOFF}</td>
             <td class="sticky-col right-col-3 text-center fw-bold text-success">${countHolidayOFF}</td>
             <td class="sticky-col right-col-2 text-center fw-bold text-warning-dark">${countE}</td>
             <td class="sticky-col right-col-1 text-center fw-bold text-danger">${countN}</td>
             </tr>`;
    return html;
}

// ✅ 修改 renderStatsRow() - 加入上月6天空白欄位
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

        // ✅ 上月6天空白欄位（灰色背景）
        if (prevMonthInfo && prevMonthInfo.displayDays) {
            prevMonthInfo.displayDays.forEach(() => {
                rowsHtml += `<td class="bg-secondary" style="opacity: 0.3;"></td>`;
            });
        }

        // 本月統計
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

            // ✅ 假日不加特殊背景
            rowsHtml += `<td class="${isWeekend ? '' : ''} text-center small ${textClass}" 
                             title="${name}: 已排${assigned}人 / 需${required}人">
                ${assigned}/${required}
            </td>`;
        }

        rowsHtml += `<td class="sticky-col right-col-4"></td>
                     <td class="sticky-col right-col-3"></td>
                     <td class="sticky-col right-col-2"></td>
                     <td class="sticky-col right-col-1"></td>
                     </tr>`;
    });

    return rowsHtml;
}
