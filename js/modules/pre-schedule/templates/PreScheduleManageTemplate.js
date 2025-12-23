export const PreScheduleManageTemplate = {
    // 1. 主畫面框架
    renderLayout(year, month) {
        return `
        <div class="page-wrapper">
            <div class="container-fluid mt-4">
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <div class="d-flex align-items-center">
                        <h3 class="mb-0 fw-bold text-gray-800">
                            <i class="fas fa-calendar-check text-primary me-2"></i>預班管理
                        </h3>
                        
                        <div id="unit-selector-container" class="ms-4" style="display:none;">
                            <select id="unit-selector" class="form-select fw-bold border-primary text-primary shadow-sm" 
                                    style="min-width: 200px;">
                                <option value="" disabled selected>載入中...</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <button class="btn btn-primary shadow-sm" onclick="window.routerPage.openCreateModal()">
                            <i class="fas fa-plus"></i> 開啟新月份預班
                        </button>
                    </div>
                </div>

                <div class="card shadow">
                    <div class="card-header py-3 bg-white border-bottom">
                        <h6 class="m-0 font-weight-bold text-primary">預班表清單</h6>
                    </div>
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead class="table-light">
                                    <tr>
                                        <th>月份</th>
                                        <th>狀態</th>
                                        <th>可填寫人員</th>
                                        <th>已提交人數</th>
                                        <th>最後更新</th>
                                        <th>操作</th>
                                    </tr>
                                </thead>
                                <tbody id="pre-schedule-list-tbody">
                                    <tr><td colspan="6" class="text-center p-5 text-muted">請選擇單位以載入資料</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            <div class="modal fade" id="create-pre-modal" tabindex="-1">
                <div class="modal-dialog">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title fw-bold">開啟新預班</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-info small">開啟後，員工即可進入系統填寫該月份的預班與需求。</div>
                            <div class="mb-3">
                                <label class="form-label fw-bold">選擇月份</label>
                                <input type="month" id="new-pre-month" class="form-control" value="${year}-${String(month).padStart(2,'0')}">
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-bold">截止日期</label>
                                <input type="date" id="new-pre-close" class="form-control">
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-secondary" data-bs-dismiss="modal">取消</button>
                            <button class="btn btn-primary" onclick="window.routerPage.createPreSchedule()">確認開啟</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>`;
    },

    // 2. 列表渲染 (關鍵修正)
    renderList(list) {
        if (!list || list.length === 0) {
            return `<tr><td colspan="6" class="text-center text-muted p-5">此單位尚無開啟的預班表</td></tr>`;
        }

        return list.map(item => {
            const statusBadge = item.status === 'open' 
                ? '<span class="badge bg-success">進行中</span>' 
                : '<span class="badge bg-secondary">已截止</span>';
            
            const submittedCount = item.submissions ? Object.keys(item.submissions).length : 0;
            const staffCount = item.staffIds ? item.staffIds.length : 0;
            const updatedDate = item.updatedAt ? new Date(item.updatedAt.seconds * 1000).toLocaleDateString() : '-';

            return `
            <tr>
                <td class="fw-bold text-primary">${item.year}-${String(item.month).padStart(2,'0')}</td>
                <td>${statusBadge}</td>
                <td>${staffCount} 人</td>
                <td>
                    <div class="d-flex align-items-center">
                        <div class="progress flex-grow-1 me-2" style="height: 6px; width: 60px;">
                            <div class="progress-bar" style="width: ${(submittedCount/staffCount)*100}%"></div>
                        </div>
                        <span class="small">${submittedCount}</span>
                    </div>
                </td>
                <td class="small text-muted">${updatedDate}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="window.location.hash='/pre-schedule/edit?id=${item.id}'">
                        <i class="fas fa-edit"></i> 管理
                    </button>
                    ${item.status === 'open' 
                        ? `<button class="btn btn-sm btn-outline-danger" onclick="window.routerPage.closePreSchedule('${item.id}')" title="截止"><i class="fas fa-stop-circle"></i></button>`
                        : `<button class="btn btn-sm btn-outline-success" onclick="window.routerPage.reopenPreSchedule('${item.id}')" title="重啟"><i class="fas fa-play-circle"></i></button>`
                    }
                </td>
            </tr>`;
        }).join('');
    }
};
