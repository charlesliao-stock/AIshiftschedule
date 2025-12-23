export const StaffListTemplate = {
    renderLayout(unitOptionsHtml, isAdmin, isOneUnit) {
        return `
            <div class="container-fluid mt-4">
                <div class="mb-3">
                    <h3 class="text-gray-800 fw-bold"><i class="fas fa-users"></i> 人員管理</h3>
                    <p class="text-muted small mb-0">管理單位內護理人員的資料、職級與系統權限。</p>
                </div>

                <div class="card shadow-sm mb-4 border-left-primary">
                    <div class="card-body py-2 d-flex align-items-center flex-wrap gap-2">
                        <label class="fw-bold mb-0 text-nowrap">選擇單位：</label>
                        <select id="unit-filter" class="form-select w-auto" ${isOneUnit ? 'disabled' : ''}>
                            ${unitOptionsHtml}
                        </select>
                        <div class="vr mx-2"></div>
                        <button id="btn-add-staff" class="btn btn-primary w-auto text-nowrap">
                            <i class="fas fa-plus"></i> 新增人員
                        </button>
                        <div class="ms-auto">
                            <input type="text" id="keyword-search" class="form-control form-control-sm" placeholder="搜尋姓名/編號...">
                        </div>
                    </div>
                </div>

                <div class="card shadow">
                    <div class="card-body p-0">
                        <div class="table-responsive">
                            <table class="table table-hover align-middle mb-0">
                                <thead class="table-light">
                                    <tr>
                                        <th data-sort="staffCode" style="cursor:pointer">編號 <i class="fas fa-sort text-muted small"></i></th>
                                        <th data-sort="staffName" style="cursor:pointer">姓名 <i class="fas fa-sort text-muted small"></i></th>
                                        <th data-sort="title" style="cursor:pointer">職稱 <i class="fas fa-sort text-muted small"></i></th>
                                        <th data-sort="level" style="cursor:pointer">職級 <i class="fas fa-sort text-muted small"></i></th>
                                        <th>系統權限</th>
                                        <th>特殊限制</th>
                                        <th class="text-end pe-3">操作</th>
                                    </tr>
                                </thead>
                                <tbody id="staff-tbody">
                                    <tr><td colspan="7" class="text-center py-4 text-muted">載入中...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="modal fade" id="edit-staff-modal" tabindex="-1">
                    <div class="modal-dialog">
                        <div class="modal-content">
                            <div class="modal-header bg-light">
                                <h5 class="modal-title fw-bold">編輯人員資料</h5>
                                <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                            </div>
                            <div class="modal-body">
                                <input type="hidden" id="edit-uid">
                                <div class="row g-3 mb-3">
                                    <div class="col-6">
                                        <label class="form-label fw-bold">姓名</label>
                                        <input type="text" id="edit-staffName" class="form-control">
                                    </div>
                                    <div class="col-6">
                                        <label class="form-label fw-bold">編號</label>
                                        <input type="text" id="edit-staffCode" class="form-control bg-light" readonly>
                                    </div>
                                    <div class="col-12">
                                        <label class="form-label">Email (登入帳號)</label>
                                        <input type="email" id="edit-email" class="form-control bg-light" readonly>
                                    </div>
                                    <div class="col-6">
                                        <label class="form-label fw-bold">職稱</label>
                                        <select id="edit-title" class="form-select">
                                            <option value="NP">專科護理師 (NP)</option>
                                            <option value="HN">護理長 (HN)</option>
                                            <option value="N">護理師 (N)</option>
                                            <option value="AH">副護理長 (AH)</option>
                                        </select>
                                    </div>
                                    <div class="col-6">
                                        <label class="form-label fw-bold">職級</label>
                                        <select id="edit-level" class="form-select">
                                            <option value="N0">N0</option><option value="N1">N1</option>
                                            <option value="N2">N2</option><option value="N3">N3</option>
                                            <option value="N4">N4</option>
                                        </select>
                                    </div>
                                </div>
                                <hr>
                                <div class="mb-3">
                                    <label class="form-label fw-bold text-primary">排班限制</label>
                                    <div class="row g-2">
                                        <div class="col-6">
                                            <label class="small text-muted">連上上限 (天)</label>
                                            <input type="number" id="edit-maxConsecutive" class="form-control form-control-sm" min="1">
                                        </div>
                                        <div class="col-6">
                                            <label class="small text-muted">連夜上限 (天)</label>
                                            <input type="number" id="edit-maxConsecutiveNights" class="form-control form-control-sm" min="1">
                                        </div>
                                        <div class="col-12 mt-2">
                                            <div class="form-check form-check-inline">
                                                <input class="form-check-input" type="checkbox" id="edit-canBatch">
                                                <label class="form-check-label small">可包班</label>
                                            </div>
                                            <div class="form-check form-check-inline">
                                                <input class="form-check-input" type="checkbox" id="edit-isPregnant">
                                                <label class="form-check-label small">懷孕中</label>
                                            </div>
                                            <div class="form-check form-check-inline">
                                                <input class="form-check-input" type="checkbox" id="edit-isPostpartum">
                                                <label class="form-check-label small">產後哺乳</label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div class="mb-3">
                                    <label class="form-label fw-bold text-primary">系統權限</label>
                                    <div class="d-flex gap-3">
                                        <div class="form-check">
                                            <input type="checkbox" id="edit-is-manager" class="form-check-input">
                                            <label class="form-check-label">管理者</label>
                                        </div>
                                        <div class="form-check">
                                            <input type="checkbox" id="edit-is-scheduler" class="form-check-input">
                                            <label class="form-check-label">排班者</label>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary w-auto" data-bs-dismiss="modal">取消</button>
                                <button type="button" id="btn-save" class="btn btn-primary w-auto">儲存</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    renderRows(staffList, isRealAdmin) {
        if (!staffList || staffList.length === 0) return '<tr><td colspan="7" class="text-center text-muted p-4">無人員資料</td></tr>';
        
        return staffList.map(u => `
            <tr>
                <td>${u.staffCode || '<span class="text-danger">缺編號</span>'}</td>
                <td class="fw-bold">${u.staffName || '<span class="text-danger">缺姓名</span>'}</td>
                <td>${u.title || '-'}</td>
                <td><span class="badge bg-light text-dark border">${u.level || 'N0'}</span></td>
                <td>${this.renderRoles(u)}</td>
                <td>${this.renderConstraints(u)}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="window.routerPage.openEditModal('${u.uid}')"><i class="fas fa-edit"></i></button>
                    ${isRealAdmin ? `<button class="btn btn-sm btn-outline-danger" onclick="window.routerPage.deleteStaff('${u.uid}')"><i class="fas fa-trash"></i></button>` : ''}
                </td>
            </tr>
        `).join('');
    },

    renderRoles(u) {
        let roles = [];
        if (u.role === 'unit_manager') roles.push('<span class="badge bg-danger">主管</span>');
        if (u.role === 'unit_scheduler') roles.push('<span class="badge bg-success">排班</span>');
        if (u.role === 'system_admin') roles.push('<span class="badge bg-dark">系統</span>');
        if (roles.length === 0) roles.push('<span class="badge bg-light text-muted border">一般</span>');
        return roles.join(' ');
    },

    renderConstraints(u) {
        let tags = [];
        const c = u.constraints || {};
        if (c.isPregnant) tags.push('<i class="fas fa-baby text-danger" title="懷孕"></i>');
        if (c.isPostpartum) tags.push('<i class="fas fa-breastfeeding text-pink" title="哺乳"></i>');
        if (c.canBatch) tags.push('<span class="badge rounded-pill bg-info text-dark" style="font-size:0.6rem">包班</span>');
        return tags.length > 0 ? tags.join(' ') : '<span class="text-muted">-</span>';
    }
};
