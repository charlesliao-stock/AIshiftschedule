/**
 * 人員管理模組
 */

const StaffManagement = {
    unitId: null,
    staffList: [],
    shifts: [],
    groups: [],
    
    async init(unitId) {
        console.log('[StaffManagement] 初始化人員管理');
        this.unitId = unitId;
        
        // 載入班別和組別資料
        await this.loadDependencies();
        
        this.render();
        await this.loadStaff();
    },
    
    async loadDependencies() {
        try {
            const [shiftsResult, groupsResult] = await Promise.all([
                SheetsService.post(API_CONFIG.endpoints.settings.getShifts, { unit_id: this.unitId }),
                SheetsService.post(API_CONFIG.endpoints.settings.getGroups, { unit_id: this.unitId })
            ]);
            
            this.shifts = shiftsResult.success && shiftsResult.data ? shiftsResult.data : CONSTANTS.DEFAULT_SHIFTS;
            this.groups = groupsResult.success && groupsResult.data ? groupsResult.data : CONSTANTS.DEFAULT_GROUPS;
        } catch (error) {
            console.error('[StaffManagement] 載入依賴資料失敗:', error);
            this.shifts = CONSTANTS.DEFAULT_SHIFTS;
            this.groups = CONSTANTS.DEFAULT_GROUPS;
        }
    },
    
    render() {
        const content = document.getElementById('settings-content');
        
        content.innerHTML = `
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                <h3 class="card-title">人員管理</h3>
                <div style="display: flex; gap: 12px;">
                    <button class="btn btn-secondary" id="import-staff-btn">📥 匯入 CSV</button>
                    <button class="btn btn-secondary" id="export-staff-btn">📤 匯出 CSV</button>
                    <button class="btn btn-primary" id="add-staff-btn">➕ 新增人員</button>
                </div>
            </div>
            <div class="card-body" style="padding: 0;">
                <div id="staff-table-container">
                    <div style="padding: 60px; text-align: center; color: #999;">
                        <div class="loader-spinner" style="margin: 0 auto 16px;"></div>
                        <p>載入中...</p>
                    </div>
                </div>
            </div>
            <div class="card-footer">
                <button class="btn btn-primary" id="save-staff-btn">💾 儲存變更</button>
            </div>
        `;
        
        this.bindEvents();
    },
    
    renderStaffTable() {
        const container = document.getElementById('staff-table-container');
        
        if (this.staffList.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">👨‍⚕️</div>
                    <h3 class="empty-state-title">尚無人員</h3>
                    <p class="empty-state-message">點擊「新增人員」或「匯入 CSV」來建立人員名單</p>
                </div>
            `;
            return;
        }
        
        let tableHtml = `
            <table class="table">
                <thead>
                    <tr>
                        <th>員工編號</th>
                        <th>姓名</th>
                        <th>層級</th>
                        <th>組別</th>
                        <th>可上班別</th>
                        <th>包班</th>
                        <th>狀態</th>
                        <th style="text-align: center;">操作</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        this.staffList.forEach(staff => {
            const shiftsText = staff.shifts.join(', ');
            const packageText = staff.isPackage ? `✓ (${staff.packageType})` : '✕';
            const statusBadge = staff.status === '在職' 
                ? '<span class="badge badge-success">在職</span>'
                : '<span class="badge badge-error">離職</span>';
            
            tableHtml += `
                <tr>
                    <td><code>${staff.employeeId}</code></td>
                    <td><strong>${staff.name}</strong></td>
                    <td>${staff.level || '-'}</td>
                    <td>${staff.group}</td>
                    <td style="font-size: 13px;">${shiftsText}</td>
                    <td>${packageText}</td>
                    <td>${statusBadge}</td>
                    <td style="text-align: center;">
                        <button class="btn btn-sm btn-secondary" onclick="StaffManagement.editStaff(${staff.id})">✏️</button>
                        <button class="btn btn-sm btn-error" onclick="StaffManagement.deleteStaff(${staff.id})">🗑️</button>
                    </td>
                </tr>
            `;
        });
        
        tableHtml += `</tbody></table>`;
        container.innerHTML = tableHtml;
    },
    
    bindEvents() {
        document.getElementById('add-staff-btn')?.addEventListener('click', () => this.showAddStaffModal());
        document.getElementById('import-staff-btn')?.addEventListener('click', () => this.importCSV());
        document.getElementById('export-staff-btn')?.addEventListener('click', () => this.exportCSV());
        document.getElementById('save-staff-btn')?.addEventListener('click', () => this.saveStaff());
    },
    
    async loadStaff() {
        try {
            Loading.show('載入人員資料...');
            const result = await SheetsService.post(API_CONFIG.endpoints.settings.getStaff, { unit_id: this.unitId });
            this.staffList = result.success && result.data ? result.data.map(s => Staff.fromObject(s)) : [];
            this.renderStaffTable();
            Loading.hide();
        } catch (error) {
            Loading.hide();
            Notification.error('載入人員資料失敗: ' + error.message);
            this.staffList = [];
            this.renderStaffTable();
        }
    },
    
    async saveStaff() {
        try {
            for (const staff of this.staffList) {
                const validation = staff.validate();
                if (!validation.valid) {
                    Notification.error(`人員「${staff.name}」驗證失敗: ${validation.errors.join('、')}`);
                    return;
                }
            }
            
            Loading.show('儲存人員資料...');
            const result = await SheetsService.post(API_CONFIG.endpoints.settings.saveStaff, {
                unit_id: this.unitId,
                staff: this.staffList.map(s => s.toObject())
            });
            
            if (!result.success) throw new Error(result.message || '儲存失敗');
            
            Loading.hide();
            Notification.success('人員資料已儲存');
            SheetsService.clearCache('/settings/staff');
        } catch (error) {
            Loading.hide();
            Notification.error('儲存人員資料失敗: ' + error.message);
        }
    },
    
    async showAddStaffModal() {
        const shiftOptions = this.shifts.map(s => ({ value: s.code, label: s.name }));
        const groupOptions = this.groups.map(g => ({ value: g.name, label: g.name }));
        
        const result = await Modal.form('新增人員', [
            { name: 'employeeId', label: '員工編號', type: 'text', required: true },
            { name: 'name', label: '姓名', type: 'text', required: true },
            { name: 'level', label: '層級', type: 'text', placeholder: '例如: N3', required: false },
            { name: 'group', label: '組別', type: 'select', options: groupOptions, required: true },
            { name: 'shifts', label: '可上班別 (逗號分隔)', type: 'text', placeholder: '例如: 大,小,白', required: true },
            { name: 'maxConsecutiveDays', label: '最長連續天數', type: 'number', value: 6, required: true },
            { name: 'isPackage', label: '是否包班', type: 'select', options: [
                { value: 'false', label: '否' },
                { value: 'true', label: '是' }
            ], value: 'false', required: true },
            { name: 'packageType', label: '包班類型', type: 'text', required: false },
            { name: 'email', label: 'Email', type: 'email', required: false }
        ]);
        
        if (result) {
            const newStaff = new Staff({
                id: Date.now(),
                ...result,
                shifts: result.shifts.split(',').map(s => s.trim()),
                maxConsecutiveDays: parseInt(result.maxConsecutiveDays),
                isPackage: result.isPackage === 'true'
            });
            
            const validation = newStaff.validate();
            if (!validation.valid) {
                Notification.error('驗證失敗: ' + validation.errors.join('、'));
                return;
            }
            
            this.staffList.push(newStaff);
            this.renderStaffTable();
            Notification.success('人員已新增，請記得儲存變更');
        }
    },
    
    async editStaff(staffId) {
        const staff = this.staffList.find(s => s.id === staffId);
        if (!staff) return;
        
        const groupOptions = this.groups.map(g => ({ value: g.name, label: g.name }));
        
        const result = await Modal.form('編輯人員', [
            { name: 'employeeId', label: '員工編號', type: 'text', value: staff.employeeId, required: true },
            { name: 'name', label: '姓名', type: 'text', value: staff.name, required: true },
            { name: 'level', label: '層級', type: 'text', value: staff.level, required: false },
            { name: 'group', label: '組別', type: 'select', options: groupOptions, value: staff.group, required: true },
            { name: 'shifts', label: '可上班別', type: 'text', value: staff.shifts.join(','), required: true },
            { name: 'maxConsecutiveDays', label: '最長連續天數', type: 'number', value: staff.maxConsecutiveDays, required: true },
            { name: 'isPackage', label: '是否包班', type: 'select', options: [
                { value: 'false', label: '否' },
                { value: 'true', label: '是' }
            ], value: staff.isPackage ? 'true' : 'false', required: true },
            { name: 'packageType', label: '包班類型', type: 'text', value: staff.packageType, required: false },
            { name: 'email', label: 'Email', type: 'email', value: staff.email, required: false },
            { name: 'status', label: '狀態', type: 'select', options: [
                { value: '在職', label: '在職' },
                { value: '離職', label: '離職' }
            ], value: staff.status, required: true }
        ]);
        
        if (result) {
            staff.employeeId = result.employeeId;
            staff.name = result.name;
            staff.level = result.level;
            staff.group = result.group;
            staff.shifts = result.shifts.split(',').map(s => s.trim());
            staff.maxConsecutiveDays = parseInt(result.maxConsecutiveDays);
            staff.isPackage = result.isPackage === 'true';
            staff.packageType = result.packageType;
            staff.email = result.email;
            staff.status = result.status;
            
            this.renderStaffTable();
            Notification.success('人員已更新，請記得儲存變更');
        }
    },
    
    async deleteStaff(staffId) {
        const staff = this.staffList.find(s => s.id === staffId);
        if (!staff) return;
        
        const confirmed = await Modal.confirm(`確定要刪除人員「${staff.name}」嗎？`, { danger: true });
        if (confirmed) {
            this.staffList = this.staffList.filter(s => s.id !== staffId);
            this.renderStaffTable();
            Notification.success('人員已刪除，請記得儲存變更');
        }
    },
    
    importCSV() {
        Notification.info('CSV 匯入功能開發中');
    },
    
    exportCSV() {
        if (this.staffList.length === 0) {
            Notification.warning('無人員資料可匯出');
            return;
        }
        
        const headers = Staff.getCSVHeaders();
        const rows = this.staffList.map(s => s.toCSVRow());
        
        let csv = headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.join(',') + '\n';
        });
        
        Utils.downloadFile(csv, `人員名單_${Utils.formatDate(new Date(), 'YYYYMMDD')}.csv`, 'text/csv;charset=utf-8;');
        Notification.success('CSV 已匯出');
    }
};

if (typeof window !== 'undefined') {
    window.StaffManagement = StaffManagement;
}