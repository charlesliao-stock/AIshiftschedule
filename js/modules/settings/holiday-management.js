/**
 * js/modules/settings/holiday-management.js
 * 假日管理模組 (ES Module + Firebase 版)
 */

import { SettingsService } from '../../services/settings.service.js';
import { Notification } from '../../components/notification.js';
import { Loading } from '../../components/loading.js';
import { Modal } from '../../components/modal.js';
import { Utils } from '../../core/utils.js';

export const HolidayManagement = {
    container: null,
    allHolidays: [], // 存放所有年份的假日
    currentYear: new Date().getFullYear(),

    async init(container) {
        this.container = container;
        this.render();
        await this.loadHolidays();
    },

    render() {
        this.container.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-3">
                <div class="d-flex align-items-center gap-2">
                    <h5 class="mb-0">假日設定</h5>
                    <select id="year-select" class="form-select form-select-sm" style="width: auto;">
                        <option value="${this.currentYear - 1}">${this.currentYear - 1}</option>
                        <option value="${this.currentYear}" selected>${this.currentYear}</option>
                        <option value="${this.currentYear + 1}">${this.currentYear + 1}</option>
                    </select>
                </div>
                <div class="btn-group">
                    <button class="btn btn-outline-secondary btn-sm" id="import-holidays-btn">📥 匯入國定假日</button>
                    <button class="btn btn-primary btn-sm" id="add-holiday-btn">➕ 新增假日</button>
                </div>
            </div>
            <div id="holidays-table-container">
                <div class="text-center py-4 text-muted">載入中...</div>
            </div>
        `;
        this.bindEvents();
    },

    async loadHolidays() {
        try {
            Loading.show('載入假日...');
            // 載入"所有"假日，後端不分年
            this.allHolidays = await SettingsService.getHolidays(); 
            this.renderTable();
        } catch (error) {
            Notification.error('載入失敗');
        } finally {
            Loading.hide();
        }
    },

    renderTable() {
        const container = document.getElementById('holidays-table-container');
        
        // 根據選擇的年份篩選
        const filteredHolidays = this.allHolidays.filter(h => 
            h.applicableYear === 'all' || parseInt(h.applicableYear) === this.currentYear
        );

        // 排序：先排固定週期，再排日期
        filteredHolidays.sort((a, b) => {
            if (a.type === 'recurring' && b.type !== 'recurring') return 1;
            if (a.type !== 'recurring' && b.type === 'recurring') return -1;
            return (a.date || '').localeCompare(b.date || '');
        });

        if (filteredHolidays.length === 0) {
            container.innerHTML = `
                <div class="alert alert-info text-center">
                    ${this.currentYear} 年尚無假日設定。<br>
                    您可以點擊「匯入國定假日」快速建立。
                </div>`;
            return;
        }

        let html = `
            <table class="table table-hover align-middle">
                <thead>
                    <tr>
                        <th>日期</th>
                        <th>名稱</th>
                        <th>類型</th>
                        <th>適用年度</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
        `;

        filteredHolidays.forEach((holiday, index) => {
            const typeMap = { 'national': '國定假日', 'recurring': '固定週期', 'other': '其他' };
            const typeName = typeMap[holiday.type] || '其他';
            
            html += `
                <tr>
                    <td>${holiday.date}</td>
                    <td>${holiday.name}</td>
                    <td><span class="badge bg-light text-dark border">${typeName}</span></td>
                    <td>${holiday.applicableYear === 'all' ? '每年' : holiday.applicableYear}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-danger delete-holiday-btn" data-id="${holiday.id}">刪除</button>
                    </td>
                </tr>
            `;
        });

        html += `</tbody></table>`;
        container.innerHTML = html;

        container.querySelectorAll('.delete-holiday-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.deleteHoliday(e.target.dataset.id));
        });
    },

    bindEvents() {
        const yearSelect = document.getElementById('year-select');
        yearSelect?.addEventListener('change', (e) => {
            this.currentYear = parseInt(e.target.value);
            this.renderTable();
        });

        document.getElementById('add-holiday-btn')?.addEventListener('click', () => this.addHoliday());
        document.getElementById('import-holidays-btn')?.addEventListener('click', () => this.importNationalHolidays());
    },

    async addHoliday() {
        const result = await Modal.form('新增假日', [
            { name: 'date', label: '日期', type: 'date', required: true },
            { name: 'name', label: '名稱', placeholder: '例如: 員工旅遊', required: true },
            { name: 'type', label: '類型', type: 'select', options: [
                { value: 'other', label: '其他' },
                { value: 'national', label: '國定假日' },
                { value: 'recurring', label: '固定週期 (每年)' }
            ], required: true }
        ]);

        if (result) {
            try {
                Loading.show('儲存中...');
                const newHoliday = {
                    id: 'h_' + Date.now(),
                    date: result.date,
                    name: result.name,
                    type: result.type,
                    // 如果是 recurring 則設為 all，否則設為當前年份
                    applicableYear: result.type === 'recurring' ? 'all' : this.currentYear.toString()
                };

                this.allHolidays.push(newHoliday);
                await SettingsService.saveHolidays(this.allHolidays); // 儲存整個陣列
                this.renderTable();
                Notification.success('新增成功');
            } catch (error) {
                Notification.error('儲存失敗: ' + error.message);
            } finally {
                Loading.hide();
            }
        }
    },

    async deleteHoliday(id) {
        if (await Modal.confirm('確定刪除此假日？')) {
            try {
                Loading.show('刪除中...');
                this.allHolidays = this.allHolidays.filter(h => h.id !== id);
                await SettingsService.saveHolidays(this.allHolidays);
                this.renderTable();
                Notification.success('刪除成功');
            } catch (error) {
                Notification.error('刪除失敗');
            } finally {
                Loading.hide();
            }
        }
    },

    async importNationalHolidays() {
        if (!await Modal.confirm(`確定要匯入 ${this.currentYear} 年的台灣國定假日嗎？`)) return;

        try {
            Loading.show('匯入中...');
            
            // 簡單的國定假日產生器 (範例)
            const holidays = this.generateTaiwanHolidays(this.currentYear);
            
            let addedCount = 0;
            holidays.forEach(h => {
                // 檢查是否已存在 (同日期且同名)
                const exists = this.allHolidays.some(exist => 
                    exist.date === h.date && exist.name === h.name
                );
                
                if (!exists) {
                    this.allHolidays.push({
                        id: 'h_auto_' + Date.now() + Math.random().toString(36).substr(2, 5),
                        ...h,
                        type: 'national',
                        applicableYear: this.currentYear.toString()
                    });
                    addedCount++;
                }
            });

            if (addedCount > 0) {
                await SettingsService.saveHolidays(this.allHolidays);
                this.renderTable();
                Notification.success(`成功匯入 ${addedCount} 個假日`);
            } else {
                Notification.info('沒有需要新增的假日');
            }
        } catch (error) {
            Notification.error('匯入失敗: ' + error.message);
        } finally {
            Loading.hide();
        }
    },

    // 內建台灣國定假日資料
    generateTaiwanHolidays(year) {
        // 這裡可以根據年份返回對應的假日
        // 簡單範例，實際專案可能需要更完整的清單或 API
        const commonHolidays = [
            { date: `${year}-01-01`, name: '元旦' },
            { date: `${year}-02-28`, name: '和平紀念日' },
            { date: `${year}-04-04`, name: '兒童節' },
            { date: `${year}-04-05`, name: '清明節' },
            { date: `${year}-05-01`, name: '勞動節' },
            { date: `${year}-10-10`, name: '國慶日' }
        ];

        // 農曆假日需要演算法計算，這裡暫時寫死 2025 的範例
        if (year === 2025) {
            return [
                ...commonHolidays,
                { date: '2025-01-25', name: '春節連假' },
                { date: '2025-01-26', name: '春節連假' },
                { date: '2025-01-27', name: '春節連假' },
                { date: '2025-01-28', name: '除夕' },
                { date: '2025-01-29', name: '春節' },
                { date: '2025-01-30', name: '春節' },
                { date: '2025-01-31', name: '春節' },
                { date: '2025-02-01', name: '春節連假' },
                { date: '2025-02-02', name: '春節連假' },
                { date: '2025-05-31', name: '端午節' },
                { date: '2025-10-06', name: '中秋節' }
            ];
        }

        return commonHolidays;
    }
};
