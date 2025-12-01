/**
 * 使用者分配模組
 * 管理單位中的使用者及其角色
 */

const UserAssignment = {
    currentUnit: null,
    unitUsers: null,
    
    // ==================== 初始化 ====================
    
    /**
     * 開啟使用者分配對話框
     * @param {string} unitId - 單位 ID
     */
    async openDialog(unitId) {
        try {
            console.log('[UserAssignment] 開啟使用者分配對話框:', unitId);
            
            Loading.show('載入使用者資料...');
            
            // 載入單位資料
            const [unitData, usersData] = await Promise.all([
                UnitService.getUnit(unitId),
                UnitService.getUnitUsers(unitId)
            ]);
            
            this.currentUnit = new Unit(unitData);
            this.unitUsers = usersData;
            
            Loading.hide();
            
            // 顯示對話框
            Modal.open({
                title: `使用者管理 - ${this.currentUnit.getDisplayName()}`,
                content: this.renderContent(),
                showFooter: false,
                size: 'large'
            });
            
        } catch (error) {
            Loading.hide();
            Notification.error('載入失敗', error.message);
        }
    },
    
    // ==================== UI 渲染 ====================
    
    /**
     * 渲染主內容
     * @returns {string}
     */
    renderContent() {
        return `
            <div class="user-assignment-container">
                <!-- 新增使用者區域 -->
                <div class="add-user-section">
                    <h3 class="section-title">➕ 新增使用者</h3>
                    <div class="add-user-form">
                        <input 
                            type="email" 
                            id="new-user-email" 
                            class="form-control"
                            placeholder="輸入使用者 Email"
                        >
                        <select id="new-user-role" class="form-control">
                            <option value="">選擇角色...</option>
                            <option value="admin">管理者</option>
                            <option value="scheduler">排班者</option>
                            <option value="viewer">一般使用者</option>
                        </select>
                        <button 
                            type="button" 
                            class="btn btn-primary"
                            onclick="UserAssignment.addUser()"
                        >
                            新增
                        </button>
                    </div>
                    <small class="form-text text-muted">
                        💡 使用者加入後會收到通知 Email
                    </small>
                </div>
                
                <!-- 使用者列表 -->
                <div class="users-list-section">
                    ${this.renderUsersList()}
                </div>
                
                <!-- 操作按鈕 -->
                <div class="actions-section">
                    <button 
                        type="button" 
                        class="btn btn-secondary"
                        onclick="Modal.close()"
                    >
                        關閉
                    </button>
                    <button 
                        type="button" 
                        class="btn btn-secondary"
                        onclick="UserAssignment.exportUsers()"
                    >
                        匯出使用者列表
                    </button>
                </div>
            </div>
            
            <style>
                .user-assignment-container {
                    max-height: 70vh;
                    overflow-y: auto;
                }
                
                .section-title {
                    font-size: 16px;
                    font-weight: 600;
                    margin-bottom: 16px;
                    color: var(--text-primary);
                }
                
                .add-user-section {
                    padding: 20px;
                    background: var(--gray-50);
                    border-radius: 8px;
                    margin-bottom: 24px;
                }
                
                .add-user-form {
                    display: flex;
                    gap: 12px;
                    margin-bottom: 8px;
                }
                
                .add-user-form .form-control {
                    flex: 1;
                }
                
                .add-user-form select {
                    min-width: 150px;
                }
                
                .users-list-section {
                    margin-bottom: 24px;
                }
                
                .role-section {
                    margin-bottom: 24px;
                }
                
                .role-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 16px;
                    background: var(--gray-100);
                    border-radius: 8px 8px 0 0;
                    font-weight: 600;
                }
                
                .role-badge {
                    display: inline-block;
                    padding: 4px 12px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 600;
                }
                
                .role-badge.admin {
                    background: #FEE2E2;
                    color: #991B1B;
                }
                
                .role-badge.scheduler {
                    background: #DBEAFE;
                    color: #1E40AF;
                }
                
                .role-badge.viewer {
                    background: #D1FAE5;
                    color: #065F46;
                }
                
                .user-list {
                    border: 1px solid var(--border-color);
                    border-top: none;
                    border-radius: 0 0 8px 8px;
                }
                
                .user-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 16px;
                    border-bottom: 1px solid var(--border-color);
                    transition: background 0.2s;
                }
                
                .user-item:last-child {
                    border-bottom: none;
                }
                
                .user-item:hover {
                    background: var(--gray-50);
                }
                
                .user-info {
                    flex: 1;
                }
                
                .user-email {
                    font-weight: 500;
                    color: var(--text-primary);
                }
                
                .user-meta {
                    font-size: 12px;
                    color: var(--text-secondary);
                    margin-top: 2px;
                }
                
                .user-actions {
                    display: flex;
                    gap: 8px;
                }
                
                .empty-state {
                    padding: 32px;
                    text-align: center;
                    color: var(--text-secondary);
                    background: var(--gray-50);
                    border: 1px solid var(--border-color);
                    border-top: none;
                    border-radius: 0 0 8px 8px;
                }
                
                .actions-section {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                    padding-top: 20px;
                    border-top: 1px solid var(--border-color);
                }
            </style>
        `;
    },
    
    /**
     * 渲染使用者列表
     * @returns {string}
     */
    renderUsersList() {
        const roles = [
            { key: 'admin', name: '管理者', users: this.currentUnit.adminUsers },
            { key: 'scheduler', name: '排班者', users: this.currentUnit.schedulerUsers },
            { key: 'viewer', name: '一般使用者', users: this.currentUnit.viewerUsers }
        ];
        
        return roles.map(role => `
            <div class="role-section">
                <div class="role-header">
                    <span>${role.name}</span>
                    <span class="role-badge ${role.key}">${role.users.length} 人</span>
                </div>
                ${this.renderRoleUserList(role.key, role.users)}
            </div>
        `).join('');
    },
    
    /**
     * 渲染角色的使用者列表
     * @param {string} roleKey - 角色鍵值
     * @param {Array} users - 使用者列表
     * @returns {string}
     */
    renderRoleUserList(roleKey, users) {
        if (users.length === 0) {
            return `
                <div class="empty-state">
                    目前沒有此角色的使用者
                </div>
            `;
        }
        
        return `
            <div class="user-list">
                ${users.map(email => this.renderUserItem(roleKey, email)).join('')}
            </div>
        `;
    },
    
    /**
     * 渲染使用者項目
     * @param {string} roleKey - 角色鍵值
     * @param {string} email - Email
     * @returns {string}
     */
    renderUserItem(roleKey, email) {
        const currentUserEmail = Auth.getCurrentUser()?.email;
        const isCurrentUser = email === currentUserEmail;
        
        return `
            <div class="user-item">
                <div class="user-info">
                    <div class="user-email">
                        ${email}
                        ${isCurrentUser ? '<span style="color: var(--primary); font-size: 12px;">(您)</span>' : ''}
                    </div>
                    <div class="user-meta">
                        ${this.getRoleDescription(roleKey)}
                    </div>
                </div>
                <div class="user-actions">
                    ${this.renderUserActions(roleKey, email, isCurrentUser)}
                </div>
            </div>
        `;
    },
    
    /**
     * 渲染使用者操作按鈕
     * @param {string} roleKey - 角色鍵值
     * @param {string} email - Email
     * @param {boolean} isCurrentUser - 是否為當前使用者
     * @returns {string}
     */
    renderUserActions(roleKey, email, isCurrentUser) {
        // 不能移除自己
        if (isCurrentUser) {
            return '<span style="font-size: 12px; color: var(--text-secondary);">無法移除自己</span>';
        }
        
        // 至少要有一個管理者
        if (roleKey === 'admin' && this.currentUnit.adminUsers.length === 1) {
            return '<span style="font-size: 12px; color: var(--text-secondary);">至少需要一位管理者</span>';
        }
        
        return `
            ${roleKey !== 'admin' ? `
                <button 
                    class="btn btn-sm btn-secondary"
                    onclick="UserAssignment.changeRole('${email}', 'admin')"
                    title="升級為管理者"
                >
                    ⬆️
                </button>
            ` : ''}
            ${roleKey !== 'viewer' ? `
                <button 
                    class="btn btn-sm btn-secondary"
                    onclick="UserAssignment.changeRole('${email}', 'viewer')"
                    title="降級為一般使用者"
                >
                    ⬇️
                </button>
            ` : ''}
            <button 
                class="btn btn-sm btn-danger"
                onclick="UserAssignment.removeUser('${email}')"
                title="移除使用者"
            >
                移除
            </button>
        `;
    },
    
    /**
     * 取得角色描述
     * @param {string} roleKey - 角色鍵值
     * @returns {string}
     */
    getRoleDescription(roleKey) {
        const descriptions = {
            admin: '可管理單位、查看所有資料',
            scheduler: '可管理預班、排班、查看統計',
            viewer: '可查看排班、提交預班'
        };
        return descriptions[roleKey] || '';
    },
    
    // ==================== 使用者操作 ====================
    
    /**
     * 新增使用者
     */
    async addUser() {
        try {
            const emailInput = document.getElementById('new-user-email');
            const roleSelect = document.getElementById('new-user-role');
            
            if (!emailInput || !roleSelect) return;
            
            const email = emailInput.value.trim();
            const role = roleSelect.value;
            
            // 驗證
            if (!Utils.isValidEmail(email)) {
                Notification.warning('請輸入有效的 Email 地址');
                return;
            }
            
            if (!role) {
                Notification.warning('請選擇角色');
                return;
            }
            
            // 檢查是否已存在
            if (this.currentUnit.hasAccess(email)) {
                Notification.warning('此使用者已在單位中');
                return;
            }
            
            // 新增使用者
            Loading.show('新增使用者中...');
            
            if (role === 'admin') {
                await UnitService.addAdminUser(this.currentUnit.id, email);
            } else if (role === 'scheduler') {
                await UnitService.addSchedulerUser(this.currentUnit.id, email);
            } else {
                // 一般使用者 (暫時使用 addSchedulerUser，後續需要實作 addViewerUser)
                await UnitService.addSchedulerUser(this.currentUnit.id, email);
            }
            
            Loading.hide();
            Notification.success('使用者已新增');
            
            // 清空輸入
            emailInput.value = '';
            roleSelect.value = '';
            
            // 重新載入
            await this.reload();
            
        } catch (error) {
            Loading.hide();
            Notification.error('新增失敗', error.message);
        }
    },
    
    /**
     * 移除使用者
     * @param {string} email - Email
     */
    async removeUser(email) {
        try {
            const confirmed = await this.confirmRemove(email);
            if (!confirmed) return;
            
            Loading.show('移除使用者中...');
            
            await UnitService.removeUser(this.currentUnit.id, email);
            
            Loading.hide();
            Notification.success('使用者已移除');
            
            // 重新載入
            await this.reload();
            
        } catch (error) {
            Loading.hide();
            Notification.error('移除失敗', error.message);
        }
    },
    
    /**
     * 變更角色
     * @param {string} email - Email
     * @param {string} newRole - 新角色
     */
    async changeRole(email, newRole) {
        try {
            Loading.show('變更角色中...');
            
            // 先移除舊角色
            await UnitService.removeUser(this.currentUnit.id, email);
            
            // 新增新角色
            if (newRole === 'admin') {
                await UnitService.addAdminUser(this.currentUnit.id, email);
            } else if (newRole === 'scheduler') {
                await UnitService.addSchedulerUser(this.currentUnit.id, email);
            } else {
                await UnitService.addSchedulerUser(this.currentUnit.id, email);
            }
            
            Loading.hide();
            Notification.success('角色已變更');
            
            // 重新載入
            await this.reload();
            
        } catch (error) {
            Loading.hide();
            Notification.error('變更失敗', error.message);
        }
    },
    
    /**
     * 確認移除
     * @param {string} email - Email
     * @returns {Promise<boolean>}
     */
    async confirmRemove(email) {
        return new Promise((resolve) => {
            Modal.open({
                title: '確認移除使用者',
                content: `
                    <p>您確定要移除以下使用者嗎?</p>
                    <p style="margin-top: 12px; font-weight: 600;">
                        ${email}
                    </p>
                    <p style="margin-top: 12px; color: #666;">
                        移除後，該使用者將無法存取此單位的資料
                    </p>
                `,
                onConfirm: () => resolve(true),
                onCancel: () => resolve(false),
                confirmText: '確認移除',
                cancelText: '取消'
            });
        });
    },
    
    /**
     * 重新載入
     */
    async reload() {
        Modal.close();
        await this.openDialog(this.currentUnit.id);
    },
    
    // ==================== 匯出功能 ====================
    
    /**
     * 匯出使用者列表
     */
    async exportUsers() {
        try {
            const allUsers = [];
            
            // 管理者
            this.currentUnit.adminUsers.forEach(email => {
                allUsers.push({
                    Email: email,
                    角色: '管理者',
                    權限: '管理單位、查看所有資料'
                });
            });
            
            // 排班者
            this.currentUnit.schedulerUsers.forEach(email => {
                allUsers.push({
                    Email: email,
                    角色: '排班者',
                    權限: '管理預班、排班、查看統計'
                });
            });
            
            // 一般使用者
            this.currentUnit.viewerUsers.forEach(email => {
                allUsers.push({
                    Email: email,
                    角色: '一般使用者',
                    權限: '查看排班、提交預班'
                });
            });
            
            // 轉換為 CSV
            let csv = 'Email,角色,權限\n';
            allUsers.forEach(user => {
                csv += `${user.Email},${user.角色},${user.權限}\n`;
            });
            
            // 下載
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const filename = `${this.currentUnit.code}_使用者列表_${Utils.formatDate(new Date(), 'YYYYMMDD')}.csv`;
            
            Utils.downloadFile(blob, filename, 'text/csv');
            
            Notification.success('使用者列表已匯出');
            
        } catch (error) {
            Notification.error('匯出失敗', error.message);
        }
    },
    
    // ==================== 批次操作 ====================
    
    /**
     * 批次匯入使用者
     * @param {File} file - CSV 檔案
     */
    async batchImportUsers(file) {
        try {
            Loading.show('匯入使用者中...');
            
            // 讀取 CSV
            const text = await file.text();
            const lines = text.split('\n');
            
            let successCount = 0;
            let failCount = 0;
            
            // 跳過標題列
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                const [email, role] = line.split(',');
                
                try {
                    if (role === '管理者') {
                        await UnitService.addAdminUser(this.currentUnit.id, email.trim());
                    } else if (role === '排班者') {
                        await UnitService.addSchedulerUser(this.currentUnit.id, email.trim());
                    }
                    successCount++;
                } catch (error) {
                    console.error('匯入使用者失敗:', email, error);
                    failCount++;
                }
            }
            
            Loading.hide();
            Notification.success(`匯入完成`, `成功: ${successCount}, 失敗: ${failCount}`);
            
            // 重新載入
            await this.reload();
            
        } catch (error) {
            Loading.hide();
            Notification.error('匯入失敗', error.message);
        }
    }
};

// 讓使用者分配模組可在全域使用
if (typeof window !== 'undefined') {
    window.UserAssignment = UserAssignment;
}