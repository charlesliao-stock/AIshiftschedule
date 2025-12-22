import { SwapService } from "../../services/firebase/SwapService.js";
import { authService } from "../../services/firebase/AuthService.js";
import { SwapApplyTemplate } from "./templates/SwapApplyTemplate.js";

export class SwapApplyPage {
    constructor() {
        this.currentUser = null;   
        this.targetUnitId = null;  
        this.pendingSwaps = [];    
        this.isImpersonating = false; 
    }

    async render() {
        return SwapApplyTemplate.renderLayout();
    }

    async afterRender() {
        let retries = 0;
        while (!authService.getProfile() && retries < 10) { await new Promise(r => setTimeout(r, 200)); retries++; }
        
        this.currentUser = authService.getProfile();
        if (!this.currentUser) {
            alert("請先登入");
            return;
        }

        this.targetUnitId = this.currentUser.unitId;
        this.isImpersonating = !!this.currentUser.isImpersonating;
        window.routerPage = this;

        document.getElementById('btn-add-swap').addEventListener('click', () => this.addToCart());
        document.getElementById('btn-submit-swap').addEventListener('click', () => this.submitAll());

        this.loadHistory();
    }

    async loadHistory() {
        const list = await SwapService.getMyAppliedRequests(this.currentUser.uid);
        document.getElementById('history-tbody').innerHTML = SwapApplyTemplate.renderHistoryRows(list);
    }

    addToCart() {
        const date = document.getElementById('swap-date').value;
        const shift = document.getElementById('swap-shift').value;
        const targetName = document.getElementById('swap-target').value.trim();
        const targetDate = document.getElementById('swap-target-date').value;
        const targetShift = document.getElementById('swap-target-shift').value;

        if (!date || !shift || !targetName || !targetDate || !targetShift) {
            alert("請填寫完整資訊");
            return;
        }

        // 模擬的 target 物件，實際專案應實作 userService 搜尋
        const mockTarget = { uid: 'unknown', name: targetName, shift: targetShift, dateStr: targetDate };

        this.pendingSwaps.push({ dateStr: date, shift: shift, target: mockTarget });
        this.renderCart();
        this.clearInputs();
    }

    clearInputs() {
        document.getElementById('swap-target').value = '';
        document.getElementById('swap-target-shift').value = '';
    }

    renderCart() {
        const tbody = document.getElementById('swap-cart-list');
        tbody.innerHTML = SwapApplyTemplate.renderCartItems(this.pendingSwaps);
        document.getElementById('btn-submit-swap').disabled = this.pendingSwaps.length === 0;
    }

    removeItem(idx) {
        this.pendingSwaps.splice(idx, 1);
        this.renderCart();
    }

    async submitAll() {
        if(this.pendingSwaps.length === 0) return;
        const finalReason = document.getElementById('swap-reason').value || '個人因素';
        
        let roleMsg = this.isImpersonating ? `⚠️ 注意：您正以 [${this.currentUser.name}] 的身分代為申請。` : '';
        if(!confirm(`確定送出 ${this.pendingSwaps.length} 筆申請？\n${roleMsg}`)) return;

        const btn = document.getElementById('btn-submit-swap');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> 處理中...';

        try {
            const promises = this.pendingSwaps.map(item => {
                return SwapService.createSwapRequest({
                    unitId: this.targetUnitId,
                    year: new Date().getFullYear(), 
                    month: new Date().getMonth() + 1,
                    requesterId: this.currentUser.uid,
                    requesterName: this.currentUser.name,
                    requesterDate: item.dateStr,
                    requesterShift: item.shift,
                    targetUserId: item.target.uid, 
                    targetUserName: item.target.name,
                    targetDate: item.target.dateStr,
                    targetShift: item.target.shift,
                    reason: finalReason,
                    createdByAdmin: this.isImpersonating ? this.currentUser.originalUid : null
                });
            });

            await Promise.all(promises);
            alert("✅ 申請已送出！");
            
            this.pendingSwaps = [];
            this.renderCart();
            this.loadHistory();
            
        } catch (e) { alert("失敗: " + e.message); }
        finally {
            btn.disabled = this.pendingSwaps.length === 0;
            btn.innerHTML = '<i class="fas fa-paper-plane me-1"></i> 提交申請';
        }
    }
}
