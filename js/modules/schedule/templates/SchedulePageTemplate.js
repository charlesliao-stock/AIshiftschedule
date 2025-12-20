export const SchedulePageTemplate = {
    // 1. 主框架
    renderLayout(year, month) {
        return `
            <div class="schedule-container">
                <div class="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                    <div class="d-flex align-items-center text-nowrap">
                        <button class="btn btn-sm btn-outline-secondary me-3" onclick="window.location.hash='/schedule/list'">
                            <i class="fas fa-arrow-left"></i> 回列表
                        </button>
                        <div>
                            <span class="h4 align-middle fw-bold text-gray-800">
                                ${year}年 ${month}月 排班作業
                            </span>
                            <span id="schedule-status-badge" class="badge bg-secondary ms-2">載入中</span>
                        </div>
                    </div>
                    
                    <div id="loading-indicator" style="display:none;" class="text-primary fw-bold mx-3">
                        <i class="fas fa-spinner fa-spin"></i> 處理中...
                    </div>

                    <div class="d-flex align-items-center bg-white border rounded px-3 py-1" style="min-width: 150px;">
                        <div class="me-2 text-end flex-grow-1">
                            <div class="small text-muted fw-bold" style="font-size: 0.7rem;">品質總分</div>
                            <div class="h5 mb-0 fw-bold text-primary" id="score-display">--</div>
                        </div>
                        <button class="btn btn-sm btn-link text-info p-0" onclick="window.routerPage.showScoreDetails()" title="查看評分詳情">
                            <i class="fas fa-info-circle fs-5"></i>
                        </button>
                    </div>
                </div>
                
                <div class="schedule-toolbar d-flex justify-content-between align-items-center mb-3 flex-wrap flex-md-nowrap gap-2">
                    <div class="d-flex gap-2 flex-nowrap">
                        <button class="btn btn-outline-secondary btn-sm text-nowrap" onclick="window.location.hash='/unit/settings/rules'">
                            <i class="fas fa-cog"></i> 規則
                        </button>
                        <button id="btn-clear" class="btn btn-outline-danger btn-sm text-nowrap">
                            <i class="fas fa-undo"></i> 重置狀態
                        </button>
                    </div>

                    <div class="d-flex gap-2 flex-nowrap">
                        <button id="btn-auto-schedule" class="btn btn-primary btn-sm text-nowrap" style="background-color: #6366f1; border:none;">
                            <i class="fas fa-magic"></i> 智慧排班 (AI)
                        </button>
                        <button id="btn-validate" class="btn btn-outline-secondary btn-sm text-nowrap">
                            <i class="fas fa-check-circle"></i> 檢查
                        </button>
                        <button id="btn-publish" class="btn btn-success btn-sm text-nowrap">
                            <i class="fas fa-paper-plane"></i> 發布
                        </button>
                    </div>
                </div>

                <div id="ai-progress-container" class="card shadow-sm mb-3 border-primary" style="display:none;">
                    <div class="card-body py-2">
                        <div class="d-flex justify-content-between mb-1">
                            <span class="small fw-bold text-primary"><i class="fas fa-robot me-1"></i>AI 運算中...</span>
                            <span class="small fw-bold text-muted" id="ai-progress-text">準備開始</span>
                        </div>
                        <div class="progress" style="height: 10px;">
                            <div id="ai-progress-bar" class="progress-bar progress-bar-striped progress-bar-animated bg-primary" role="progressbar" style="width: 0%"></div>
                        </div>
                    </div>
                </div>

                <div id="schedule-grid-container" class="schedule-grid-wrapper border rounded"></div>

                <div class="modal fade" id="score-modal" tabindex="-1">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header bg-info text-white"><h5 class="modal-title">評分詳情</h5><button class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div>
                            <div class="modal-body p-0"><div id="score-details-body"></div></div>
                        </div>
                    </div>
                </div>

                <div class="modal fade" id="versions-modal" tabindex="-1">
                    <div class="modal-dialog modal-fullscreen">
                        <div class="modal-content">
                            <div class="modal-header bg-primary text-white"><h5 class="modal-title">AI 排班結果</h5><button class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div>
                            <div class="modal-body bg-light p-3" id="versions-modal-body"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // 2. 渲染主表格 Grid (包含完整統計與紅點邏輯)
    renderGrid(dataCtx, validationResult, options = {}) {
        const { year, month, daysInMonth, staffList, unitSettings, preSchedule, prevMonthInfo, previousMonthSchedule } = dataCtx;
        const assignments = dataCtx.scheduleData?.assignments || {};
        const { staffReport, coverageErrors } = validationResult;
        const { isInteractive = true, isDropZone = false, versionIdx = null } = options;

        const shiftDefs = unitSettings?.settings?.shifts || [];
        const shiftMap = {};
        shiftDefs.forEach(s => shiftMap[s.code] = s);
        shiftMap['OFF'] = { color: '#e5e7eb', name: '休' };
        shiftMap['M_OFF'] = { color: '#6f42c1', name: '管休' };

        // 統計計數器初始化
        const dailyCounts = {};
        shiftDefs.forEach(s => {
            dailyCounts[s.code] = {};
            for(let d=1; d<=daysInMonth; d++) dailyCounts[s.code][d] = 0;
        });

        // ========== 表頭 Header ==========
        let headerHtml = '<thead><tr><th class="sticky-col first-col bg-light" style="z-index:20;">人員</th><th class="sticky-col second-col bg-light" style="z-index:20;">職級</th><th class="sticky-col third-col bg-light" style="z-index:20;">備註</th>';
        
        // (A) 上月最後 6 天
        if (prevMonthInfo && prevMonthInfo.displayDays) {
            prevMonthInfo.displayDays.forEach(day => {
                const dateObj = new Date(prevMonthInfo.year, prevMonthInfo.month - 1, day);
                const weekStr = ['日','一','二','三','四','五','六'][dateObj.getDay()];
                headerHtml += `<th class="bg-secondary text-white" style="min-width:40px; opacity: 0.7;">
                    ${prevMonthInfo.month}/${day}<br><span style="font-size:0.8em">${weekStr}</span>
                </th>`;
            });
        }
        
        // (B) 本月日期
        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(year, month - 1, d);
            const weekStr = ['日','一','二','三','四','五','六'][dateObj.getDay()];
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
            
            let thClass = isWeekend ? 'text-danger' : '';
            if (coverageErrors && coverageErrors[d]) thClass += ' bg-warning'; 
            
            headerHtml += `<th class="${thClass}" style="min-width:40px;">
                ${d}<br><span style="font-size:0.8em">${weekStr}</span>
            </th>`;
        }
        
        headerHtml += `<th class="sticky-col right-col-4 bg-light">OFF</th>
                       <th class="sticky-col right-col-3 bg-light">假日</th>
                       <th class="sticky-col right-col-2 bg-light">小夜</th>
                       <th class="sticky-col right-col-1 bg-light">大夜</th>
                       </tr></thead>`;

        // ========== 表身 Body ==========
        let bodyHtml = '<tbody>';
        staffList.forEach(staff => {
            const uid = staff.uid;
            const staffAssignments = assignments[uid] || {};
            const staffErrors = staffReport[uid]?.errors || {};
            // 讀取該員工的預班願望 (Wishes)
            const wishes = preSchedule?.submissions?.[uid]?.wishes || {};
            
            // 狀態標籤
            let statusBadges = '';
            if (staff.constraints?.isPregnant) statusBadges += '<span class="badge bg-danger ms-1 small">孕</span>';
            if (staff.constraints?.isPostpartum) statusBadges += '<span class="badge bg-warning text-dark ms-1 small">哺</span>';
            if (staff.constraints?.canBatch) statusBadges += '<span class="badge bg-info text-dark ms-1 small">包</span>';
            
            // 預班備註
            let wishNote = '';
            if (preSchedule && preSchedule.submissions && preSchedule.submissions[uid]) {
               if(preSchedule.submissions[uid].notes) {
                   wishNote = `<div class="text-muted small text-truncate" style="max-width:120px;">📝 ${preSchedule.submissions[uid].notes}</div>`;
               }
            }

            const deleteBtn = isInteractive 
                ? `<i class="fas fa-times text-danger ms-2" style="cursor:pointer;" onclick="window.routerPage.deleteStaff('${uid}')"></i>` 
                : '';

            bodyHtml += `<tr>
                <td class="sticky-col first-col bg-white">
                    <div class="d-flex justify-content-between align-items-center">
                        <strong class="text-truncate" style="max-width: 50px;">${staff.name}</strong> ${statusBadges}
                        ${deleteBtn}
                    </div>
                </td>
                <td class="sticky-col second-col bg-white small text-muted">${staff.rank || ''}</td>
                <td class="sticky-col third-col bg-white">${wishNote}</td>`;

            // (A) 上月資料 (唯讀)
            if (prevMonthInfo && prevMonthInfo.displayDays) {
                const prevAssignments = previousMonthSchedule?.assignments?.[uid] || {};
                prevMonthInfo.displayDays.forEach(day => {
                    const code = prevAssignments[day] || '';
                    let style = 'background-color: #e9ecef; color: #6c757d; opacity: 0.8;';
                    if (code === 'N') style = 'background-color: #495057; color: #fff; opacity: 0.6;';
                    else if (code === 'E') style = 'background-color: #ffc107; color: #000; opacity: 0.5;';
                    else if (code === 'D') style = 'background-color: #d1e7dd; color: #0f5132; opacity: 0.6;';
                    
                    bodyHtml += `<td style="${style}"><span style="font-size: 0.85rem;">${code === 'M_OFF' ? 'OFF' : code}</span></td>`;
                });
            }

            let countOFF = 0, countHolidayOFF = 0, countE = 0, countN = 0;

            // (B) 本月日期
            for (let d = 1; d <= daysInMonth; d++) {
                const code = staffAssignments[d] || '';
                const wish = wishes[d]; // 取得該日的預班
                
                // 統計
                const dateObj = new Date(year, month - 1, d);
                const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                if (code === 'OFF' || code === 'M_OFF') {
                    countOFF++;
                    if (isWeekend) countHolidayOFF++;
                } else if (code === 'E') countE++;
                else if (code === 'N') countN++;

                if (dailyCounts[code]) dailyCounts[code][d] = (dailyCounts[code][d] || 0) + 1;

                // 樣式
                let style = '';
                if(code === 'M_OFF') style = 'background-color:#6f42c1; color:white;';
                else if (code && shiftMap[code]) style = `background-color:${shiftMap[code].color}40; border-bottom: 2px solid ${shiftMap[code].color}`;
                
                // 🚩 紅點邏輯 (Restored Red Dot)
                let markerHtml = '';
                if (wish) {
                    markerHtml = `<div class="wish-marker" title="預班: ${wish}">●</div>`;
                    // 如果實際排班與預班不同，背景變黃提醒
                    if (wish !== code && wish !== (code === 'OFF' ? 'M_OFF' : '')) {
                         style += 'background-color: #fff3cd !important;'; 
                    }
                }

                const errorMsg = staffErrors[d];
                const borderStyle = errorMsg ? 'border: 2px solid red !important;' : '';
                const title = errorMsg ? `title="${errorMsg}"` : '';
                const cellClass = isInteractive ? 'shift-cell' : ''; 
                // 加入 wish-cell 類別以便定位紅點
                const wishClass = 'wish-cell'; 
                const cursor = isInteractive ? 'cursor:pointer;' : '';
                const dropAttrs = isDropZone ? `ondragover="event.preventDefault()" ondrop="window.routerPage.handleDrop(event, '${uid}', ${d}, ${versionIdx})"` : '';

                bodyHtml += `<td class="${cellClass} ${wishClass}" data-staff-id="${uid}" data-day="${d}" 
                    style="${cursor} ${style}; ${borderStyle}" ${title} ${dropAttrs}>
                    ${markerHtml}
                    ${code === 'M_OFF' ? 'OFF' : code}
                </td>`;
            }
            
            // (C) 右側統計
            bodyHtml += `<td class="sticky-col right-col-4 bg-white text-center fw-bold">${countOFF}</td>
                         <td class="sticky-col right-col-3 bg-white text-center fw-bold text-success">${countHolidayOFF}</td>
                         <td class="sticky-col right-col-2 bg-white text-center fw-bold text-warning-dark">${countE}</td>
                         <td class="sticky-col right-col-1 bg-white text-center fw-bold text-danger">${countN}</td>
                         </tr>`;
        });

        // ========== 底部需求統計 ==========
        const staffReq = unitSettings.staffRequirements || {}; 
        shiftDefs.forEach(shiftDef => {
            const code = shiftDef.code;
            const name = shiftDef.name;
            
            bodyHtml += `<tr class="stats-row" style="border-top: 2px solid #666;">
                <td class="sticky-col first-col bg-light"></td>
                <td class="sticky-col second-col bg-light fw-bold text-end pe-2">${name}</td>
                <td class="sticky-col third-col bg-light small text-muted">實際/需求</td>`;
            
            if (prevMonthInfo && prevMonthInfo.displayDays) {
                prevMonthInfo.displayDays.forEach(() => bodyHtml += '<td class="bg-light"></td>');
            }
            
            for (let d = 1; d <= daysInMonth; d++) {
                const date = new Date(year, month - 1, d);
                const dayOfWeek = date.getDay();
                const required = staffReq[code]?.[dayOfWeek] || 0;
                const assigned = dailyCounts[code] ? dailyCounts[code][d] : 0;
                
                let textClass = 'text-success';
                if (assigned < required) textClass = 'text-danger fw-bold';
                else if (assigned > required) textClass = 'text-primary';
                
                bodyHtml += `<td class="text-center small ${textClass}" style="background-color:#f8f9fa;">${assigned}/${required}</td>`;
            }
            bodyHtml += `<td class="sticky-col right-col-4 bg-light"></td><td class="sticky-col right-col-3 bg-light"></td><td class="sticky-col right-col-2 bg-light"></td><td class="sticky-col right-col-1 bg-light"></td></tr>`;
        });

        bodyHtml += '</tbody>';
        return `<table class="schedule-table table table-bordered table-sm text-center mb-0">${headerHtml}${bodyHtml}</table>`;
    },

    renderScoreDetails(result) {
        if(!result || !result.details) return '<div class="p-3 text-center">尚無評分資料</div>';
        const d = result.details;
        const renderItem = (label, obj, extra='') => `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <span>${label}</span>
                <div class="text-end">
                    <span class="badge bg-primary rounded-pill">${obj && obj.score ? obj.score.toFixed(0) : 0}分</span>
                    <small class="text-muted ms-2">${extra}</small>
                </div>
            </li>`;

        return `
            <div class="p-3 bg-light text-center border-bottom">
                <h1 class="display-4 fw-bold mb-0 ${result.totalScore>=80?'text-success':'text-primary'}">${result.totalScore}</h1>
                <div class="small text-muted">總分</div>
                ${result.passed ? '<span class="badge bg-success">規則通過</span>' : '<span class="badge bg-danger">規則未通過</span>'}
            </div>
            <ul class="list-group list-group-flush">
                ${renderItem('公平性', d.fairness)}
                ${renderItem('滿意度', d.satisfaction)}
                ${renderItem('效率', d.efficiency, d.efficiency?.coverage)}
                ${renderItem('健康', d.health)}
                ${renderItem('品質', d.quality)}
                ${renderItem('成本', d.cost)}
            </ul>
        `;
    },

    renderMissingPool(missing) {
        if (!missing || missing.length === 0) return '<div class="alert alert-success py-1 mb-2 small"><i class="fas fa-check"></i> 人力需求已全數滿足</div>';
        let poolHtml = '<div class="card mb-2 border-danger"><div class="card-header bg-danger text-white py-1 small">缺班池 (請拖曳補班)</div><div class="card-body p-2 d-flex flex-wrap gap-2">';
        missing.forEach(m => { 
            poolHtml += `<span class="badge bg-dark p-2" style="cursor:grab;" draggable="true" ondragstart="window.routerPage.handleDragStart(event, '${m.shift}')">${m.day}日: ${m.shift} <span class="badge bg-light text-dark rounded-pill ms-1">${m.count}</span></span>`; 
        });
        poolHtml += '</div></div>';
        return poolHtml;
    }
};
