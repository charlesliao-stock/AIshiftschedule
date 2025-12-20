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
                    <div class="modal-dialog modal-xl">
                        <div class="modal-content">
                            <div class="modal-header bg-gradient-primary text-white"><h5 class="modal-title">AI 排班結果</h5><button class="btn-close btn-close-white" data-bs-dismiss="modal"></button></div>
                            <div class="modal-body p-0">
                                <ul class="nav nav-tabs nav-fill bg-light" id="versionTabs" role="tablist">
                                    <li class="nav-item"><button class="nav-link active fw-bold" data-bs-toggle="tab" data-bs-target="#v1">版本 1</button></li>
                                    <li class="nav-item"><button class="nav-link fw-bold" data-bs-toggle="tab" data-bs-target="#v2">版本 2</button></li>
                                    <li class="nav-item"><button class="nav-link fw-bold" data-bs-toggle="tab" data-bs-target="#v3">版本 3</button></li>
                                </ul>
                                <div class="tab-content" id="versionTabsContent">
                                    <div class="tab-pane fade show active" id="v1"></div>
                                    <div class="tab-pane fade" id="v2"></div>
                                    <div class="tab-pane fade" id="v3"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    // 2. 渲染主表格 Grid
export const SchedulePageTemplate = {
    // 1. 主框架
    renderLayout(year, month) {
        // ... (保持原本內容)
        return `
            <div class="schedule-container">
               <div id="schedule-grid-container" class="schedule-grid-wrapper border rounded"></div>
               </div>
        `;
    },

    // 2. 渲染主表格 Grid (核心修改)
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

        // ========== 表頭 Header ==========
        let headerHtml = '<thead><tr><th class="sticky-col bg-light" style="min-width:140px; z-index:20;">人員 / 日期</th>';
        
// (A) 渲染上月最後 6 天（唯讀，灰色背景）
            if (prevMonthInfo && prevMonthInfo.displayDays) {  // ⬅️ 這裡必須要有大括號
                const prevAssignments = previousMonthSchedule?.assignments?.[uid] || {};
                
                prevMonthInfo.displayDays.forEach(day => {
                    const code = prevAssignments[day] || '';
                    
                    // 灰色背景，不區分假日，根據班別微調
                    let style = 'background-color: #e9ecef; color: #6c757d; opacity: 0.8;';
                    if (code === 'N') style = 'background-color: #495057; color: #fff; opacity: 0.6;';
                    else if (code === 'E') style = 'background-color: #ffc107; color: #000; opacity: 0.5;';
                    else if (code === 'D') style = 'background-color: #d1e7dd; color: #0f5132; opacity: 0.6;';
                    else if (code === 'OFF' || code === 'M_OFF') style = 'background-color: #f0f0f0; color: #999; opacity: 0.7;';
                    
                    bodyHtml += `<td style="${style}" title="上月 ${day} 日 (唯讀)">
                        <span style="font-size: 0.85rem;">${code === 'M_OFF' ? 'OFF' : code}</span>
                    </td>`;
                });
            } // ⬅️ 記得閉合大括號
        
        // (B) 渲染本月日期
        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(year, month - 1, d);
            const weekStr = ['日','一','二','三','四','五','六'][dateObj.getDay()];
            const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
            
            // 假日只標紅字，不改背景色
            let thClass = isWeekend ? 'text-danger' : '';
            if (coverageErrors && coverageErrors[d]) thClass += ' bg-warning'; 
            
            headerHtml += `<th class="${thClass}" style="min-width:40px;">
                ${d}<br><span style="font-size:0.8em">${weekStr}</span>
            </th>`;
        }
        headerHtml += '</tr></thead>';

        // ========== 表身 Body ==========
        let bodyHtml = '<tbody>';
        staffList.forEach(staff => {
            const uid = staff.uid;
            const staffAssignments = assignments[uid] || {};
            const staffErrors = staffReport[uid]?.errors || {};
            
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
                <td class="sticky-col bg-white" style="z-index:10;">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <strong>${staff.name}</strong> ${statusBadges}<br>
                            <span class="text-muted small">${staff.rank || ''}</span>
                            ${wishNote}
                        </div>
                        ${deleteBtn}
                    </div>
                </td>`;

            // (A) 渲染上月最後 6 天（唯讀，灰色背景）
            if (prevMonthInfo && prevMonthInfo.displayDays) {
                const prevAssignments = previousMonthSchedule?.assignments?.[uid] || {};
                
                prevMonthInfo.displayDays.forEach(day => {
                    const code = prevAssignments[day] || '';
                    
                    // 灰色背景，不區分假日，根據班別微調
                    let style = 'background-color: #e9ecef; color: #6c757d; opacity: 0.8;';
                    if (code === 'N') style = 'background-color: #495057; color: #fff; opacity: 0.6;';
                    else if (code === 'E') style = 'background-color: #ffc107; color: #000; opacity: 0.5;';
                    else if (code === 'D') style = 'background-color: #d1e7dd; color: #0f5132; opacity: 0.6;';
                    else if (code === 'OFF' || code === 'M_OFF') style = 'background-color: #f0f0f0; color: #999; opacity: 0.7;';
                    
                    bodyHtml += `<td style="${style}" title="上月 ${day} 日 (唯讀)">
                        <span style="font-size: 0.85rem;">${code === 'M_OFF' ? 'OFF' : code}</span>
                    </td>`;
                });
            }

            // (B) 渲染本月日期
            for (let d = 1; d <= daysInMonth; d++) {
                const code = staffAssignments[d] || '';
                let style = '';
                
                if(code === 'M_OFF') {
                    style = 'background-color:#6f42c1; color:white;';
                } else if (code && shiftMap[code]) {
                    style = `background-color:${shiftMap[code].color}40; border-bottom: 2px solid ${shiftMap[code].color}`;
                }
                
                const errorMsg = staffErrors[d];
                const borderStyle = errorMsg ? 'border: 2px solid red !important;' : '';
                const title = errorMsg ? `title="${errorMsg}"` : '';
                const cellClass = isInteractive ? 'shift-cell' : ''; 
                const cursor = isInteractive ? 'cursor:pointer;' : '';
                const dropAttrs = isDropZone ? `ondragover="event.preventDefault()" ondrop="window.routerPage.handleDrop(event, '${uid}', ${d}, ${versionIdx})"` : '';

                bodyHtml += `<td class="${cellClass}" data-staff-id="${uid}" data-day="${d}" 
                    style="${cursor} ${style}; ${borderStyle}" ${title} ${dropAttrs}>
                    ${code === 'M_OFF' ? 'OFF' : code}
                </td>`;
            }
            bodyHtml += '</tr>';
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
