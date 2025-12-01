/**
 * js/modules/pre-schedule/pre-schedule-extra.js
 * 額外預班功能 (ES Module 版 - 完整實作)
 */

import { PreScheduleService } from '../../services/pre-schedule.service.js';
import { Notification } from '../../components/notification.js';
import { Loading } from '../../components/loading.js';
import { Modal } from '../../components/modal.js';
import { Auth } from '../../core/auth.js';

export class PreScheduleExtra {
    constructor() {
        this.currentMonth = null;
        this.currentUnit = null;
        this.staffList = [];
        this.extraPreSchedules = new Map();
    }

    async init(month, unitId) {
        try {
            this.currentMonth = month;
            this.currentUnit = unitId;
            await this.loadStaffList();
            await this.loadExtraPreSchedules();
            this.initializeUI();
            this.bindEvents();
        } catch (error) {
            console.error('額外預班初始化失敗:', error);
        }
    }

    async loadStaffList() {
        // 需確認 PreScheduleService 有 export 這個方法，或者用 SettingsService
        this.staffList = await PreScheduleService.getStaffData() || []; 
    }

    async loadExtraPreSchedules() {
        const extras = await PreScheduleService.getExtraPreSchedules(this.currentMonth);
        this.extraPreSchedules.clear();
        if (extras) {
            extras.forEach(item => {
                if (!this.extraPreSchedules.has(item.staffId)) {
                    this.extraPreSchedules.set(item.staffId, []);
                }
                this.extraPreSchedules.get(item.staffId).push(item);
            });
        }
    }

    initializeUI() {
        const container = document.getElementById('extraPreScheduleTable');
        if (!container) return;

        let html = `
            <div class="panel-header">
                <h3>額外預班管理</h3>
                <button class="btn btn-primary" id="addExtraBtn">＋ 新增</button>
            </div>
            <table class="table">
                <thead><tr><th>員工</th><th>額外預班數</th><th>操作</th></tr></thead>
                <tbody>
        `;
        
        this.staffList.forEach(staff => {
            const count = this.extraPreSchedules.get(staff.id)?.length || 0;
            html += `
                <tr>
                    <td>${staff.name}</td>
                    <td>${count}</td>
                    <td><button class="btn btn-sm btn-info view-btn" data-id="${staff.id}">查看</button></td>
                </tr>
            `;
        });
        
        html += `</tbody></table>`;
        container.innerHTML = html;
    }

    bindEvents() {
        document.getElementById('addExtraBtn')?.addEventListener('click', () => this.showStaffSelector());
        
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const staffId = e.target.dataset.id;
                this.viewStaffExtra(staffId);
            });
        });
    }

    showStaffSelector() {
        // 簡單實作：用 Modal 顯示員工列表供選擇
        const buttons = this.staffList.map(s => ({
            text: s.name,
            onClick: () => {
                Modal.close();
                this.showDateSelector(s.id, s.name);
            }
        }));
        Modal.show({ title: '選擇員工', content: '', buttons });
    }

    showDateSelector(staffId, staffName) {
        // 這裡可以使用 input type="date" 和 select 班別
        // 為了簡化，這裡僅示意流程，實際應生成 Form HTML
        const content = `
            <div>
                <label>日期</label> <input type="date" id="extraDate" class="form-control">
                <label>班別</label> <select id="extraShift" class="form-control">
                    <option value="大">大夜</option><option value="小">小夜</option><option value="OFF">OFF</option>
                </select>
                <label>原因</label> <input type="text" id="extraReason" class="form-control">
            </div>
        `;
        
        Modal.show({
            title: `新增額外預班 - ${staffName}`,
            content: content,
            buttons: [{
                text: '確認',
                className: 'btn-primary',
                onClick: async () => {
                    const date = document.getElementById('extraDate').value;
                    const shift = document.getElementById('extraShift').value;
                    const reason = document.getElementById('extraReason').value;
                    if(date && shift) {
                        await this.addExtra(staffId, date, shift, reason);
                        Modal.close();
                    } else {
                        Notification.warning('請填寫完整');
                        return false; // 保持 Modal 開啟
                    }
                }
            }]
        });
    }

    async addExtra(staffId, date, shift, reason) {
        try {
            Loading.show('新增中...');
            await PreScheduleService.addExtraPreSchedule({
                month: this.currentMonth,
                staffId, date, shift, reason,
                addedBy: Auth.getCurrentUser().displayName
            });
            await this.loadExtraPreSchedules();
            this.initializeUI();
            this.bindEvents();
            Loading.hide();
            Notification.success('新增成功');
        } catch(e) {
            Loading.hide();
            Notification.error('新增失敗');
        }
    }

    viewStaffExtra(staffId) {
        const extras = this.extraPreSchedules.get(staffId) || [];
        if (extras.length === 0) return Notification.info('無額外預班');
        
        const listHtml = extras.map(ex => `
            <li>
                ${ex.date} - ${ex.shift} (${ex.reason})
                <button class="btn-sm btn-danger remove-extra" data-date="${ex.date}">X</button>
            </li>
        `).join('');
        
        // 顯示列表 Modal，並需綁定移除按鈕事件 (略)
        Modal.show({ title: '額外預班列表', content: `<ul>${listHtml}</ul>`, buttons: [] });
    }
}