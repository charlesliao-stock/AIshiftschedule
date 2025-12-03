/**
 * js/modules/settings/shift-management.js
 * 班別管理模組 (含匯入功能)
 */

import { SettingsService } from '../../services/settings.service.js';
import { Notification } from '../../components/notification.js';
import { Loading } from '../../components/loading.js';
import { Modal } from '../../components/modal.js';
import { Utils } from '../../core/utils.js';

export const ShiftManagement = {
    container: null,
    shifts: [],

    async init(container) {
        this.container = container;
        this.render();
        await this.loadShifts();
    },

    render() {
        this.container.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h5 class="mb-0">班別定義</h5>
                <div class="btn-group">
                    <button class="btn btn-outline-secondary btn-sm" id="import-shift-btn">📥 匯入班別</button>
                    <button class="btn btn-primary btn-sm" id="add-shift-btn">➕ 新增班別</button>
                </div>
            </div>
            <div id="shifts-table-container">
                <div class="text-center py-4 text-muted">載入中...</div>
            </div>
        `;
        this.bindEvents();
    },

    // ... (loadShifts, renderTable 保持不變，請複製原檔) ...
    async loadShifts() {
        try {
            Loading.show('載入班別...');
            this.shifts = await SettingsService.getShifts();
            this.renderTable();
        } catch (error) {
            Notification.error('載入失敗');
            document.getElementById('shifts-table-container').innerHTML = `<div class="text-danger">載入失敗: ${error.message}</div>`;
        } finally {
            Loading.hide();
        }
    },

    renderTable() {
        const container = document.getElementById('shifts-table-container');
        if (!this.shifts || this.shifts.length === 0) {
            container.innerHTML = '<div class="alert alert-info">目前沒有班別設定，請新增。</div>';
            return;
        }
        let html = `
            <table class="table table-hover align-middle">
                <thead>
                    <tr>
                        <th>代碼</th>
                        <th>名稱</th>
                        <th>時間</th>
                        <th>代表色</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
        `;
        this.shifts.forEach(shift => {
            const colorBoxStyle = `width: 24px; height: 24px; background-color: ${shift.color}; border-radius: 4px; border: 1px solid #ccc; display: inline-block; vertical-align: middle; margin-right: 8px;`;
            html += `
                <tr>
                    <td><span class="badge bg-light text-dark border">${shift.code}</span></td>
                    <td>${shift.name}</td>
                    <td>${shift.startTime} - ${shift.endTime}</td>
                    <td><div style="${colorBoxStyle}"></div><span class="text-muted small">${shift.color}</span></td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary edit-shift-btn" data-id="${shift.id}">編輯</button>
                        <button class="btn btn-sm btn-outline-danger delete-shift-btn" data-id="${shift.id}">刪除</button>
                    </td>
                </tr>
            `;
        });
        html += `</tbody></table>`;
        container.innerHTML = html;
        container.querySelectorAll('.edit-shift-btn').forEach(btn => btn.addEventListener('click', (e) => this.editShift(e.target.dataset.id)));
        container.querySelectorAll('.delete-shift-btn').forEach(btn => btn.addEventListener('click', (e) => this.deleteShift(e.target.dataset.id)));
    },

    bindEvents() {
        document.getElementById('add-shift-btn')?.addEventListener('click', () => this.addShift());
        document.getElementById('import-shift-btn')?.addEventListener('click', () => this.handleImport());
    },

    // ... (addShift, editShift, deleteShift 保持不變，請複製原檔) ...
    async addShift() {
        const result = await Modal.form('新增班別', [
            { name: 'name', label: '班別名稱', placeholder: '例如: 白班', required: true },
            { name: 'code', label: '代碼', placeholder: '例如: D', required: true },
            { name: 'startTime', label: '開始時間', type: 'time', value: '08:00', required: true },
            { name: 'endTime', label: '結束時間', type: 'time', value: '16:00', required: true },
            { name: 'color', label: '代表色', type: 'color', value: '#E9D5FF', required: true }
        ]);
        if (result) {
            try {
                Loading.show('儲存中...');
                const newShift = { ...result, id: 'shift_' + Date.now() };
                await SettingsService.saveShift(newShift);
                await this.loadShifts();
                Notification.success('新增成功');
            } catch (error) { Notification.error('儲存失敗: ' + error.message); } finally { Loading.hide(); }
        }
    },

    async editShift(id) {
        const shift = this.shifts.find(s => s.id === id);
        if (!shift) return;
        const result = await Modal.form('編輯班別', [
            { name: 'name', label: '班別名稱', value: shift.name, required: true },
            { name: 'code', label: '代碼', value: shift.code, required: true },
            { name: 'startTime', label: '開始時間', type: 'time', value: shift.startTime, required: true },
            { name: 'endTime', label: '結束時間', type: 'time', value: shift.endTime, required: true },
            { name: 'color', label: '代表色', type: 'color', value: shift.color, required: true }
        ]);
        if (result) {
            try {
                Loading.show('更新中...');
                const updatedShift = { ...shift, ...result };
                await SettingsService.saveShift(updatedShift);
                await this.loadShifts();
                Notification.success('更新成功');
            } catch (error) { Notification.error('更新失敗: ' + error.message); } finally { Loading.hide(); }
        }
    },

    async deleteShift(id) {
        if (await Modal.confirm('確定要刪除此班別嗎？')) {
            try {
                Loading.show('刪除中...');
                await SettingsService.deleteShift(id);
                await this.loadShifts();
                Notification.success('刪除成功');
            } catch (error) { Notification.error('刪除失敗'); } finally { Loading.hide(); }
        }
    },

    // ==================== 匯入功能 ====================

    async handleImport() {
        // 1. 顯示匯入視窗
        const modal = Modal.show({
            title: '匯入班別資料',
            content: `
                <div class="import-panel">
                    <div class="mb-3">
                        <p class="mb-1"><strong>步驟 1:</strong> 下載範例檔案，並依照格式填寫。</p>
                        <button class="btn btn-sm btn-outline-primary" id="download-template-btn">📥 下載 CSV 範本</button>
                    </div>
                    <hr>
                    <div class="mb-3">
                        <p class="mb-1"><strong>步驟 2:</strong> 上傳填寫好的 CSV 檔案。</p>
                        <input type="file" id="csv-file-input" accept=".csv" class="form-control">
                    </div>
                    <div class="alert alert-warning small">
                        注意：匯入時若「代碼」相同，將會更新原有資料。
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
            document.getElementById('download-template-btn').onclick = () => {
                const csvContent = "代碼,名稱,開始時間,結束時間,顏色\nD,白班,08:00,16:00,#FEF3C7\nE,小夜,16:00,00:00,#C7D2FE\nN,大夜,00:00,08:00,#E9D5FF";
                Utils.downloadCSV(csvContent, '班別匯入範本.csv');
            };
        }, 100);
    },

    async processImport() {
        const fileInput = document.getElementById('csv-file-input');
        if (!fileInput || !fileInput.files[0]) {
            Notification.warning('請選擇檔案');
            return false; // 不關閉視窗
        }

        try {
            Loading.show('處理中...');
            const file = fileInput.files[0];
            const rawData = await Utils.parseCSV(file);
            
            // 資料轉換與驗證
            const shiftsToImport = [];
            for (const row of rawData) {
                if (!row['代碼'] || !row['名稱']) continue; // 跳過無效資料
                
                shiftsToImport.push({
                    code: row['代碼'],
                    name: row['名稱'],
                    startTime: row['開始時間'] || '08:00',
                    endTime: row['結束時間'] || '16:00',
                    color: row['顏色'] || '#EEEEEE',
                    countToStats: true,
                    order: 99
                });
            }

            if (shiftsToImport.length === 0) {
                Notification.warning('檔案中沒有有效資料');
                Loading.hide();
                return true; // 關閉視窗
            }

            await SettingsService.batchSaveShifts(shiftsToImport);
            
            Notification.success(`成功匯入 ${shiftsToImport.length} 筆班別`);
            await this.loadShifts(); // 重整列表
            Loading.hide();
            return true; // 關閉視窗

        } catch (error) {
            console.error(error);
            Notification.error('匯入失敗: ' + error.message);
            Loading.hide();
            return false;
        }
    }
};
