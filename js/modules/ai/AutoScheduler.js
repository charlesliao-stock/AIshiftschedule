import { RuleEngine } from "./RuleEngine.js";

const MAX_RUNTIME = 60000;

export class AutoScheduler {

    /**
     * 主程式入口
     * 依照「完整排班系統流程（最終整理版）」執行
     */
    static async run(currentSchedule, staffList, unitSettings, preScheduleData, strategyCode = 'A') {
        console.log(`🚀 AI 排班啟動 (v2.1 修復版): 策略 ${strategyCode}`);
        const startTime = Date.now();

        try {
            // 初始化 Context (包含所有排班所需狀態)
            const context = this.prepareContext(currentSchedule, staffList, unitSettings, preScheduleData);

            // 🎯 子步驟 1：準備工作 (計算配額)
            this.step1_Preparation(context);

            // 🔄 逐日排班循環
            for (let day = 1; day <= context.daysInMonth; day++) {
                if (Date.now() - startTime > MAX_RUNTIME) {
                    context.logs.push("⚠️ 運算超時，提前結束");
                    break;
                }

                // ⏪ 子步驟 2B：回溯標記「前一天」的 OFF (Day 2 起執行)
                if (day > 1) {
                    this.step2B_RetroactiveOFF(context, day - 1);
                }

                // 🔄 子步驟 2A：排今天的班
                this.step2A_ScheduleToday(context, day);
            }

            // 🎯 子步驟 3：月底收尾 (處理最後一天的回溯與剩餘空白)
            if (context.daysInMonth > 0) {
                this.step2B_RetroactiveOFF(context, context.daysInMonth);
                this.step3_Finalize(context);
            }

            return {
                assignments: context.assignments,
                logs: context.logs
            };

        } catch (error) {
            console.error("AutoScheduler Error:", error);
            throw error;
        }
    }

    // =========================================================================
    // 🛠️ 初始化與準備
    // =========================================================================

    static prepareContext(schedule, staffList, unitSettings, preSchedule) {
        const assignments = {};
        const stats = {};
        const preferences = {}; // ✅ 修正：補回 preferences 初始化
        
        // 預設可用班別
        const allShifts = unitSettings.settings?.shifts?.map(s => s.code) || ['D', 'E', 'N'];

        staffList.forEach(staff => {
            const uid = staff.uid;
            assignments[uid] = {};
            stats[uid] = { 
                OFF: 0, 
                consecutive: 0, // 連續上班天數 (需由上個月延續，此處簡化為0)
                lastShift: null // 上個月最後一天班別
            };
            
            // 初始化計數
            allShifts.forEach(s => stats[uid][s] = 0);

            // ✅ 修正：載入員工偏好 (Preferences)
            // 確保即使沒有預班資料，也給予空物件避免 undefined
            const sub = preSchedule?.submissions?.[uid];
            preferences[uid] = sub?.preferences || {};
        });

        // 載入上個月資料 (若有)
        if (schedule.prevAssignments) {
            // TODO: 解析上個月最後幾天的班表以設定 stats[uid].consecutive 與 lastShift
        }

        return {
            year: schedule.year,
            month: schedule.month,
            daysInMonth: new Date(schedule.year, schedule.month, 0).getDate(),
            assignments,
            staffList,
            stats,
            preferences, // ✅ 修正：回傳 preferences
            wishes: preSchedule?.submissions || {}, 
            staffReq: unitSettings.staffRequirements || {}, 
            settings: unitSettings.settings || {},
            rules: unitSettings.rules || {},
            logs: [],
            // 計算用變數
            totalManDays: 0,
            totalReqDays: 0,
            avgLeaveTarget: 0,
            dailyLeaveQuotas: {}
        };
    }

    // =========================================================================
    // 🎯 子步驟 1：排班前的準備工作
    // =========================================================================
    static step1_Preparation(context) {
        const { staffList, staffReq, daysInMonth } = context;
        const staffCount = staffList.length;

        // 1. 統計「當月總可排班人次數」
        const totalManDays = staffCount * daysInMonth;

        // 2. 統計「當月總需求人次數」
        let totalReqDays = 0;
        const dailyReq = {}; // 每日總需求人數

        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(context.year, context.month - 1, d);
            const dayOfWeek = date.getDay(); // 0-6
            let daySum = 0;
            
            ['D', 'E', 'N'].forEach(shift => {
                daySum += (staffReq[shift]?.[dayOfWeek] || 0);
            });
            
            dailyReq[d] = daySum;
            totalReqDays += daySum;
        }

        // 3. 計算「總可休假名額」與「平均休假天數」
        const totalLeaveQuota = totalManDays - totalReqDays;
        // 向下取整
        context.avgLeaveTarget = Math.floor(totalLeaveQuota / (staffCount || 1));
        
        context.logs.push(`📊 統計: 人數 ${staffCount}, 總人次 ${totalManDays}, 總需求 ${totalReqDays}`);
        context.logs.push(`🎯 目標: 總休假名額 ${totalLeaveQuota}, 平均每人休 ${context.avgLeaveTarget} 天`);

        // 4. 計算每日休假配額 (硬限制)
        for (let d = 1; d <= daysInMonth; d++) {
            // 休假配額 = 總人數 - 當日需求
            context.dailyLeaveQuotas[d] = staffCount - dailyReq[d];
        }
    }

    // =========================================================================
    // 🔄 子步驟 2A：排今天的班
    // =========================================================================
    static step2A_ScheduleToday(context, day) {
        const { staffList, assignments } = context;
        const blankList = []; // 待填補清單 (步驟 5)

        // 隨機打亂處理順序，避免排序靠前的人總是優先選班
        const shuffledStaff = [...staffList].sort(() => Math.random() - 0.5);

        // ── 階段 1: 逐人處理 ──
        for (const staff of shuffledStaff) {
            const uid = staff.uid;

            // 步驟 1: 檢查預班 (Wishes)
            if (this.checkPreSchedule(context, staff, day)) {
                continue; // 已由預班鎖定，跳過
            }

            // 步驟 2: 產生白名單 (Whitelist)
            let whitelist = this.generateWhitelist(context, staff);

            // 步驟 3: 從白名單移除違規選項 (間隔、連七)
            whitelist = this.filterWhitelistRules(context, staff, day, whitelist);

            // 步驟 4: 嘗試延續前一天班別
            if (this.tryContinuePreviousShift(context, staff, day, whitelist)) {
                continue; // 成功延續，跳過
            }

            // 步驟 5: 無法決定，先留空
            // 記錄下來，稍後填補
            blankList.push({ staff, whitelist });
        }

        // ── 階段 2: 填補空白 (Sub-step 2A-2) ──
        this.fillBlanks(context, day, blankList);
    }

    // 檢查預班設定
    static checkPreSchedule(context, staff, day) {
        const wishes = context.wishes[staff.uid]?.wishes || {};
        const wish = wishes[day];

        if (!wish) return false; // 無預班

        if (wish === 'OFF' || wish === 'M_OFF') {
            this.assign(context, staff.uid, day, 'OFF');
            return true;
        }

        // 檢查指定班別是否合法 (11小時、連七)
        const prevShift = this.getShift(context, staff.uid, day - 1);
        
        // 簡單驗證 11 小時
        if (RuleEngine.checkShiftInterval(prevShift, wish, this.getShiftMap(context.settings), 660)) {
            this.assign(context, staff.uid, day, wish);
            return true;
        } else {
            context.logs.push(`⚠️ ${staff.name} Day ${day} 預班 ${wish} 違反間隔規則，忽略並重新排班`);
            return false; // 忽略預班，進入一般流程
        }
    }

    // 產生初始白名單
    static generateWhitelist(context, staff) {
        // 基礎清單
        let list = ['D', 'E', 'N', 'OFF'];
        const constraints = staff.constraints || {};
        
        // ✅ 修正：現在可以安全讀取 context.preferences
        const prefs = context.preferences[staff.uid] || {};

        // 2.2 身分限制 (孕/哺) -> 移除 N
        if (constraints.isPregnant || constraints.isPostpartum) {
            list = list.filter(s => s !== 'N');
        }

        // 2.3 包班設定 (Constraints)
        if (constraints.canBatch) {
            // 實務上應讀取 User.batchTarget，此處為擴充點
        }

        // 2.4 排班偏好過濾 (解決 "林珈琪" 問題)
        // 若有設定 P1/P2，則白名單只保留 P1/P2 + OFF
        const p1 = prefs.priority1;
        const p2 = prefs.priority2;
        
        if (p1 || p2) {
            const preferred = ['OFF'];
            if (p1 && list.includes(p1)) preferred.push(p1);
            if (p2 && list.includes(p2)) preferred.push(p2);
            // 覆蓋白名單
            list = preferred;
        }

        return list;
    }

    // 過濾違規選項
    static filterWhitelistRules(context, staff, day, whitelist) {
        const prevShift = this.getShift(context, staff.uid, day - 1);
        const shiftMap = this.getShiftMap(context.settings);
        const rules = context.rules;

        return whitelist.filter(shift => {
            if (shift === 'OFF') return true;

            // 3.1 間隔時間 < 11h -> 移除
            if (!RuleEngine.checkShiftInterval(prevShift, shift, shiftMap, 660)) {
                return false;
            }

            // 3.2 連續上班檢查 (略，需複雜計算)
            return true;
        });
    }

    // 嘗試延續前一天
    static tryContinuePreviousShift(context, staff, day, whitelist) {
        const prevShift = this.getShift(context, staff.uid, day - 1);
        
        // 若前一天是上班 (D/E/N)，且該班別在白名單中
        if (['D', 'E', 'N'].includes(prevShift) && whitelist.includes(prevShift)) {
            this.assign(context, staff.uid, day, prevShift);
            return true;
        }
        return false;
    }

    // 填補空白
    static fillBlanks(context, day, blankList) {
        const { staffReq } = context;
        const dayOfWeek = new Date(context.year, context.month - 1, day).getDay();

        // 計算目前各班缺額
        const currentCounts = { D: 0, E: 0, N: 0 };
        Object.values(context.assignments).forEach(shifts => {
            if (shifts[day] && currentCounts[shifts[day]] !== undefined) {
                currentCounts[shifts[day]]++;
            }
        });

        // 對每個待填補的人
        for (const item of blankList) {
            const { staff, whitelist } = item;
            
            // 選擇邏輯：優先填入「最缺人」且「在白名單內」的班別
            const deficits = ['D', 'E', 'N'].map(shift => ({
                shift, 
                deficit: (staffReq[shift]?.[dayOfWeek] || 0) - currentCounts[shift]
            }));
            
            // 排序：缺口大 -> 缺口小
            deficits.sort((a, b) => b.deficit - a.deficit);

            let assigned = 'OFF'; // 預設 OFF
            
            // 嘗試填入工作班
            for (const d of deficits) {
                if (whitelist.includes(d.shift)) {
                    assigned = d.shift;
                    break;
                }
            }

            this.assign(context, staff.uid, day, assigned);
            if (assigned !== 'OFF') currentCounts[assigned]++;
        }
    }


    // =========================================================================
    // ⏪ 子步驟 2B：回溯標記 OFF (解決休假不均)
    // =========================================================================
    static step2B_RetroactiveOFF(context, targetDay) {
        const { assignments, staffReq, dailyLeaveQuotas, stats } = context;
        const dayOfWeek = new Date(context.year, context.month - 1, targetDay).getDay();

        // 1. 找出超編的班別
        const currentCounts = { D: 0, E: 0, N: 0 };
        const staffByShift = { D: [], E: [], N: [] };

        Object.keys(assignments).forEach(uid => {
            const shift = assignments[uid][targetDay];
            if (['D', 'E', 'N'].includes(shift)) {
                currentCounts[shift]++;
                staffByShift[shift].push(uid);
            }
        });

        const overstaffedShifts = [];
        ['D', 'E', 'N'].forEach(shift => {
            const req = staffReq[shift]?.[dayOfWeek] || 0;
            if (currentCounts[shift] > req) {
                overstaffedShifts.push({ shift, count: currentCounts[shift] - req });
            }
        });

        if (overstaffedShifts.length === 0) return; // 無超編

        // 2. 對每個超編班別，找人放假
        for (const item of overstaffedShifts) {
            let { shift, count } = item;

            // 取得該班別的所有人員物件
            let candidates = staffByShift[shift].map(uid => context.staffList.find(s => s.uid === uid));

            // 排除鎖定者 (預班、包班)
            candidates = candidates.filter(s => !this.isLocked(context, s.uid, targetDay));

            // 3. 排序：依休假差額 (少休的人優先放)
            candidates.sort((a, b) => {
                const offA = stats[a.uid].OFF;
                const offB = stats[b.uid].OFF;
                return offA - offB; // OFF 少的排前面
            });

            // 4. 檢查配額與模式
            const maxOff = dailyLeaveQuotas[targetDay] || 0;
            let currentOffCount = Object.values(assignments).filter(sch => sch[targetDay] === 'OFF' || sch[targetDay] === 'M_OFF').length;

            const toRemove = [];

            for (const staff of candidates) {
                if (count <= 0) break;
                if (currentOffCount >= maxOff) break;

                // 排除「上1休1」模式
                const d2Shift = this.getShift(context, staff.uid, targetDay - 1);
                const d3Shift = this.getShift(context, staff.uid, targetDay - 2);
                
                const isWork2 = ['D','E','N'].includes(d2Shift);
                const isOff3 = d3Shift === 'OFF';

                if (isWork2 && isOff3) {
                    continue; // 跳過此人 (避免碎片化)
                }

                // ✅ 執行標記 OFF
                toRemove.push(staff.uid);
                count--;
                currentOffCount++;
            }

            // 寫入變更
            toRemove.forEach(uid => {
                this.assign(context, uid, targetDay, 'OFF');
                // 更新 stats (簡單 +1，實務上應更嚴謹)
                stats[uid].OFF++;
            });
        }
    }

    static step3_Finalize(context) {
        // 簡單填補剩餘空白
        const { daysInMonth, assignments, staffList } = context;
        staffList.forEach(staff => {
            for (let d = 1; d <= daysInMonth; d++) {
                if (!assignments[staff.uid][d]) {
                    this.assign(context, staff.uid, d, 'OFF');
                }
            }
        });
    }

    // =========================================================================
    // 🔧 輔助函式
    // =========================================================================

    static assign(context, uid, day, shift) {
        context.assignments[uid][day] = shift;
    }

    static getShift(context, uid, day) {
        if (day < 1) return 'OFF'; // 簡化：上月預設 OFF
        return context.assignments[uid]?.[day] || null;
    }

    static isLocked(context, uid, day) {
        const wish = context.wishes[uid]?.wishes?.[day];
        return !!wish;
    }

    static getShiftMap(settings) {
        const map = {};
        const shifts = settings.shifts || [];
        shifts.forEach(s => {
            const parse = (t) => {
                const [h, m] = t.split(':').map(Number);
                return h * 60 + m;
            };
            map[s.code] = { start: parse(s.startTime), end: parse(s.endTime) };
        });
        if (!map['D']) map['D'] = { start: 480, end: 960 };
        if (!map['E']) map['E'] = { start: 960, end: 1440 };
        if (!map['N']) map['N'] = { start: 0, end: 480 };
        return map;
    }
}
