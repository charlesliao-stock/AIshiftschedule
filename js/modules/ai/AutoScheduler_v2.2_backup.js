import { RuleEngine } from "./RuleEngine.js";

const MAX_RUNTIME = 60000;

export class AutoScheduler {

    static async run(currentSchedule, staffList, unitSettings, preScheduleData, strategyCode = 'A') {
        console.log(`🚀 AI 排班啟動 (v2.2 平衡修正版): 策略 ${strategyCode}`);
        const startTime = Date.now();

        try {
            const context = this.prepareContext(currentSchedule, staffList, unitSettings, preScheduleData);

            // 🎯 子步驟 1：準備工作
            this.step1_Preparation(context);

            // 🔄 逐日排班
            for (let day = 1; day <= context.daysInMonth; day++) {
                if (Date.now() - startTime > MAX_RUNTIME) {
                    context.logs.push("⚠️ 運算超時，提前結束");
                    break;
                }

                if (day > 1) {
                    this.step2B_RetroactiveOFF(context, day - 1);
                }

                this.step2A_ScheduleToday(context, day);
            }

            // 🎯 子步驟 3：月底收尾與最終平衡
            if (context.daysInMonth > 0) {
                this.step2B_RetroactiveOFF(context, context.daysInMonth);
                this.step3_Finalize(context);
                // 新增：全月總平衡 (解決 OFF 差異過大)
                this.globalBalance(context);
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
    // 🛠️ 初始化
    // =========================================================================

    static prepareContext(schedule, staffList, unitSettings, preSchedule) {
        const assignments = {};
        const stats = {};
        const preferences = {}; 
        
        const allShifts = unitSettings.settings?.shifts?.map(s => s.code) || ['D', 'E', 'N'];

        staffList.forEach(staff => {
            const uid = staff.uid;
            assignments[uid] = {};
            stats[uid] = { 
                OFF: 0, 
                consecutive: 0, // 當前連續上班天數 (動態計算)
                lastShift: null 
            };
            
            allShifts.forEach(s => stats[uid][s] = 0);

            // 載入偏好
            const sub = preSchedule?.submissions?.[uid];
            preferences[uid] = sub?.preferences || {};
        });

        // 若有上個月資料，需初始化 consecutive (這裡簡化處理，實務應讀取 prevAssignments 最後幾天)
        // 假設上個月最後一天是上班，consecutive 設為 1 (避免第一天就斷掉)
        
        return {
            year: schedule.year,
            month: schedule.month,
            daysInMonth: new Date(schedule.year, schedule.month, 0).getDate(),
            assignments,
            staffList,
            stats,
            preferences, 
            wishes: preSchedule?.submissions || {}, 
            staffReq: unitSettings.staffRequirements || {}, 
            settings: unitSettings.settings || {},
            rules: unitSettings.rules || {},
            logs: [],
            totalManDays: 0,
            avgLeaveTarget: 0,
            dailyLeaveQuotas: {}
        };
    }

    // =========================================================================
    // 🎯 Step 1: 準備
    // =========================================================================
    static step1_Preparation(context) {
        const { staffList, staffReq, daysInMonth } = context;
        const staffCount = staffList.length;
        const totalManDays = staffCount * daysInMonth;
        let totalReqDays = 0;
        const dailyReq = {}; 

        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(context.year, context.month - 1, d);
            const dayOfWeek = date.getDay();
            let daySum = 0;
            ['D', 'E', 'N'].forEach(shift => {
                daySum += (staffReq[shift]?.[dayOfWeek] || 0);
            });
            dailyReq[d] = daySum;
            totalReqDays += daySum;
        }

        const totalLeaveQuota = totalManDays - totalReqDays;
        context.avgLeaveTarget = Math.floor(totalLeaveQuota / (staffCount || 1));
        
        // 每日休假配額
        for (let d = 1; d <= daysInMonth; d++) {
            context.dailyLeaveQuotas[d] = staffCount - dailyReq[d];
        }
    }

    // =========================================================================
    // 🔄 Step 2A: 排今天的班
    // =========================================================================
    static step2A_ScheduleToday(context, day) {
        const { staffList } = context;
        const blankList = []; 

        // ✅ 修正 1: 基於負載排序 (Workload Sorting)
        // OFF 越多 (欠班) 的人排前面 -> 優先被抓去填補人力
        // OFF 越少 (過勞) 的人排後面 -> 容易輪空變成 OFF
        const sortedStaff = [...staffList].sort((a, b) => {
            const offA = context.stats[a.uid].OFF;
            const offB = context.stats[b.uid].OFF;
            // 比率: 目前休假 / 已過天數 (避免月初基數小)
            const rateA = offA / Math.max(1, day - 1);
            const rateB = offB / Math.max(1, day - 1);
            return rateB - rateA; // 大到小 (OFF 多的先處理 -> 容易被 assign 工作)
        });

        // ── 階段 1: 逐人處理 ──
        for (const staff of sortedStaff) {
            // 步驟 1: 檢查預班
            if (this.checkPreSchedule(context, staff, day)) continue;

            // 步驟 2: 產生白名單
            let whitelist = this.generateWhitelist(context, staff);

            // 步驟 3: 從白名單移除違規選項 (包含連六休一)
            whitelist = this.filterWhitelistRules(context, staff, day, whitelist);

            // 步驟 4: 嘗試延續前一天 (D->D, E->E)
            if (this.tryContinuePreviousShift(context, staff, day, whitelist)) continue;

            // 步驟 5: 留空待填補
            blankList.push({ staff, whitelist });
        }

        // ── 階段 2: 填補空白 ──
        this.fillBlanks(context, day, blankList);
    }

    // 檢查預班
    static checkPreSchedule(context, staff, day) {
        const wishes = context.wishes[staff.uid]?.wishes || {};
        const wish = wishes[day];

        if (!wish) return false; 

        if (wish === 'OFF' || wish === 'M_OFF') {
            this.assign(context, staff.uid, day, 'OFF');
            return true;
        }

        // 檢查間隔 (若違反則忽略預班)
        const prevShift = this.getShift(context, staff.uid, day - 1);
        if (RuleEngine.checkShiftInterval(prevShift, wish, this.getShiftMap(context.settings), 660)) {
            this.assign(context, staff.uid, day, wish);
            return true;
        } else {
            return false; 
        }
    }

    // 產生白名單
    static generateWhitelist(context, staff) {
        let list = ['D', 'E', 'N', 'OFF'];
        const constraints = staff.constraints || {};
        const prefs = context.preferences[staff.uid] || {};

        // 孕哺限制
        if (constraints.isPregnant || constraints.isPostpartum) {
            list = list.filter(s => s !== 'N');
        }

        // 偏好過濾 (解決 "林珈琪" 不排 E 的問題)
        const p1 = prefs.priority1;
        const p2 = prefs.priority2;
        if (p1 || p2) {
            const preferred = ['OFF'];
            if (p1 && list.includes(p1)) preferred.push(p1);
            if (p2 && list.includes(p2)) preferred.push(p2);
            list = preferred;
        }

        return list;
    }

    // 過濾違規 (✅ 修正 2: 強制連六休一)
    static filterWhitelistRules(context, staff, day, whitelist) {
        const prevShift = this.getShift(context, staff.uid, day - 1);
        const shiftMap = this.getShiftMap(context.settings);
        const currentConsecutive = context.stats[staff.uid].consecutive;
        
        // 讀取單位設定的上限，預設 6
        const maxCons = staff.constraints?.maxConsecutive || context.rules.maxWorkDays || 6;

        // 如果已經連續上班達到上限 -> 強制只留 OFF
        if (currentConsecutive >= maxCons) {
            return ['OFF']; 
        }

        return whitelist.filter(shift => {
            if (shift === 'OFF') return true;

            // 間隔檢查
            if (!RuleEngine.checkShiftInterval(prevShift, shift, shiftMap, 660)) {
                return false;
            }
            return true;
        });
    }

    static tryContinuePreviousShift(context, staff, day, whitelist) {
        const prevShift = this.getShift(context, staff.uid, day - 1);
        // 若前一天是上班且在白名單內 -> 延續
        if (['D', 'E', 'N'].includes(prevShift) && whitelist.includes(prevShift)) {
            this.assign(context, staff.uid, day, prevShift);
            return true;
        }
        return false;
    }

    static fillBlanks(context, day, blankList) {
        const { staffReq } = context;
        const dayOfWeek = new Date(context.year, context.month - 1, day).getDay();

        // 目前缺額
        const currentCounts = { D: 0, E: 0, N: 0 };
        Object.values(context.assignments).forEach(shifts => {
            if (shifts[day] && currentCounts[shifts[day]] !== undefined) {
                currentCounts[shifts[day]]++;
            }
        });

        // ✅ 修正 3: blankList 排序
        // 這時候剩下的都是還沒排班的人。
        // 我們要讓「休假最多 (欠班)」的人優先選班，「休假最少」的人最後選(可能沒缺額就變 OFF)
        blankList.sort((a, b) => {
            const offA = context.stats[a.staff.uid].OFF;
            const offB = context.stats[b.staff.uid].OFF;
            return offB - offA; // OFF 多的排前面
        });

        for (const item of blankList) {
            const { staff, whitelist } = item;
            
            // 計算當下最缺的班
            const deficits = ['D', 'E', 'N'].map(shift => ({
                shift, 
                deficit: (staffReq[shift]?.[dayOfWeek] || 0) - currentCounts[shift]
            }));
            deficits.sort((a, b) => b.deficit - a.deficit); // 缺口大的優先

            let assigned = 'OFF'; 
            
            for (const d of deficits) {
                // 如果該班別缺人(deficit > 0) 且 在白名單內 -> 填入
                if (d.deficit > 0 && whitelist.includes(d.shift)) {
                    assigned = d.shift;
                    break;
                }
            }
            
            // 如果都滿了，或者都不在白名單 -> 只能 OFF (或硬塞白名單內的第一個上班班別)
            // 這裡採用: 沒缺額就 OFF
            
            this.assign(context, staff.uid, day, assigned);
            if (assigned !== 'OFF') currentCounts[assigned]++;
        }
    }

    // =========================================================================
    // ⏪ Step 2B: 回溯標記 OFF
    // =========================================================================
    static step2B_RetroactiveOFF(context, targetDay) {
        const { assignments, staffReq, dailyLeaveQuotas, stats } = context;
        const dayOfWeek = new Date(context.year, context.month - 1, targetDay).getDay();

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

        if (overstaffedShifts.length === 0) return;

        for (const item of overstaffedShifts) {
            let { shift, count } = item;
            let candidates = staffByShift[shift].map(uid => context.staffList.find(s => s.uid === uid));
            
            // 排除鎖定
            candidates = candidates.filter(s => !this.isLocked(context, s.uid, targetDay));

            // 排序：休假最少的人 (過勞) 優先放假
            candidates.sort((a, b) => stats[a.uid].OFF - stats[b.uid].OFF);

            const maxOff = dailyLeaveQuotas[targetDay] || 0;
            let currentOffCount = Object.values(assignments).filter(sch => sch[targetDay] === 'OFF' || sch[targetDay] === 'M_OFF').length;

            const toRemove = [];
            for (const staff of candidates) {
                if (count <= 0) break;
                if (currentOffCount >= maxOff) break;

                // 避免上1休1 (檢查前兩天)
                const d2Shift = this.getShift(context, staff.uid, targetDay - 1);
                const d3Shift = this.getShift(context, staff.uid, targetDay - 2);
                const isWork2 = ['D','E','N'].includes(d2Shift);
                const isOff3 = d3Shift === 'OFF';

                if (isWork2 && isOff3) continue; 

                toRemove.push(staff.uid);
                count--;
                currentOffCount++;
            }

            toRemove.forEach(uid => {
                this.assign(context, uid, targetDay, 'OFF');
            });
        }
    }

    // ✅ 新增：全月總平衡 (Global Balance)
    static globalBalance(context) {
        const { staffList, assignments, stats, staffReq } = context;
        // 1. 找出極端值
        const sorted = [...staffList].sort((a, b) => stats[a.uid].OFF - stats[b.uid].OFF);
        const overworked = sorted.slice(0, Math.floor(sorted.length / 3)); // 休太少
        const underworked = sorted.slice(-Math.floor(sorted.length / 3)).reverse(); // 休太多

        // 2. 嘗試將 overworked 的班轉給 underworked
        overworked.forEach(busyUser => {
            // 隨機掃描該使用者的工作日
            for (let d = 1; d <= context.daysInMonth; d++) {
                const shift = assignments[busyUser.uid][d];
                if (['D','E','N'].includes(shift) && !this.isLocked(context, busyUser.uid, d)) {
                    
                    // 找一個這天放假的閒人來接
                    for (const freeUser of underworked) {
                        if (assignments[freeUser.uid][d] === 'OFF' && !this.isLocked(context, freeUser.uid, d)) {
                            // 檢查資格 (白名單、規則)
                            if (this.canAssign(context, freeUser, d, shift)) {
                                // 交換
                                this.assign(context, busyUser.uid, d, 'OFF');
                                this.assign(context, freeUser.uid, d, shift);
                                return; // 換掉一天就換下一個人，避免變動太大
                            }
                        }
                    }
                }
            }
        });
    }

    static step3_Finalize(context) {
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
        // 更新前先扣除舊的統計 (若有)
        const oldShift = context.assignments[uid][day];
        if (oldShift) {
            context.stats[uid][oldShift]--;
            if (oldShift === 'OFF') {
                // 這裡稍微複雜，因為 consecutive 是累加的，回頭修改很難維護 consecutive
                // 所以 assign 主要用於當下推進。retroactive 修改時，consecutive 統計可能會失準
                // 但對於 OFF 總數統計是準確的
            }
        }

        context.assignments[uid][day] = shift;
        
        // 更新統計
        if (!context.stats[uid][shift]) context.stats[uid][shift] = 0;
        context.stats[uid][shift]++;

        // 更新 consecutive (僅適用於順序排班，回溯修改無法完美更新此值，但能透過 filterWhitelistRules 擋住當下的連六)
        if (shift === 'OFF' || shift === 'M_OFF') {
            context.stats[uid].consecutive = 0;
        } else {
            context.stats[uid].consecutive++;
        }
    }

    static getShift(context, uid, day) {
        if (day < 1) return 'OFF'; 
        return context.assignments[uid]?.[day] || null;
    }

    static isLocked(context, uid, day) {
        return !!context.wishes[uid]?.wishes?.[day];
    }

    static canAssign(context, staff, day, shift) {
        const whitelist = this.generateWhitelist(context, staff);
        if (!whitelist.includes(shift)) return false;
        
        // 簡單規則驗證
        const prev = this.getShift(context, staff.uid, day - 1);
        if (!RuleEngine.checkShiftInterval(prev, shift, this.getShiftMap(context.settings), 660)) return false;
        
        return true;
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
