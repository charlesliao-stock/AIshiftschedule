/**
 * 假日管理模組
 */

const HolidayManagement = {
    unitId: null,
    holidays: [],
    currentYear: new Date().getFullYear(),
    
    async init(unitId) {
        console.log('[HolidayManagement] 初始化假日管理');
        this.unitId = unitId;
        this.render();
        await this.loadHolidays();
    },
    
    render() {
        const content = document.getElementById('settings-content');
        
        content.innerHTML = `
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h3 class="card-title">假日設定</h3>
                    <p style="margin: 8px 0 0 0; color: #666; font-size: 14px;">設定國定假日、週末及其他特殊假日</p>
                </div>
                <div style="display: flex; gap: 12px;">
                    <select id="year-select" class="form-select" style="width: 120px;">
                        <option value="${this.currentYear - 1}">${this.currentYear - 1}</option>
                        <option value="${this.currentYear}" selected>${this.currentYear}</option>
                        <option value="${this.currentYear + 1}">${this.currentYear + 1}</option>
                    </select>
                    <button class="btn btn-secondary" id="import-holidays-btn">📥 匯入國定假日</button>
                    <button class="btn btn-primary" id="add-holiday-btn">➕ 新增假日</button>
                </div>
            </div>
            <div class="card-body" style="padding: 0;">
                <div id="holidays-table-container">
                    <div style="padding: 60px; text-align: center; color: #999;">
                        <div class="loader-spinner" style="margin: 0 auto 16px;"></div>
                        <p>載入中...</p>
                    </div>
                </div>
            </div>
            <div class="card-footer">
                <button class="btn btn-primary" id="save-holidays-btn">💾 儲存變更</button>
            </div>
        `;
        
        this.bindEvents();
    },
    
    renderHolidaysTable() {
        const container = document.getElementById('holidays-table-container');
        
        const filteredHolidays = this.holidays.filter(h => 
            h.applicableYear === 'all' || parseInt(h.applicableYear) === this.currentYear
        );
        
        if (filteredHolidays.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📅</div>
                    <h3 class="empty-state-title">${this.currentYear} 年尚無假日設定</h3>
                    <p class="empty-state-message">點擊「匯入國定假日」快速建立，或手動「新增假日」</p>
                </div>
            `;
            return;
        }
        
        // 依日期排序
        const sortedHolidays = [...filteredHolidays].sort((a, b) => {
            if (a.type === 'recurring' && b.type !== 'recurring') return 1;
            if (a.type !== 'recurring' && b.type === 'recurring') return -1;
            return a.date.localeCompare(b.date);
        });
        
        let tableHtml = `
            <table class="table">
                <thead>
                    <tr>
                        <th>日期</th>
                        <th>假日名稱</th>
                        <th>類型</th>
                        <th>適用年度</th>
                        <th style="text-align: center;">啟用</th>
                        <th style="text-align: center;">操作</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        sortedHolidays.forEach(holiday => {
            const typeName = holiday.type === 'national' ? '國定假日' : holiday.type === 'recurring' ? '固定週期' : '其他';
            const enabledIcon = holiday.enabled ? '✓' : '✕';
            const dateText = holiday.type === 'recurring' ? holiday.date : Utils.formatDate(holiday.date, 'YYYY/MM/DD');
            
            tableHtml += `
                <tr>
                    <td>${dateText}</td>
                    <td><strong>${holiday.name}</strong></td>
                    <td>${typeName}</td>
                    <td>${holiday.applicableYear === 'all' ? '所有' : holiday.applicableYear}</td>
                    <td style="text-align: center;">
                        <span style="font-size: 18px; color: ${holiday.enabled ? '#10b981' : '#999'};">${enabledIcon}</span>
                    </td>
                    <td style="text-align: center;">
                        <button class="btn btn-sm btn-secondary" onclick="HolidayManagement.editHoliday('${holiday.id}')">✏️</button>
                        <button class="btn btn-sm btn-error" onclick="HolidayManagement.deleteHoliday('${holiday.id}')">🗑️</button>
                    </td>
                </tr>
            `;
        });
        
        tableHtml += `</tbody></table>`;
        container.innerHTML = tableHtml;
    },
    
    bindEvents() {
        document.getElementById('add-holiday-btn')?.addEventListener('click', () => this.showAddHolidayModal());
        document.getElementById('import-holidays-btn')?.addEventListener('click', () => this.importNationalHolidays());
        document.getElementById('save-holidays-btn')?.addEventListener('click', () => this.saveHolidays());
        
        const yearSelect = document.getElementById('year-select');
        if (yearSelect) {
            yearSelect.addEventListener('change', (e) => {
                this.currentYear = parseInt(e.target.value);
                this.renderHolidaysTable();
            });
        }
    },
    
    async loadHolidays() {
        try {
            Loading.show('載入假日設定...');
            const result = await SheetsService.post(API_CONFIG.endpoints.settings.getHolidays, { unit_id: this.unitId });
            this.holidays = result.success && result.data ? result.data : this.getDefaultHolidays();
            this.renderHolidaysTable();
            Loading.hide();
        } catch (error) {
            Loading.hide();
            Notification.error('載入假日設定失敗: ' + error.message);
            this.holidays = this.getDefaultHolidays();
            this.renderHolidaysTable();
        }
    },
    
    async saveHolidays() {
        try {
            Loading.show('儲存假日設定...');
            const result = await SheetsService.post(API_CONFIG.endpoints.settings.saveHolidays, {
                unit_id: this.unitId,
                holidays: this.holidays
            });
            
            if (!result.success) throw new Error(result.message || '儲存失敗');
            
            Loading.hide();
            Notification.success('假日設定已儲存');
            SheetsService.clearCache('/settings/holidays');
        } catch (error) {
            Loading.hide();
            Notification.error('儲存假日設定失敗: ' + error.message);
        }
    },
    
    async showAddHolidayModal() {
        const result = await Modal.form('新增假日', [
            { name: 'date', label: '日期', type: 'date', required: true },
            { name: 'name', label: '假日名稱', type: 'text', placeholder: '例如: 元旦', required: true },
            { name: 'type', label: '類型', type: 'select', options: [
                { value: 'national', label: '國定假日' },
                { value: 'recurring', label: '固定週期 (如週末)' },
                { value: 'other', label: '其他' }
            ], value: 'national', required: true },
            { name: 'applicableYear', label: '適用年度', type: 'select', options: [
                { value: 'all', label: '所有年度' },
                { value: this.currentYear, label: this.currentYear }
            ], value: this.currentYear, required: true },
            { name: 'enabled', label: '啟用', type: 'select', options: [
                { value: 'true', label: '是' },
                { value: 'false', label: '否' }
            ], value: 'true', required: true }
        ]);
        
        if (result) {
            const newHoliday = {
                id: Utils.generateId(),
                date: result.date,
                name: result.name,
                type: result.type,
                applicableYear: result.applicableYear,
                enabled: result.enabled === 'true'
            };
            
            this.holidays.push(newHoliday);
            this.renderHolidaysTable();
            Notification.success('假日已新增，請記得儲存變更');
        }
    },
    
    async editHoliday(holidayId) {
        const holiday = this.holidays.find(h => h.id === holidayId);
        if (!holiday) return;
        
        const result = await Modal.form('編輯假日', [
            { name: 'date', label: '日期', type: 'date', value: holiday.date, required: true },
            { name: 'name', label: '假日名稱', type: 'text', value: holiday.name, required: true },
            { name: 'type', label: '類型', type: 'select', options: [
                { value: 'national', label: '國定假日' },
                { value: 'recurring', label: '固定週期' },
                { value: 'other', label: '其他' }
            ], value: holiday.type, required: true },
            { name: 'applicableYear', label: '適用年度', type: 'text', value: holiday.applicableYear, required: true },
            { name: 'enabled', label: '啟用', type: 'select', options: [
                { value: 'true', label: '是' },
                { value: 'false', label: '否' }
            ], value: holiday.enabled ? 'true' : 'false', required: true }
        ]);
        
        if (result) {
            holiday.date = result.date;
            holiday.name = result.name;
            holiday.type = result.type;
            holiday.applicableYear = result.applicableYear;
            holiday.enabled = result.enabled === 'true';
            
            this.renderHolidaysTable();
            Notification.success('假日已更新，請記得儲存變更');
        }
    },
    
    async deleteHoliday(holidayId) {
        const holiday = this.holidays.find(h => h.id === holidayId);
        if (!holiday) return;
        
        const confirmed = await Modal.confirm(`確定要刪除假日「${holiday.name}」嗎？`);
        if (confirmed) {
            this.holidays = this.holidays.filter(h => h.id !== holidayId);
            this.renderHolidaysTable();
            Notification.success('假日已刪除，請記得儲存變更');
        }
    },
    
    async importNationalHolidays() {
        const confirmed = await Modal.confirm(
            `確定要匯入 ${this.currentYear} 年的國定假日嗎？\n\n這會新增台灣的國定假日到假日清單中。`,
            { confirmText: '匯入' }
        );
        
        if (confirmed) {
            const nationalHolidays = this.getNationalHolidays(this.currentYear);
            
            // 檢查重複
            nationalHolidays.forEach(holiday => {
                const exists = this.holidays.some(h => h.date === holiday.date && h.name === holiday.name);
                if (!exists) {
                    this.holidays.push(holiday);
                }
            });
            
            this.renderHolidaysTable();
            Notification.success(`已匯入 ${nationalHolidays.length} 個國定假日，請記得儲存變更`);
        }
    },
    
    getDefaultHolidays() {
        return [
            { id: Utils.generateId(), date: '每週六', name: '週末', type: 'recurring', applicableYear: 'all', enabled: true },
            { id: Utils.generateId(), date: '每週日', name: '週末', type: 'recurring', applicableYear: 'all', enabled: true }
        ];
    },
    
    getNationalHolidays(year) {
        // 2025 年台灣國定假日
        const holidays2025 = [
            { date: '2025-01-01', name: '元旦' },
            { date: '2025-01-28', name: '春節' },
            { date: '2025-01-29', name: '春節' },
            { date: '2025-01-30', name: '春節' },
            { date: '2025-01-31', name: '春節' },
            { date: '2025-02-28', name: '和平紀念日' },
            { date: '2025-04-04', name: '清明節' },
            { date: '2025-05-01', name: '勞動節' },
            { date: '2025-05-31', name: '端午節' },
            { date: '2025-10-07', name: '中秋節' },
            { date: '2025-10-10', name: '國慶日' }
        ];
        
        return holidays2025.map(h => ({
            id: Utils.generateId(),
            date: h.date,
            name: h.name,
            type: 'national',
            applicableYear: year.toString(),
            enabled: true
        }));
    }
};

if (typeof window !== 'undefined') {
    window.HolidayManagement = HolidayManagement;
}