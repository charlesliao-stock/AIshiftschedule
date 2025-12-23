export const StaffCreateTemplate = {
    renderForm(unitOptions) {
        return `
            <div class="container">
                <div class="d-flex align-items-center mb-4">
                    <button class="btn btn-link text-decoration-none ps-0 text-secondary" onclick="history.back()">
                        <i class="fas fa-arrow-left"></i> 返回
                    </button>
                    <h2 class="h3 mb-0 text-gray-800 ms-2">新增人員帳號</h2>
                </div>
                
                <div class="card shadow-sm">
                    <div class="card-body">
                        <form id="create-staff-form">
                            <h5 class="text-primary mb-3">基本資料</h5>
                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label fw-bold">姓名 (Staff Name) <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="staffName" required placeholder="請輸入真實姓名">
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label fw-bold">員工編號 (Staff Code) <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="staffCode" required placeholder="例如: N12345">
                                </div>
                            </div>

                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label fw-bold">職級 (Title) <span class="text-danger">*</span></label>
                                    <select class="form-select" id="title">
                                        <option value="N">護理師 (N)</option>
                                        <option value="NP">專科護理師 (NP)</option>
                                        <option value="HN">護理長 (HN)</option>
                                        <option value="AH">副護理長 (AH)</option>
                                    </select>
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label fw-bold">進階職級 (Level)</label>
                                    <select class="form-select" id="level">
                                        <option value="N0">N0</option>
                                        <option value="N1">N1</option>
                                        <option value="N2">N2</option>
                                        <option value="N3">N3</option>
                                        <option value="N4">N4</option>
                                    </select>
                                </div>
                            </div>

                            <div class="row">
                                <div class="col-md-6 mb-3">
                                    <label class="form-label fw-bold">Email (登入帳號) <span class="text-danger">*</span></label>
                                    <input type="email" class="form-control" id="email" required placeholder="example@hospital.com">
                                </div>
                                <div class="col-md-6 mb-3">
                                    <label class="form-label fw-bold">預設密碼 <span class="text-danger">*</span></label>
                                    <input type="text" class="form-control" id="password" value="123456" required>
                                    <div class="form-text">預設為 123456，請提醒同仁登入後修改</div>
                                </div>
                            </div>

                            <div class="mb-4">
                                <label class="form-label fw-bold">所屬單位 (Unit)</label>
                                <select class="form-select" id="unitSelect">
                                    <option value="">(未指定)</option>
                                    ${unitOptions}
                                </select>
                            </div>

                            <h5 class="text-primary mb-3">排班限制</h5>
                            <div class="row g-3 mb-4">
                                <div class="col-md-3">
                                    <label class="form-label small">最大連續上班天數</label>
                                    <input type="number" id="maxConsecutive" class="form-control" value="6">
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label small">最大連續夜班數</label>
                                    <input type="number" id="maxConsecutiveNights" class="form-control" value="4">
                                </div>
                                <div class="col-md-6 d-flex align-items-end gap-3">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="canBatch">
                                        <label class="form-check-label" for="canBatch">可包班</label>
                                    </div>
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="isPregnant">
                                        <label class="form-check-label" for="isPregnant">懷孕中</label>
                                    </div>
                                </div>
                            </div>

                            <h5 class="text-primary mb-3">系統權限 (Role)</h5>
                            <div class="card bg-light border-0">
                                <div class="card-body">
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="role-user" checked disabled>
                                        <label class="form-check-label" for="role-user">一般使用者 (預設)</label>
                                    </div>
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="role-scheduler">
                                        <label class="form-check-label" for="role-scheduler">排班人員</label>
                                    </div>
                                    <div class="form-check">
                                        <input class="form-check-input" type="checkbox" id="role-manager">
                                        <label class="form-check-label" for="role-manager">單位管理者</label>
                                    </div>
                                </div>
                            </div>

                            <div class="d-flex justify-content-end gap-2 mt-4">
                                <button type="button" class="btn btn-secondary" onclick="history.back()">取消</button>
                                <button type="submit" class="btn btn-primary" id="btn-submit">
                                    <i class="fas fa-check"></i> 確認新增
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;
    }
};
