/**
 * AI 排班模組 (簡易版 - Week 4)
 * Week 6 將實作完整的 AI 排班引擎
 */

const AISchedule = {
    schedule: null,
    staffList: [],
    shifts: [],
    
    /**
     * 開啟 AI 排班面板
     */
    async open(schedule, staffList, shifts) {
        this.schedule = schedule;
        this.staffList = staffList;
        this.shifts = shifts;
        
        const content = `
            <div style="display: flex; flex-direction: column; gap: 20px; padding: 20px 0;">
                <div class="alert alert-info">
                    <div class="alert-icon">🤖</div>
                    <div class="alert-content">
                        <div class="alert-title">AI 自動排班 (簡易版)</div>
                        此版本使用基本演算法進行排班。Week 6 將提供完整的智能排班功能，包含：
                        <ul style="margin: 8px 0 0 20px; line-height: 1.8;">
                            <li>預班需求整合</li>
                            <li>包班規則</li>
                            <li>接班順序</li>
                            <li>組別配置平衡</li>
                            <li>勞基法檢查</li>
                            <li>多種排班策略</li>
                        </ul>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <h4 style="margin: 0;">排班設定</h4>
                    </div>
                    <div class="card-body" style="display: flex; flex-direction: column; gap: 16px;">
                        <div class="form-group">
                            <label class="form-label">排班策略</label>
                            <select id="ai-strategy" class="form-select">
                                <option value="balanced">平衡分配 - 盡量讓每人工作天數相近</option>
                                <option value="rotation">輪班制 - 大→小→白循環</option>
                                <option value="random">隨機分配 - 快速生成排班</option>
                            </select>
                        </div>
                        
                        <div class="form-group">
                            <label style="display: flex; align-items: center; gap: 8px;">
                                <input type="checkbox" id="ai-clear-existing" checked>
                                <span>清除現有排班後重新排</span>
                            </label>
                        </div>
                        
                        <div class="form-group">
                            <label style="display: flex; align-items: center; gap: 8px;">
                                <input type="checkbox" id="ai-weekend-off">
                                <span>週末優先安排休假</span>
                            </label>
                        </div>
                    </div>
                </div>
                
                <div class="card">
                    <div class="card-header">
                        <h4 style="margin: 0;">每日人力需求</h4>
                    </div>
                    <div class="card-body">
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;">
                            <div class="form-group" style="margin: 0;">
                                <label class="form-label">大夜</label>
                                <input type="number" id="ai-need-night-major" class="form-input" value="3" min="0">
                            </div>
                            <div class="form-group" style="margin: 0;">
                                <label class="form-label">小夜</label>
                                <input type="number" id="ai-need-night-minor" class="form-input" value="2" min="0">
                            </div>
                            <div class="form-group" style="margin: 0;">
                                <label class="form-label">白班</label>
                                <input type="number" id="ai-need-day" class="form-input" value="2" min="0">
                            </div>
                            <div class="form-group" style="margin: 0;">
                                <label class="form-label">DL</label>
                                <input type="number" id="ai-need-dl" class="form-input" value="1" min="0">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        Modal.show({
            title: '🤖 AI 自動排班',
            content,
            size: 'medium',
            buttons: [
                {
                    text: '取消',
                    className: 'btn-secondary'
                },
                {
                    text: '開始排班',
                    className: 'btn-primary',
                    onClick: () => {
                        this.startScheduling();
                        return false;
                    },
                    keepOpen: true
                }
            ]
        });
    },
    
    /**
     * 開始排班
     */
    async startScheduling() {
        const strategy = document.getElementById('ai-strategy').value;
        const clearExisting = document.getElementById('ai-clear-existing').checked;
        const weekendOff = document.getElementById('ai-weekend-off').checked;
        
        const requirements = {
            '大': parseInt(document.getElementById('ai-need-night-major').value) || 0,
            '小': parseInt(document.getElementById('ai-need-night-minor').value) || 0,
            '白': parseInt(document.getElementById('ai-need-day').value) || 0,
            'DL': parseInt(document.getElementById('ai-need-dl').value) || 0
        };
        
        const confirmed = await Modal.confirm(
            `確定要使用 AI 自動排班嗎？\n\n策略: ${this.getStrategyName(strategy)}\n${clearExisting ? '⚠️ 將清除現有排班' : '保留現有排班'}`,
            { confirmText: '開始排班' }
        );
        
        if (!confirmed) return;
        
        try {
            // 關閉設定面板
            Modal.close();
            
            const loadingModal = Modal.loading('AI 排班中，請稍候...');
            
            // 清除現有排班
            if (clearExisting) {
                this.schedule.clearAll();
            }
            
            // 執行排班
            await this.executeScheduling(strategy, requirements, weekendOff);
            
            loadingModal.updateMessage('排班完成，正在儲存...');
            await Utils.sleep(500);
            
            await ScheduleManagement.saveSchedule();
            await ScheduleManagement.refresh();
            
            loadingModal.close();
            
            await this.showResult();
            
        } catch (error) {
            Modal.close();
            Notification.error('AI 排班失敗: ' + error.message);
        }
    },
    
    /**
     * 執行排班演算法
     */
    async executeScheduling(strategy, requirements, weekendOff) {
        const dates = this.schedule.getAllDates();
        
        switch (strategy) {
            case 'balanced':
                await this.balancedScheduling(dates, requirements, weekendOff);
                break;
            case 'rotation':
                await this.rotationScheduling(dates, requirements, weekendOff);
                break;
            case 'random':
                await this.randomScheduling(dates, requirements, weekendOff);
                break;
        }
    },
    
    /**
     * 平衡分配排班
     */
    async balancedScheduling(dates, requirements, weekendOff) {
        const shiftTypes = ['大', '小', '白', 'DL'];
        const workDayCounts = {};
        
        // 初始化工作天數計數
        this.staffList.forEach(staff => {
            workDayCounts[staff.id] = 0;
        });
        
        dates.forEach(date => {
            const d = new Date(date);
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            
            // 週末優先休假
            if (weekendOff && isWeekend) {
                const offStaff = [...this.staffList]
                    .sort((a, b) => (workDayCounts[b.id] || 0) - (workDayCounts[a.id] || 0))
                    .slice(0, Math.floor(this.staffList.length / 2));
                
                offStaff.forEach(staff => {
                    this.schedule.setShift(staff.id, date, 'FF');
                });
            }
            
            // 為每個班別分配人員
            shiftTypes.forEach(shiftCode => {
                const need = requirements[shiftCode] || 0;
                if (need === 0) return;
                
                // 選擇工作天數最少的人員
                const availableStaff = this.staffList
                    .filter(staff => !this.schedule.getShift(staff.id, date))
                    .sort((a, b) => (workDayCounts[a.id] || 0) - (workDayCounts[b.id] || 0))
                    .slice(0, need);
                
                availableStaff.forEach(staff => {
                    this.schedule.setShift(staff.id, date, shiftCode);
                    workDayCounts[staff.id]++;
                });
            });
            
            // 其他人安排休假
            this.staffList.forEach(staff => {
                if (!this.schedule.getShift(staff.id, date)) {
                    this.schedule.setShift(staff.id, date, 'FF');
                }
            });
        });
    },
    
    /**
     * 輪班制排班
     */
    async rotationScheduling(dates, requirements, weekendOff) {
        const pattern = ['大', '大', '小', '小', '白', '白', 'FF'];
        
        this.staffList.forEach((staff, staffIndex) => {
            dates.forEach((date, dateIndex) => {
                const patternIndex = (dateIndex + staffIndex * 2) % pattern.length;
                this.schedule.setShift(staff.id, date, pattern[patternIndex]);
            });
        });
    },
    
    /**
     * 隨機分配排班
     */
    async randomScheduling(dates, requirements, weekendOff) {
        const shiftTypes = ['大', '小', '白', 'DL', 'FF', 'FF']; // FF 權重較高
        
        dates.forEach(date => {
            this.staffList.forEach(staff => {
                const randomShift = shiftTypes[Math.floor(Math.random() * shiftTypes.length)];
                this.schedule.setShift(staff.id, date, randomShift);
            });
        });
    },
    
    /**
     * 顯示排班結果
     */
    async showResult() {
        const dates = this.schedule.getAllDates();
        let totalAssigned = 0;
        
        dates.forEach(date => {
            this.staffList.forEach(staff => {
                if (this.schedule.getShift(staff.id, date)) {
                    totalAssigned++;
                }
            });
        });
        
        const content = `
            <div style="text-align: center; padding: 20px 0;">
                <div style="font-size: 48px; margin-bottom: 16px;">✅</div>
                <h3 style="font-size: 20px; font-weight: 600; margin: 0 0 8px 0;">AI 排班完成！</h3>
                <p style="color: #666; margin: 0 0 20px 0;">已為 ${this.staffList.length} 位員工安排 ${dates.length} 天的班表</p>
                
                <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; text-align: left;">
                        <div>
                            <div style="color: #666; font-size: 13px;">總排班數</div>
                            <div style="font-size: 20px; font-weight: 600;">${totalAssigned}</div>
                        </div>
                        <div>
                            <div style="color: #666; font-size: 13px;">完成度</div>
                            <div style="font-size: 20px; font-weight: 600;">100%</div>
                        </div>
                    </div>
                </div>
                
                <p style="color: #666; font-size: 14px; margin: 0;">
                    請檢查排班結果，如有需要可使用「手動排班」進行調整。
                </p>
            </div>
        `;
        
        await Modal.alert(content, 'AI 排班完成');
    },
    
    /**
     * 取得策略名稱
     */
    getStrategyName(strategy) {
        const names = {
            'balanced': '平衡分配',
            'rotation': '輪班制',
            'random': '隨機分配'
        };
        return names[strategy] || strategy;
    }
};

if (typeof window !== 'undefined') {
    window.AISchedule = AISchedule;
}