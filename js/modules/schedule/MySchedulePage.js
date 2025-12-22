import { ScheduleService } from "../../services/firebase/ScheduleService.js";
import { authService } from "../../services/firebase/AuthService.js";
import { MyScheduleTemplate } from "./templates/MyScheduleTemplate.js"; 

export class MySchedulePage {
    constructor() {
        this.year = new Date().getFullYear();
        this.month = new Date().getMonth() + 1;
        this.currentUser = null;
    }

    async render() {
        // 直接渲染版面，移除管理員模擬區塊
        return MyScheduleTemplate.renderLayout(this.year, this.month);
    }

    async afterRender() {
        let retries = 0;
        while (!authService.getProfile() && retries < 10) { await new Promise(r => setTimeout(r, 200)); retries++; }
        this.currentUser = authService.getProfile();
        
        if (!this.currentUser) {
            alert("請先登入");
            return;
        }

        document.getElementById('btn-query').addEventListener('click', () => this.loadSchedule());
        await this.loadSchedule();
    }

    async loadSchedule() {
        let val = document.getElementById('my-month')?.value;
        if(!val) val = `${this.year}-${String(this.month).padStart(2,'0')}`;
        else {
            const [y, m] = val.split('-');
            this.year = parseInt(y);
            this.month = parseInt(m);
        }

        const daysInMonth = new Date(this.year, this.month, 0).getDate();
        
        document.getElementById('table-head-date').innerHTML = MyScheduleTemplate.renderHeadDate(this.year, this.month, daysInMonth);
        document.getElementById('table-head-week').innerHTML = MyScheduleTemplate.renderHeadWeek(this.year, this.month, daysInMonth);

        const unitId = this.currentUser?.unitId;
        if(!unitId) {
            document.getElementById('table-body-shift').innerHTML = `<td colspan="${daysInMonth}" class="p-5 text-center text-muted">此帳號未綁定單位</td>`;
            return;
        }

        const schedule = await ScheduleService.getSchedule(unitId, this.year, this.month);
        const rowHtml = MyScheduleTemplate.renderBodyRow(schedule, this.currentUser.uid, daysInMonth);
        document.getElementById('table-body-shift').innerHTML = rowHtml;
    }
}
