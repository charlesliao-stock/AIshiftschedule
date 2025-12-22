import { ScheduleService } from "../../services/firebase/ScheduleService.js";
import { authService } from "../../services/firebase/AuthService.js";
import { StatisticsService } from "../../services/firebase/StatisticsService.js"; // 修正引用
import { PersonalStatsTemplate } from "./templates/PersonalStatsTemplate.js"; // 引入 Template

export class PersonalStatsPage {
    constructor() {
        const today = new Date();
        this.year = today.getFullYear();
        this.month = today.getMonth() + 1;
        this.currentUser = null;
    }

    async render() {
        // 直接渲染版面，移除管理員模擬區塊
        return PersonalStatsTemplate.renderLayout(this.year, this.month);
    }

    async afterRender() {
        let retries = 0;
        while (!authService.getProfile() && retries < 10) { await new Promise(r => setTimeout(r, 200)); retries++; }
        this.currentUser = authService.getProfile();

        if (!this.currentUser) return;

        // 綁定查詢事件
        document.getElementById('btn-query').addEventListener('click', () => {
            const val = document.getElementById('stats-month').value;
            if(val) {
                const [y, m] = val.split('-');
                this.year = parseInt(y);
                this.month = parseInt(m);
                this.loadStats();
            }
        });

        // 初始載入
        this.loadStats();
    }

    async loadStats() {
        const container = document.getElementById('stats-content');
        container.innerHTML = '<div class="spinner-border text-primary"></div>';

        try {
            const unitId = this.currentUser.unitId;
            if(!unitId) {
                container.innerHTML = '無單位資料';
                return;
            }

            const schedule = await ScheduleService.getSchedule(unitId, this.year, this.month);
            const stats = StatisticsService.calculatePersonal(schedule, this.currentUser.uid);
            
            container.innerHTML = PersonalStatsTemplate.renderContent(stats);

        } catch(e) {
            console.error(e);
            container.innerHTML = '<div class="text-danger">載入失敗</div>';
        }
    }
}
