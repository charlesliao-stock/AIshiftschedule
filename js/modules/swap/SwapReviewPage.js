import { SwapService } from "../../services/firebase/SwapService.js";
import { authService } from "../../services/firebase/AuthService.js";
import { SwapReviewTemplate } from "./templates/SwapReviewTemplate.js"; 

export class SwapReviewPage {
    constructor() {
        this.currentUser = null;
    }

    async render() {
        this.currentUser = authService.getProfile();
        const role = this.currentUser?.role;
        const isManager = ['unit_manager', 'unit_scheduler', 'system_admin'].includes(role);
        return SwapReviewTemplate.renderLayout(isManager);
    }

    async afterRender() {
        window.routerPage = this;
        let retries = 0;
        while (!authService.getProfile() && retries < 10) { await new Promise(r => setTimeout(r, 200)); retries++; }
        
        this.currentUser = authService.getProfile();
        if (!this.currentUser) return;

        const role = this.currentUser.role;
        const isManager = ['unit_manager', 'unit_scheduler', 'system_admin'].includes(role);

        document.getElementById('btn-refresh').addEventListener('click', () => {
            this.loadTargetReviews();
            if(isManager) this.loadManagerReviews();
        });

        this.loadTargetReviews();
        if(isManager) this.loadManagerReviews();
    }

    async loadTargetReviews() {
        const list = await SwapService.getPendingRequestsByTarget(this.currentUser.uid);
        const tbody = document.getElementById('target-review-tbody');
        const badge = document.getElementById('badge-target-count');
        
        if(list.length > 0) {
            badge.textContent = list.length;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
        
        tbody.innerHTML = SwapReviewTemplate.renderTargetRows(list);
    }

    async loadManagerReviews() {
        // 使用當前身分 (含模擬) 的 unitId 載入
        const list = await SwapService.getManagerPendingRequests(this.currentUser.unitId);
        const badge = document.getElementById('badge-manager-count');
        if(list.length > 0) {
            badge.textContent = list.length;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
        document.getElementById('manager-review-tbody').innerHTML = SwapReviewTemplate.renderManagerRows(list);
    }

    async handleTargetReview(id, action) {
        if(!confirm(action==='agree'?'同意換班？':'拒絕？')) return;
        await SwapService.reviewByTarget(id, action);
        this.loadTargetReviews();
    }

    async handleManagerReview(id, action) {
        if(!confirm(action==='approve'?'核准並修改班表？':'駁回？')) return;
        
        const list = await SwapService.getManagerPendingRequests(this.currentUser.unitId);
        const req = list.find(r => r.id === id);
        if(req) {
            await SwapService.reviewByManager(id, action, this.currentUser.uid, req);
            this.loadManagerReviews();
        }
    }
}
