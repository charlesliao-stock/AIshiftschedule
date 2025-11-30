/**
 * 組別管理模組
 */

const GroupManagement = {
    unitId: null,
    groups: [],
    
    async init(unitId) {
        console.log('[GroupManagement] 初始化組別管理');
        this.unitId = unitId;
        this.render();
        await this.loadGroups();
    },
    
    render() {
        const content = document.getElementById('settings-content');
        
        content.innerHTML = `
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
                <h3 class="card-title">組別管理</h3>
                <div style="display: flex; gap: 12px;">
                    <button class="btn btn-secondary" id="reset-groups-btn">重設為預設</button>
                    <button class="btn btn-primary" id="add-group-btn">➕ 新增組別</button>
                </div>
            </div>
            <div class="card-body" style="padding: 0;">
                <div id="groups-table-container">
                    <div style="padding: 60px; text-align: center; color: #999;">
                        <div class="loader-spinner" style="margin: 0 auto 16px;"></div>
                        <p>載入中...</p>
                    </div>
                </div>
            </div>
            <div class="card-footer">
                <button class="btn btn-primary" id="save-groups-btn">💾 儲存變更</button>
            </div>
        `;
        
        this.bindEvents();
    },
    
    renderGroupsTable() {
        const container = document.getElementById('groups-table-container');
        
        if (this.groups.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">👥</div>
                    <h3 class="empty-state-title">尚無組別</h3>
                    <p class="empty-state-message">點擊「新增組別」來建立第一個組別</p>
                </div>
            `;
            return;
        }
        
        let tableHtml = `
            <table class="table">
                <thead>
                    <tr>
                        <th>組別名稱</th>
                        <th>總員額</th>
                        <th>每班最少</th>
                        <th>每班最多</th>
                        <th>說明</th>
                        <th style="text-align: center;">操作</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        this.groups.forEach(group => {
            tableHtml += `
                <tr>
                    <td><strong>${group.name}</strong></td>
                    <td>${group.totalStaff} 人</td>
                    <td>${group.minPerShift} 人</td>
                    <td>${group.maxPerShift} 人</td>
                    <td>${group.description || '-'}</td>
                    <td style="text-align: center;">
                        <button class="btn btn-sm btn-secondary" onclick="GroupManagement.editGroup(${group.id})">✏️</button>
                        <button class="btn btn-sm btn-error" onclick="GroupManagement.deleteGroup(${group.id})">🗑️</button>
                    </td>
                </tr>
            `;
        });
        
        tableHtml += `</tbody></table>`;
        container.innerHTML = tableHtml;
    },
    
    bindEvents() {
        document.getElementById('add-group-btn')?.addEventListener('click', () => this.showAddGroupModal());
        document.getElementById('reset-groups-btn')?.addEventListener('click', () => this.resetToDefaults());
        document.getElementById('save-groups-btn')?.addEventListener('click', () => this.saveGroups());
    },
    
    async loadGroups() {
        try {
            Loading.show('載入組別資料...');
            const result = await SheetsService.post(API_CONFIG.endpoints.settings.getGroups, { unit_id: this.unitId });
            this.groups = result.success && result.data ? result.data.map(g => Group.fromObject(g)) : Group.getDefaults();
            this.renderGroupsTable();
            Loading.hide();
        } catch (error) {
            Loading.hide();
            Notification.error('載入組別資料失敗: ' + error.message);
            this.groups = Group.getDefaults();
            this.renderGroupsTable();
        }
    },
    
    async saveGroups() {
        try {
            for (const group of this.groups) {
                const validation = group.validate();
                if (!validation.valid) {
                    Notification.error(`組別「${group.name}」驗證失敗: ${validation.errors.join('、')}`);
                    return;
                }
            }
            
            Loading.show('儲存組別資料...');
            const result = await SheetsService.post(API_CONFIG.endpoints.settings.saveGroups, {
                unit_id: this.unitId,
                groups: this.groups.map(g => g.toObject())
            });
            
            if (!result.success) throw new Error(result.message || '儲存失敗');
            
            Loading.hide();
            Notification.success('組別資料已儲存');
            SheetsService.clearCache('/settings/groups');
        } catch (error) {
            Loading.hide();
            Notification.error('儲存組別資料失敗: ' + error.message);
        }
    },
    
    async showAddGroupModal() {
        const result = await Modal.form('新增組別', [
            { name: 'name', label: '組別名稱', type: 'text', placeholder: '例如: 資深組', required: true },
            { name: 'totalStaff', label: '總員額', type: 'number', value: 0, required: true },
            { name: 'minPerShift', label: '每班最少', type: 'number', value: 0, required: true },
            { name: 'maxPerShift', label: '每班最多', type: 'number', value: 0, required: true },
            { name: 'description', label: '說明', type: 'textarea', required: false }
        ]);
        
        if (result) {
            const newGroup = new Group({
                id: Date.now(),
                ...result,
                totalStaff: parseInt(result.totalStaff),
                minPerShift: parseInt(result.minPerShift),
                maxPerShift: parseInt(result.maxPerShift)
            });
            
            const validation = newGroup.validate();
            if (!validation.valid) {
                Notification.error('驗證失敗: ' + validation.errors.join('、'));
                return;
            }
            
            this.groups.push(newGroup);
            this.renderGroupsTable();
            Notification.success('組別已新增，請記得儲存變更');
        }
    },
    
    async editGroup(groupId) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group) return;
        
        const result = await Modal.form('編輯組別', [
            { name: 'name', label: '組別名稱', type: 'text', value: group.name, required: true },
            { name: 'totalStaff', label: '總員額', type: 'number', value: group.totalStaff, required: true },
            { name: 'minPerShift', label: '每班最少', type: 'number', value: group.minPerShift, required: true },
            { name: 'maxPerShift', label: '每班最多', type: 'number', value: group.maxPerShift, required: true },
            { name: 'description', label: '說明', type: 'textarea', value: group.description, required: false }
        ]);
        
        if (result) {
            group.name = result.name;
            group.totalStaff = parseInt(result.totalStaff);
            group.minPerShift = parseInt(result.minPerShift);
            group.maxPerShift = parseInt(result.maxPerShift);
            group.description = result.description;
            
            this.renderGroupsTable();
            Notification.success('組別已更新，請記得儲存變更');
        }
    },
    
    async deleteGroup(groupId) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group) return;
        
        const confirmed = await Modal.confirm(`確定要刪除組別「${group.name}」嗎？`, { danger: true });
        if (confirmed) {
            this.groups = this.groups.filter(g => g.id !== groupId);
            this.renderGroupsTable();
            Notification.success('組別已刪除，請記得儲存變更');
        }
    },
    
    async resetToDefaults() {
        const confirmed = await Modal.confirm('確定要重設為預設組別嗎？\n\n⚠️ 這會清除所有自訂的組別設定。', { danger: true });
        if (confirmed) {
            this.groups = Group.getDefaults();
            this.renderGroupsTable();
            Notification.success('已重設為預設組別，請記得儲存變更');
        }
    }
};

if (typeof window !== 'undefined') {
    window.GroupManagement = GroupManagement;
}