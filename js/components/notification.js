/**
 * js/components/notification.js
 * Toast 通知元件 (ES Module 版)
 */

import { Utils } from '../core/utils.js';

export const Notification = {
    container: null,
    toasts: [],
    defaultDuration: 3000,
    maxToasts: 5,
    
    init() {
        this.container = document.getElementById('toast-container');
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        }
        console.log('[Notification] 初始化完成');
    },
    
    show(message, type = 'info', duration = null, options = {}) {
        if (!this.container) this.init();
        
        if (this.toasts.length >= this.maxToasts) {
            this.remove(this.toasts[0].id);
        }
        
        const toastId = Utils.generateId();
        const toast = this.createToast(toastId, message, type, options);
        
        this.container.appendChild(toast);
        this.toasts.push({ id: toastId, element: toast });
        
        const autoDuration = duration !== null ? duration : this.defaultDuration;
        if (autoDuration > 0) {
            setTimeout(() => this.remove(toastId), autoDuration);
        }
        
        return toastId;
    },
    
    createToast(id, message, type, options = {}) {
        const { title, closable = true } = options;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.setAttribute('data-toast-id', id);
        
        const icon = document.createElement('div');
        icon.className = 'toast-icon';
        icon.innerHTML = this.getIcon(type);
        toast.appendChild(icon);
        
        const content = document.createElement('div');
        content.className = 'toast-content';
        
        if (title) {
            const titleEl = document.createElement('div');
            titleEl.className = 'toast-title';
            titleEl.textContent = title;
            content.appendChild(titleEl);
        }
        
        const messageEl = document.createElement('div');
        messageEl.className = 'toast-message';
        messageEl.textContent = message;
        content.appendChild(messageEl);
        
        toast.appendChild(content);
        
        if (closable) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'toast-close';
            closeBtn.innerHTML = '✕';
            closeBtn.onclick = () => this.remove(id);
            toast.appendChild(closeBtn);
        }
        
        return toast;
    },
    
    getIcon(type) {
        const icons = { success: '✓', error: '✕', warning: '!', info: 'i' };
        return icons[type] || icons.info;
    },
    
    success(msg, duration = null) { return this.show(msg, 'success', duration); },
    error(msg, duration = 5000) { return this.show(msg, 'error', duration); },
    warning(msg, duration = null) { return this.show(msg, 'warning', duration); },
    info(msg, duration = null) { return this.show(msg, 'info', duration); },
    loading(msg = '載入中...') { return this.show(msg, 'info', 0, { closable: false }); },
    
    remove(id) {
        const index = this.toasts.findIndex(t => t.id === id);
        if (index === -1) return;
        
        const toast = this.toasts[index];
        toast.element.classList.add('toast-out');
        
        setTimeout(() => {
            if (toast.element.parentNode) toast.element.parentNode.removeChild(toast.element);
            this.toasts.splice(index, 1);
        }, 300);
    }
};