/**
 * 班別管理模組
 */

const ShiftManagement = {
    unitId: null,
    shifts: [],
    
    // ==================== 初始化 ====================
    
    /**
     * 初始化班別管理
     */
    async init(unitId) {
        console.log('[ShiftManagement] 初始化班別管理');
        this.unitId = unitId;
        
        // 渲染介面
        this.render();
        
        // 載入班別資料
        await this.loadShifts();
    },
    
    // ==================== 渲染 ====================
    
    /**
     * 渲染主介面
     */
    render() {
        const content = document.getElementById('settings-content');
        
        content.innerHTML = `
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                <h3 class="card-title">班別管理</h3>
                <div style="display: flex; gap: 12px;">
                    <button class="btn btn-secondary" id="reset-shifts-btn">
                        重設為預設
                    </button>
                    <button class="btn btn-primary" id="add-shift-btn">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        新增班別
                    </button>
                </div>
            </div>
            <div class="card-body" style="padding: 0;">
                <div id="shifts-table-container">
                    <div style="padding: 60px; text-align: center; color: #999;">
                        <div class="loader-spinner" style="margin: 0 auto 16px;"></div>
                        <p>載入中...</p>
                    </div>
                </div>
            </div>
            <div class="card-footer">
                <button class="btn btn-primary" id="save-shifts-btn">
                    💾 儲存變更
                </button>
            </div>
        `;
        
        // 綁定事件
        this.bindEvents();
    },
    
    /**
     * 渲染班別表格
     */
    renderShiftsTable() {
        const container = document.getElementById('shifts-table-container');
        
        if (this.shifts.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🌙</div>
                    <h3 class="empty-state-title">尚無班別</h3>
                    <p class="empty-state-message">點擊「新增班別」來建立第一個班別</p>
                </div>
            `;
            return;
        }
        
        let tableHtml = `
            <table class="table">
                <thead>
                    <tr>
                        <th style="width: 60px;">順序</th>
                        <th>班別名稱</th>
                        <th>班別代碼</th>
                        <th>起始時間</th>
                        <th>結束時間</th>
                        <th>工時</th>
                        <th>顏色</th>
                        <th style="text-align: center;">列入統計</th>
                        <th style="text-align: center;">操作</th>
                    </tr>
                </thead>
                <tbody id="shifts-tbody">
        `;
        
        // 依順序排序
        const sortedShifts = [...this.shifts].sort((a, b) => a.order - b.order);
        
        sortedShifts.forEach(shift => {
            const hours = shift.calculateHours();
            const hoursText = hours > 0 ? hours + ' 小時' : '-';
            const statsIcon = shift.countToStats ? '✓' : '✕';
            
            tableHtml += `
                <tr data-shift-id="${shift.id}">
                    <td>
                        <input 
                            type="number" 
                            class="form-input" 
                            value="${shift.order}" 
                            min="1" 
                            style="width: 60px;"
                            onchange="ShiftManagement.updateShiftOrder(${shift.id}, this.value)"
                        >
                    </td>
                    <td><strong>${shift.name}</strong></td>
                    <td><code style="background: #e5e7eb; padding: 2px 8px; border-radius: 4px;">${shift.code}</code></td>
                    <td>${shift.startTime || '-'}</td>
                    <td>${shift.endTime || '-'}</td>
                    <td>${hoursText}</td>
                    <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="width: 24px; height: 24px; background: ${shift.color}; border-radius: 4px; border: 1px solid #d1d5db;"></div>
                            <code style="font-size: 11px; color: #666;">${shift.color}</code>
                        </div>
                    </td>
                    <td style="text-align: center;">
                        <span style="font-size: 18px;">${statsIcon}</span>
                    </td>
                    <td style="text-align: center;">
                        <button class="btn btn-sm btn-secondary" onclick="ShiftManagement.editShift(${shift.id})" title="編輯">
                            ✏️
                        </button>
                        <button class="btn btn-sm btn-error" onclick="ShiftManagement.deleteShift(${shift.id})" title="刪除">
                            🗑️
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tableHtml += `
                </tbody>
            </table>
        `;
        
        container.innerHTML = tableHtml;
    },
    
    /**
     * 綁定事件
     */
    bindEvents() {
        // 新增班別
        const addBtn = document.getElementById('add-shift-btn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                this.showAddShiftModal();
            });
        }
        
        // 重設為預設
        const resetBtn = document.getElementById('reset-shifts-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetToDefaults();
            });
        }
        
        // 儲存變更
        const saveBtn = document.getElementById('save-shifts-btn');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                this.saveShifts();
            });
        }
    },
    
    // ==================== 資料操作 ====================
    
    /**
     * 載入班別資料
     */
    async loadShifts() {
        try {
            Loading.show('載入班別資料...');
            
            const result = await SheetsService.post(
                API_CONFIG.endpoints.settings.getShifts,
                { unit_id: this.unitId }
            );
            
            if (result.success && result.data) {
                this.shifts = result.data.map(s => Shift.fromObject(s));
            } else {
                // 使用預設班別
                this.shifts = Shift.getDefaults();
            }
            
            this.renderShiftsTable();
            Loading.hide();
            
        } catch (error) {
            Loading.hide();
            console.error('[ShiftManagement] 載入失敗:', error);
            Notification.error('載入班別資料失敗: ' + error.message);
            // 使用預設班別
            this.shifts = Shift.getDefaults();
            this.renderShiftsTable();
        }
    },
    
    /**
     * 儲存班別資料
     */
    async saveShifts() {
        try {
            // 驗證所有班別
            for (const shift of this.shifts) {
                const validation = shift.validate();
                if (!validation.valid) {
                    Notification.error(`班別「${shift.name}」驗證失敗: ${validation.errors.join('、')}`);
                    return;
                }
            }
            
            Loading.show('儲存班別資料...');
            
            const shiftsData = this.shifts.map(s => s.toObject());
            
            const result = await SheetsService.post(
                API_CONFIG.endpoints.settings.saveShifts,
                {
                    unit_id: this.unitId,
                    shifts: shiftsData
                }
            );
            
            if (!result.success) {
                throw new Error(result.message || '儲存失敗');
            }
            
            Loading.hide();
            Notification.success('班別資料已儲存');
            
            // 清除快取
            SheetsService.clearCache('/settings/shifts');
            
        } catch (error) {
            Loading.hide();
            console.error('[ShiftManagement] 儲存失敗:', error);
            Notification.error('儲存班別資料失敗: ' + error.message);
        }
    },
    
    // ==================== 班別操作 ====================
    
    /**
     * 顯示新增班別對話框
     */
    async showAddShiftModal() {
        const result = await Modal.form('新增班別', [
            {
                name: 'name',
                label: '班別名稱',
                type: 'text',
                placeholder: '例如: 大夜',
                required: true
            },
            {
                name: 'code',
                label: '班別代碼',
                type: 'text',
                placeholder: '例如: 大 (最多5個字元)',
                required: true
            },
            {
                name: 'startTime',
                label: '起始時間',
                type: 'time',
                placeholder: '例如: 22:00',
                required: false
            },
            {
                name: 'endTime',
                label: '結束時間',
                type: 'time',
                placeholder: '例如: 08:00',
                required: false
            },
            {
                name: 'color',
                label: '顏色',
                type: 'text',
                placeholder: '#E9D5FF',
                value: '#E9D5FF',
                required: true
            },
            {
                name: 'countToStats',
                label: '列入統計',
                type: 'select',
                options: [
                    { value: 'true', label: '是' },
                    { value: 'false', label: '否' }
                ],
                value: 'true',
                required: true
            },
            {
                name: 'order',
                label: '接班順序',
                type: 'number',
                value: this.shifts.length + 1,
                required: true
            }
        ]);
        
        if (result) {
            this.addShift(result);
        }
    },
    
    /**
     * 新增班別
     */
    addShift(shiftData) {
        const newShift = new Shift({
            id: Date.now(),
            name: shiftData.name,
            code: shiftData.code,
            startTime: shiftData.startTime,
            endTime: shiftData.endTime,
            color: shiftData.color,
            countToStats: shiftData.countToStats === 'true',
            order: parseInt(shiftData.order)
        });
        
        // 驗證
        const validation = newShift.validate();
        if (!validation.valid) {
            Notification.error('驗證失敗: ' + validation.errors.join('、'));
            return;
        }
        
        this.shifts.push(newShift);
        this.renderShiftsTable();
        Notification.success('班別已新增，請記得儲存變更');
    },
    
    /**
     * 編輯班別
     */
    async editShift(shiftId) {
        const shift = this.shifts.find(s => s.id === shiftId);
        if (!shift) return;
        
        const result = await Modal.form('編輯班別', [
            {
                name: 'name',
                label: '班別名稱',
                type: 'text',
                value: shift.name,
                required: true
            },
            {
                name: 'code',
                label: '班別代碼',
                type: 'text',
                value: shift.code,
                required: true
            },
            {
                name: 'startTime',
                label: '起始時間',
                type: 'time',
                value: shift.startTime,
                required: false
            },
            {
                name: 'endTime',
                label: '結束時間',
                type: 'time',
                value: shift.endTime,
                required: false
            },
            {
                name: 'color',
                label: '顏色',
                type: 'text',
                value: shift.color,
                required: true
            },
            {
                name: 'countToStats',
                label: '列入統計',
                type: 'select',
                options: [
                    { value: 'true', label: '是' },
                    { value: 'false', label: '否' }
                ],
                value: shift.countToStats ? 'true' : 'false',
                required: true
            },
            {
                name: 'order',
                label: '接班順序',
                type: 'number',
                value: shift.order,
                required: true
            }
        ]);
        
        if (result) {
            shift.name = result.name;
            shift.code = result.code;
            shift.startTime = result.startTime;
            shift.endTime = result.endTime;
            shift.color = result.color;
            shift.countToStats = result.countToStats === 'true';
            shift.order = parseInt(result.order);
            
            this.renderShiftsTable();
            Notification.success('班別已更新，請記得儲存變更');
        }
    },
    
    /**
     * 刪除班別
     */
    async deleteShift(shiftId) {
        const shift = this.shifts.find(s => s.id === shiftId);
        if (!shift) return;
        
        const confirmed = await Modal.confirm(
            `確定要刪除班別「${shift.name}」嗎？`,
            { danger: true }
        );
        
        if (confirmed) {
            this.shifts = this.shifts.filter(s => s.id !== shiftId);
            this.renderShiftsTable();
            Notification.success('班別已刪除，請記得儲存變更');
        }
    },
    
    /**
     * 更新班別順序
     */
    updateShiftOrder(shiftId, newOrder) {
        const shift = this.shifts.find(s => s.id === shiftId);
        if (shift) {
            shift.order = parseInt(newOrder) || 1;
            Notification.info('順序已更新，請記得儲存變更');
        }
    },
    
    /**
     * 重設為預設班別
     */
    async resetToDefaults() {
        const confirmed = await Modal.confirm(
            '確定要重設為預設班別嗎？\n\n⚠️ 這會清除所有自訂的班別設定。',
            { danger: true }
        );
        
        if (confirmed) {
            this.shifts = Shift.getDefaults();
            this.renderShiftsTable();
            Notification.success('已重設為預設班別，請記得儲存變更');
        }
    }
};

// 讓班別管理可在全域使用
if (typeof window !== 'undefined') {
    window.ShiftManagement = ShiftManagement;
}