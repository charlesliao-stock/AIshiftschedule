/**
 * js/modules/unit-management/user-assignment.js
 * 人員權限分配模組 (完整重構版)
 */

import { UnitService } from '../../services/unit.service.js';
import { SettingsService } from '../../services/settings.service.js'; // 用於讀取人員名單
import { Notification } from '../../components/notification.js';
import { Loading } from '../../components/loading.js';
import { Modal } from '../../components/modal.js';
import { Auth } from '../../core/auth.js';

export const UserAssignment = {
    currentUnitId: null,
    currentUnitName: '',
    allStaffList: [], // 暫存所有員工資料
    currentRoleFilter: 'scheduler', // 預設新增的角色

    async openDialog(unitId) {
        this.currentUnitId = unitId;
        Loading.show('載入人員資料...');
        
        try {
            // 平行載入：單位資訊、單位現有人員、全系統人員名單(用於搜尋)
            const [unitData, unitUsers, staffList] = await Promise.all([
                UnitService.getUnit(unitId),
                UnitService.getUnitUsers(unitId),
                SettingsService.getStaff()
            ]);

            this.currentUnitName = unitData.unit_name;
            this.allStaffList = staffList;

            this.render(unitUsers);
        } catch (e) {
            console.error(e);
            Notification.error('載入失敗: ' + e.message);
        } finally {
            Loading.hide();
        }
    },

    render(unitUsers) {
        const isSystemAdmin = Auth.isAdmin();
        
        // 渲染現有人員列表
        const renderUserList = (users, role, title, canEdit) => {
            if (!users || users.length === 0) {
                return `<div class="text-muted small ms-2 mb-2">無資料</div>`;
            }
            return `
                <ul class="list-group mb-3">
                    <li class="list-group-item list-group-item-light fw-bold">${title}</li>
                    ${users.map(email => {
                        // 嘗試從 staffList 找到對應姓名
                        const staff = this.allStaffList.find(s => s.email === email);
                        const displayName = staff ? `${staff.name} (${staff.employeeId})` : email;
                        
                        return `
                        <li class="list-group-item d-flex justify-content-between align-items-center">
                            <span>${displayName}</span>
                            ${canEdit ? `
                                <button class="btn btn-sm btn-outline-danger remove-user-btn" 
                                    data-email="${email}" data-role="${role}">
                                    移除
                                </button>
                            ` : '<span class="badge bg-secondary">唯讀</span>'}
                        </li>
                    `}).join('')}
                </ul>
            `;
        };

        const content = `
            <div class="user-assignment-modal">
                <div class="mb-4">
                    <h5 class="border-bottom pb-2">現有人員 - ${this.currentUnitName}</h5>
                    ${renderUserList(unitUsers.adminUsers, 'admin', '單位管理者', isSystemAdmin)}
                    ${renderUserList(unitUsers.schedulerUsers, 'scheduler', '單位排班者', true)}
                </div>

                <div class="card bg-light">
                    <div class="card-body">
                        <h6 class="card-title">新增人員</h6>
                        
                        <div class="mb-3">
                            <label class="form-label">分配角色:</label>
                            <div class="btn-group w-100" role="group">
                                <input type="radio" class="btn-check" name="role-select" id="role-scheduler" value="scheduler" checked>
                                <label class="btn btn-outline-primary" for="role-scheduler">單位排班者</label>

                                ${isSystemAdmin ? `
                                    <input type="radio" class="btn-check" name="role-select" id="role-admin" value="admin">
                                    <label class="btn btn-outline-danger" for="role-admin">單位管理者</label>
                                ` : ''}
                            </div>
                        </div>

                        <ul class="nav nav-tabs mb-3" id="add-method-tabs">
                            <li class="nav-item">
                                <a class="nav-link active" data-tab="search" href="#">從名單搜尋</a>
                            </li>
                            <li class="nav-item">
                                <a class="nav-link" data-tab="email" href="#">輸入 Email</a>
                            </li>
                        </ul>

                        <div id="tab-search" class="tab-pane active">
                            <div class="mb-2">
                                <select class="form-select mb-2" id="unit-filter">
                                    <option value="">-- 篩選單位 (全部) --</option>
                                    ${this.getUnitOptions()}
                                </select>
                                <select class="form-select" id="staff-select">
                                    <option value="">請選擇人員...</option>
                                    ${this.getStaffOptions()}
                                </select>
                            </div>
                            <button class="btn btn-primary w-100" id="add-from-list-btn">新增選取人員</button>
                        </div>

                        <div id="tab-email" class="tab-pane" style="display: none;">
                            <div class="input-group mb-2">
                                <input type="email" id="new-user-email" class="form-control" placeholder="user@example.com">
                            </div>
                            <button class="btn btn-primary w-100" id="add-by-email-btn">新增 Email</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        Modal.show({
            title: '人員管理', // 標題修正
            content,
            size: 'large',
            buttons: [{ text: '關閉', onClick: () => Modal.close() }]
        });

        this.bindEvents();
    },

    bindEvents() {
        // 1. 移除按鈕
        document.querySelectorAll('.remove-user-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const { email, role } = e.target.dataset;
                this.removeUser(email, role);
            });
        });

        // 2. 頁籤切換
        document.querySelectorAll('#add-method-tabs .nav-link').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('#add-method-tabs .nav-link').forEach(t => t.classList.remove('active'));
                e.target.classList.add('active');
                
                const targetId = e.target.dataset.tab;
                document.getElementById('tab-search').style.display = targetId === 'search' ? 'block' : 'none';
                document.getElementById('tab-email').style.display = targetId === 'email' ? 'block' : 'none';
            });
        });

        // 3. 單位篩選連動
        document.getElementById('unit-filter')?.addEventListener('change', (e) => {
            this.updateStaffSelect(e.target.value);
        });

        // 4. 新增按鈕
        document.getElementById('add-from-list-btn')?.addEventListener('click', () => this.handleAddFromList());
        document.getElementById('add-by-email-btn')?.addEventListener('click', () => this.handleAddByEmail());
    },

    // 取得所有單位選項 (從 staff list 中萃取 unique group/unit)
    getUnitOptions() {
        const units = [...new Set(this.allStaffList.map(s => s.group).filter(Boolean))];
        return units.map(u => `<option value="${u}">${u}</option>`).join('');
    },

    // 取得人員選項
    getStaffOptions(filterUnit = '') {
        let filtered = this.allStaffList;
        if (filterUnit) {
            filtered = filtered.filter(s => s.group === filterUnit);
        }
        return filtered.map(s => 
            `<option value="${s.email}" data-name="${s.name}">
                ${s.employeeId} - ${s.name} (${s.group})
            </option>`
        ).join('');
    },

    updateStaffSelect(unit) {
        const select = document.getElementById('staff-select');
        if (select) {
            select.innerHTML = '<option value="">請選擇人員...</option>' + this.getStaffOptions(unit);
        }
    },

    getSelectedRole() {
        const schedulerRadio = document.getElementById('role-scheduler');
        return schedulerRadio && schedulerRadio.checked ? 'scheduler' : 'admin';
    },

    async handleAddFromList() {
        const select = document.getElementById('staff-select');
        const email = select.value;
        const role = this.getSelectedRole();

        if (!email) return Notification.warning('請選擇人員');
        await this.addUser(email, role);
    },

    async handleAddByEmail() {
        const email = document.getElementById('new-user-email').value;
        const role = this.getSelectedRole();

        if (!email) return Notification.warning('請輸入 Email');
        await this.addUser(email, role);
    },

    async addUser(email, role) {
        try {
            Loading.show('新增中...');
            await UnitService.addUserRole(this.currentUnitId, email, role);
            Notification.success('新增成功');
            // 重新載入 Modal 內容
            this.openDialog(this.currentUnitId);
        } catch(e) {
            Notification.error('新增失敗: ' + e.message);
        } finally {
            Loading.hide();
        }
    },

    async removeUser(email, role) {
        if (!await Modal.confirm(`確定要移除 ${email} 的 ${role === 'admin' ? '管理者' : '排班者'} 權限嗎？`)) return;

        try {
            Loading.show('移除中...');
            await UnitService.removeUserFromRole(this.currentUnitId, email, role);
            Notification.success('已移除');
            this.openDialog(this.currentUnitId);
        } catch(e) {
            Notification.error('移除失敗: ' + e.message);
        } finally {
            Loading.hide();
        }
    }
};
