/**
 * js/modules/settings/user-assignment.js
 * 使用者分配模組 (ES Module 版)
 */

import { UnitService } from '../../services/unit.service.js';
import { Notification } from '../../components/notification.js';
import { Loading } from '../../components/loading.js';
import { Modal } from '../../components/modal.js';

export const UserAssignment = {
    currentUnitId: null,

    async openDialog(unitId) {
        this.currentUnitId = unitId;
        Loading.show('載入中...');
        try {
            const users = await UnitService.getUnitUsers(unitId);
            this.render(users);
        } catch (e) {
            Notification.error('載入失敗');
        } finally {
            Loading.hide();
        }
    },

    render(users) {
        const content = `
            <div class="user-assignment p-3">
                <div class="mb-3">
                    <label>新增使用者 Email</label>
                    <div class="input-group">
                        <input type="email" id="new-user-email" class="form-control" placeholder="user@example.com">
                        <button class="btn btn-primary" id="add-user-btn">新增</button>
                    </div>
                </div>
                <h6>現有人員</h6>
                <ul class="list-group">
                    ${users.adminUsers.map(u => `<li class="list-group-item d-flex justify-content-between">${u} <span class="badge bg-danger">管理員</span></li>`).join('')}
                    ${users.schedulerUsers.map(u => `<li class="list-group-item d-flex justify-content-between">${u} <span class="badge bg-primary">排班者</span></li>`).join('')}
                </ul>
            </div>
        `;

        Modal.show({
            title: '使用者管理',
            content,
            buttons: [{ text: '關閉', onClick: () => Modal.close() }]
        });

        document.getElementById('add-user-btn')?.addEventListener('click', () => {
            const email = document.getElementById('new-user-email').value;
            if(email) this.addUser(email);
        });
    },

    async addUser(email) {
        try {
            Loading.show('新增中...');
            await UnitService.addUserRole(this.currentUnitId, email, 'scheduler');
            Notification.success('新增成功');
            this.openDialog(this.currentUnitId); // 重整
        } catch(e) {
            Notification.error('新增失敗');
        } finally {
            Loading.hide();
        }
    }
};
