/**
 * js/modules/schedule/ai-schedule.js
 * AI 排班模組 (ES Module 版 - 簡易介面)
 */

import { Notification } from '../../components/notification.js';
import { Modal } from '../../components/modal.js';

export const AISchedule = {
    open(schedule, staffList, shifts) {
        Modal.show({
            title: '🤖 AI 自動排班',
            content: `
                <div class="text-center p-4">
                    <div class="mb-3">🚧</div>
                    <h5>功能開發中</h5>
                    <p class="text-muted">Week 6 將實作完整的 AI 排班引擎，敬請期待。</p>
                </div>
            `,
            buttons: [{ text: '關閉', className: 'btn-secondary', onClick: () => Modal.close() }]
        });
    }
};
