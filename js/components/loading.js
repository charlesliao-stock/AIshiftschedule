/**
 * js/components/loading.js
 * 載入動畫元件 (ES Module 版)
 */

export const Loading = {
    overlay: null,
    
    show(message = '載入中...') {
        this.hide();
        this.overlay = document.createElement('div');
        this.overlay.id = 'app-loader';
        this.overlay.className = 'loader-overlay';
        this.overlay.style.display = 'flex'; // 強制顯示
        this.overlay.innerHTML = `<div class="loader-spinner"></div><p>${message}</p>`;
        document.body.appendChild(this.overlay);
    },
    
    hide() {
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.parentNode.removeChild(this.overlay);
            this.overlay = null;
        }
    }
};