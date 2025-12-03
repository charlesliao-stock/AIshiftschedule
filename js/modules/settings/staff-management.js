/**
 * js/modules/settings/staff-management.js
 * 人員管理模組 (含匯入功能)
 */

import { SettingsService } from '../../services/settings.service.js';
import { Notification } from '../../components/notification.js';
import { Loading } from '../../components/loading.js';
import { Modal } from '../../components/modal.js';
import { Utils } from '../../core/utils.js';

export const StaffManagement = {
    container: null,
    staffList: [],
    
    async init(container) {
        this.container = container;
        this.render();
        await this.loadStaff();
    },
    
    render() {
        this.container.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="mb-0">人員名單</h5>
                <div class="btn-group">
                    <button class="btn btn-outline-secondary btn-sm" id="import-staff-btn">📥 匯入人員</button>
                    <button class="btn btn-primary btn-sm" id="add-staff-btn">➕ 新增人員</button>
                </div>
            </div>
            <div id="staff-table-container">
                <div class="text-center py-4 text-muted">載入中...</div>
            </div>
        `;
        this.bindEvents();
    },

    // ... (loadStaff, renderTable 保持不變，請複製原檔) ...
    async loadStaff() {
        try {
            Loading.show('載入人員...');
            this.staffList = await SettingsService.getStaff();
            this.renderTable();
        } catch (error) { Notification.error('載入失敗'); } finally { Loading.hide(); }
    },

    renderTable() {
        const container = document.getElementById('staff-table-container');
        if (this.staffList.length === 0) {
            container.innerHTML = '<div class="alert alert-info">尚無人員資料</div>';
            return;
        }
        let html = `
            <table class="table table-hover">
                <thead>
                    <tr>
                        <th>員工編號</th>
                        <th>姓名</th>
                        <th>層級</th>
                        <th>組別</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
        `;
        this.staffList.forEach(staff => {
            html += `
                <tr>
                    <td>${staff.employeeId || '-'}</td>
                    <td>${staff.name}</td>
                    <td>${staff.level || '-'}</td>
                    <td>${staff.group || '-'}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-danger delete-staff-btn" data-id="${staff.id}">刪除</button>
                    </td>
                </tr>
            `;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
        container.querySelectorAll('.delete-staff-btn').forEach(btn => btn.addEventListener('click', (e) => this.deleteStaff(e.target.dataset.id)));
    },

    bindEvents() {
        document.getElementById('add-staff-btn')?.addEventListener('click', () => this.addStaff());
        document.getElementById('import-staff-btn')?.addEventListener('click', () => this.handleImport());
    },

    // ... (addStaff, deleteStaff 保持不變，請複製原檔) ...
    async addStaff() {
        const groups = await SettingsService.getGroups();
        const groupOptions = groups.map(g => ({ value: g.name, label: g.name }));
        const result = await Modal.form('新增人員', [
            { name: 'employeeId', label: '員工編號', required: true },
            { name: 'name', label: '姓名', required: true },
            { name: 'level', label: '層級 (如 N1, N2)', required: false },
            { name: 'group', label: '組別', type: 'select', options: groupOptions, required: true }
        ]);
        if (result) {
            try {
                Loading.show('儲存中...');
                await SettingsService.saveStaff(result);
                await this.loadStaff();
                Notification.success('新增成功');
            } catch (error) { Notification.error('新增失敗: ' + error.message); } finally { Loading.hide(); }
        }
    },

    async deleteStaff(id) {
        if (await Modal.confirm('確定刪除此人員？')) {
            try {
                Loading.show('刪除中...');
                await SettingsService.deleteStaff(id);
                await this.loadStaff();
                Notification.success('刪除成功');
            } catch (error) { Notification.error('刪除失敗'); } finally { Loading.hide(); }
        }
    },

    // ==================== 匯入功能 ====================

    async handleImport() {
        const modal = Modal.show({
            title: '匯入人員資料',
            content: `
                <div class="import-panel">
                    <div class="mb-3">
                        <p class="mb-1"><strong>步驟 1:</strong> 下載範例檔案，並依照格式填寫。</p>
                        <button class="btn btn-sm btn-outline-primary" id="download-staff-template-btn">📥 下載 CSV 範本</button>
                    </div>
                    <hr>
                    <div class="mb-3">
                        <p class="mb-1"><strong>步驟 2:</strong> 上傳填寫好的 CSV 檔案。</p>
                        <input type="file" id="csv-staff-file-input" accept=".csv" class="form-control">
                    </div>
                </div>
            `,
            buttons: [
                { text: '取消', onClick: () => Modal.close() },
                { text: '開始匯入', className: 'btn-primary', onClick: () => this.processImport() }
            ]
        });

        // 綁定下載按鈕
        setTimeout(() => {
            document.getElementById('download-staff-template-btn').onclick = () => {
                const csvContent = "員工編號,姓名,層級,組別,Email\n93001,王小明,N2,資深組,user1@example.com\n93002,李美華,N1,資淺組,user2@example.com";
                Utils.downloadCSV(csvContent, '人員匯入範本.csv');
            };
        }, 100);
    },

    async processImport() {
        const fileInput = document.getElementById('csv-staff-file-input');
        if (!fileInput || !fileInput.files[0]) {
            Notification.warning('請選擇檔案');
            return false;
        }

        try {
            Loading.show('處理中...');
            const file = fileInput.files[0];
            const rawData = await Utils.parseCSV(file);
            
            const staffToImport = [];
            for (const row of rawData) {
                if (!row['員工編號'] || !row['姓名']) continue;
                
                staffToImport.push({
                    employeeId: row['員工編號'],
                    name: row['姓名'],
                    level: row['層級'] || '',
                    group: row['組別'] || '',
                    email: row['Email'] || '',
                    status: 'active'
                });
            }

            if (staffToImport.length === 0) {
                Notification.warning('檔案中沒有有效資料');
                Loading.hide();
                return true;
            }

            await SettingsService.batchSaveStaff(staffToImport);
            
            Notification.success(`成功匯入 ${staffToImport.length} 筆人員`);
            await this.loadStaff();
            Loading.hide();
            return true;

        } catch (error) {
            console.error(error);
            Notification.error('匯入失敗: ' + error.message);
            Loading.hide();
            return false;
        }
    }
};
