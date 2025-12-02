/**
 * js/modules/schedule/manual-schedule.js
 * 手動排班模組 (ES Module 版)
 */

import { Notification } from '../../components/notification.js';
import { Modal } from '../../components/modal.js';
import { Loading } from '../../components/loading.js';
import { Utils } from '../../core/utils.js';

export const ManualSchedule = {
    schedule: null, // Schedule 物件參考
    staffList: [],
    shifts: [],
    
    async open(schedule, staffList, shifts) {
        this.schedule = schedule;
        this.staffList = staffList;
        this.shifts = shifts;
        
        const content = `
            <div class="manual-schedule-panel p-3">
                <div class="mb-4">
                    <h5>批次設定班別</h5>
                    <div class="input-group mb-2">
                        <span class="input-group-text">範圍</span>
                        <input type="date" id="batch-start-date" class="form-control">
                        <input type="date" id="batch-end-date" class="form-control">
                    </div>
                    <div class="input-group mb-2">
                        <span class="input-group-text">班別</span>
                        <select id="batch-shift" class="form-select">
                            ${this.shifts.map(s => `<option value="${s.code}">${s.name}</option>`).join('')}
                        </select>
                        <button class="btn btn-primary" id="batch-set-btn">執行</button>
                    </div>
                </div>
            </div>
        `;
        
        Modal.show({
            title: '手動排班工具',
            content,
            buttons: [{ text: '關閉', className: 'btn-secondary', onClick: () => Modal.close() }]
        });
        
        this.bindEvents();
    },

    bindEvents() {
        document.getElementById('batch-set-btn')?.addEventListener('click', () => this.batchSetShift());
    },

    async batchSetShift() {
        const startDate = document.getElementById('batch-start-date').value;
        const endDate = document.getElementById('batch-end-date').value;
        const shift = document.getElementById('batch-shift').value;
        
        if (!startDate || !endDate) return Notification.warning('請選擇日期');
        
        try {
            Loading.show('處理中...');
            // 這裡假設 schedule 物件有 setShift 方法
            // 實際需與 Schedule 主模組整合
            Notification.success('批次設定成功 (模擬)');
        } catch(e) {
            Notification.error('失敗');
        } finally {
            Loading.hide();
        }
    }
};
