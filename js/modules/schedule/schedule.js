/**
 * js/modules/schedule/schedule.js (Firebase Core)
 */
import { UnitService } from '../../services/unit.service.js';
import { ScheduleService } from '../../services/schedule.service.js';
import { Auth } from '../../core/auth.js';
import { Notification } from '../../components/notification.js';
import { Utils } from '../../core/utils.js';
// import { ScheduleView } from './schedule-view.js'; // 暫時註解
import { ScheduleCheck } from './schedule-check.js';

export const ScheduleManagement = {
    state: {
        currentUnit: null,
        currentMonth: null,
        units: [],
        schedule: null,
        staffList: []
    },
    dom: {},

    async init() {
        console.log('[ScheduleMgmt] 初始化...');
        
        // 1. 綁定 DOM
        const container = document.getElementById('schedule-container');
        if (!container) {
            console.error('❌ 找不到 #schedule-container');
            return;
        }
        
        this.dom = {
            container,
            unitSelect: document.getElementById('select-unit'),
            monthPicker: document.getElementById('input-month'),
            btnSave: document.getElementById('btn-save-schedule'),
            btnBackup: document.getElementById('btn-backup-sheet'),
            btnCheck: document.getElementById('btn-check-rules')
        };

        // 2. 載入資料
        await this.loadDependencies();
        
        // 3. 綁定事件
        this.bindEvents();
        
        // 4. 預設載入
        if (this.state.units.length > 0) {
            const lastUnitId = localStorage.getItem('last_selected_unit');
            const targetUnit = this.state.units.find(u => u.id === lastUnitId) || this.state.units[0];
            
            this.state.currentUnit = targetUnit;
            this.state.currentMonth = Utils.formatDate(new Date(), 'YYYY-MM');
            
            if(this.dom.unitSelect) this.dom.unitSelect.value = targetUnit.id;
            if(this.dom.monthPicker) this.dom.monthPicker.value = this.state.currentMonth;
            
            await this.loadSchedule();
        } else {
             this.dom.container.innerHTML = '<div class="alert alert-warning">尚無單位資料，請先建立。</div>';
        }
    },

    async loadDependencies() {
        try {
            const user = Auth.getCurrentUser();
            let allUnits = await UnitService.getAllUnits();
            
            if (Auth.isManager() && !Auth.isAdmin()) {
                allUnits = allUnits.filter(u => u.id === user.unitId || u.managerIds?.includes(user.uid));
            }
            this.state.units = allUnits;
            
            if(this.dom.unitSelect) {
                this.dom.unitSelect.innerHTML = allUnits.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
            }
        } catch (e) {
            console.error(e);
            Notification.error('載入單位失敗');
        }
    },

    async loadSchedule() {
        const { id } = this.state.currentUnit;
        const month = this.state.currentMonth;
        
        this.dom.container.innerHTML = '<div class="text-center p-5">載入中...</div>';
        
        try {
            const [schedule, staff] = await Promise.all([
                ScheduleService.getSchedule(id, month),
                UnitService.getUnitStaff(id)
            ]);
            
            this.state.schedule = schedule;
            this.state.staffList = staff;
            
            this.renderView();
        } catch (e) {
            console.error(e);
            this.dom.container.innerHTML = `<div class="alert alert-danger">載入失敗: ${e.message}</div>`;
        }
    },

    renderView() {
        const count = this.state.staffList.length;
        const shifts = this.state.schedule.shifts || {};
        
        // 簡易渲染
        let html = `
            <div class="card"><div class="card-body">
            <h5>${this.state.currentUnit.name} - ${this.state.currentMonth} (人員: ${count})</h5>
            <table class="table table-bordered table-sm text-center">
                <thead><tr><th>姓名</th>${Array.from({length:31},(_,i)=>`<th>${i+1}</th>`).join('')}</tr></thead>
                <tbody>`;
        
        if(count === 0) html += `<tr><td colspan="32">無人員資料</td></tr>`;
        else {
            this.state.staffList.forEach(s => {
                const uShifts = shifts[s.id] || {};
                html += `<tr><td class="text-left">${s.displayName||s.name||s.email}</td>
                ${Array.from({length:31},(_,i)=> {
                    const d = String(i+1).padStart(2,'0');
                    return `<td>${uShifts[d]||''}</td>`;
                }).join('')}</tr>`;
            });
        }
        html += `</tbody></table></div></div>`;
        this.dom.container.innerHTML = html;
    },

    async handleSave() {
        try {
            await ScheduleService.saveSchedule(this.state.schedule);
            Notification.success('儲存成功');
        } catch (e) { Notification.error('儲存失敗'); }
    },
    
    async handleBackup() {
        if(!confirm('確認備份？')) return;
        const res = await ScheduleService.backupToSheets(this.state.schedule);
        res.success ? Notification.success(res.message) : Notification.warning(res.message);
    },

    bindEvents() {
        this.dom.unitSelect?.addEventListener('change', e => {
            this.state.currentUnit = this.state.units.find(u => u.id === e.target.value);
            localStorage.setItem('last_selected_unit', this.state.currentUnit.id);
            this.loadSchedule();
        });
        this.dom.monthPicker?.addEventListener('change', e => {
            this.state.currentMonth = e.target.value;
            this.loadSchedule();
        });
        this.dom.btnSave?.addEventListener('click', () => this.handleSave());
        this.dom.btnBackup?.addEventListener('click', () => this.handleBackup());
        this.dom.btnCheck?.addEventListener('click', () => {
             const res = ScheduleCheck.validateUserSchedule(this.state.schedule.shifts, this.state.currentUnit.rules);
             console.log(res); Notification.info('檢查完成');
        });
    }
};

export const init = () => ScheduleManagement.init();
