/**
 * js/components/modal.js
 * 彈窗元件 (ES Module 版)
 */

import { Utils } from '../core/utils.js';
import { Notification } from './notification.js';

export const Modal = {
    currentModal: null,
    
    show(options = {}) {
        const {
            title = '標題',
            content = '',
            size = 'medium',
            closable = true,
            buttons = [],
            onClose = null
        } = options;
        
        this.close();
        
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        if (size === 'small') modal.style.maxWidth = '400px';
        if (size === 'large') modal.style.maxWidth = '800px';
        
        // Header
        const header = document.createElement('div');
        header.className = 'modal-header';
        
        const titleEl = document.createElement('h3');
        titleEl.className = 'modal-title';
        titleEl.textContent = title;
        header.appendChild(titleEl);
        
        if (closable) {
            const closeBtn = document.createElement('button');
            closeBtn.className = 'modal-close';
            closeBtn.innerHTML = '✕';
            closeBtn.onclick = () => {
                this.close();
                if (onClose) onClose();
            };
            header.appendChild(closeBtn);
        }
        modal.appendChild(header);
        
        // Body
        const body = document.createElement('div');
        body.className = 'modal-body';
        if (typeof content === 'string') body.innerHTML = content;
        else if (content instanceof HTMLElement) body.appendChild(content);
        modal.appendChild(body);
        
        // Footer
        if (buttons.length > 0) {
            const footer = document.createElement('div');
            footer.className = 'modal-footer';
            buttons.forEach(btn => {
                const button = document.createElement('button');
                button.className = `btn ${btn.className || 'btn-secondary'}`;
                button.textContent = btn.text;
                button.onclick = () => {
                    if (btn.onClick) {
                        const result = btn.onClick();
                        if (result !== false && !btn.keepOpen) this.close();
                    } else if (!btn.keepOpen) {
                        this.close();
                    }
                };
                footer.appendChild(button);
            });
            modal.appendChild(footer);
        }
        
        overlay.appendChild(modal);
        
        if (closable) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.close();
                    if (onClose) onClose();
                }
            });
        }
        
        document.body.appendChild(overlay);
        this.currentModal = overlay;
        document.body.style.overflow = 'hidden';
        
        return modal;
    },
    
    close() {
        if (this.currentModal && this.currentModal.parentNode) {
            this.currentModal.parentNode.removeChild(this.currentModal);
            this.currentModal = null;
        }
        document.body.style.overflow = '';
    },
    
    confirm(message, options = {}) {
        return new Promise((resolve) => {
            this.show({
                title: options.title || '確認',
                content: `<p>${message}</p>`,
                size: 'small',
                buttons: [
                    { text: '取消', onClick: () => resolve(false) },
                    { 
                        text: '確認', 
                        className: options.danger ? 'btn-error' : 'btn-primary', 
                        onClick: () => resolve(true) 
                    }
                ]
            });
        });
    },
    
    alert(message, title = '提示') {
        return new Promise((resolve) => {
            this.show({
                title,
                content: `<p>${message}</p>`,
                size: 'small',
                buttons: [{ text: '確定', className: 'btn-primary', onClick: () => resolve() }]
            });
        });
    }
};