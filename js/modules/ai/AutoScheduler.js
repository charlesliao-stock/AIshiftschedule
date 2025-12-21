import { RuleEngine } from "./RuleEngine.js";

const MAX_RUNTIME = 60000;

export class AutoScheduler {

    static async run(currentSchedule, staffList, unitSettings, preScheduleData, strategyCode = 'A') {
        console.log(`🚀 AI 排班啟動 (v4.0 每日三循環嚴格版): 策略 ${strategyCode}`);
        const startTime = Date.now();

        try {
            const prevMonthData = preScheduleData?.prevAssignments || {};
            
            // 🛠️ 初始化 Context
            const context = this.prepareContext(currentSchedule, staffList, unitSettings, preScheduleData, prevMonthData);

            // 🎯 步驟 1：準備工作
            this.step1_Preparation(context);

            // 🔄 步驟 2：逐日排班 (每日執行三個循環)
            for (let day = 1; day <= context.daysInMonth; day++) {
                // 超時檢查
                if (Date.now() - startTime > MAX_RUNTIME) {
                    context.logs.push("⚠️ 運算超時，提前結束");
                    break;
                }

                // console.log(`📅 Day ${day} 排班開始...`);

                // 🔄 循環 1：基礎分配與延續
                // (處理連六限制、優先延續前日班別、前日OFF則排缺口)
                this.cycle1_BasicAssignment(context, day);

                // 🔄 循環 2：填補缺口
                // (2-1: 找休假太多的人回來, 2-2: 找連上3天同班的人支援)
                this.cycle2_FillGaps(context, day);

                // 🔄 循環 3：修剪超額
                // (找休假太少的人去休假)
                this.cycle3_TrimExcess(context, day);
            }

            // 🎯 步驟 3：最終檢查與收尾 (補滿未排班者為OFF)
            this.step3_Finalize(context);

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
    // 🔄 Cycle 1: 基礎分配與延續
    // =========================================================================
    static cycle1_BasicAssignment(context, day) {
        const { staffList, staffReq } = context;
        const dayOfWeek = new Date(context.year, context.month - 1, day).getDay();

        // 取得當日需求
        const targetCounts = {
            D: staffReq['D']?.[dayOfWeek] || 0,
            E: staffReq['E']?.[dayOfWeek] || 0,
            N: staffReq['N']?.[dayOfWeek] || 0
        };

        // 隨機排序員工 (避免順序造成的偏差)
        const sortedStaff = [...staffList].sort(() => Math.random() - 0.5);

        for (const staff of sortedStaff) {
            const uid = staff.uid;

            // 1. 預班鎖定檢查
            if (this.isLocked(context, uid, day)) continue;

            // 2. 硬規則檢查：連六強制 OFF (檢查到昨天為止是否已連六)
            const currentConsecutive = this.calculateConsecutiveDays(context, uid, day - 1);
            const maxCons = staff.constraints?.maxConsecutive || context.rules.maxWorkDays || 6;

            if (currentConsecutive >= maxCons) {
                this.assign(context, uid, day, 'OFF');
                continue;
            }

            // 3. 生成白名單 (含間隔、偏好、孕哺)
            let whitelist = this.generateWhitelist(context, staff);
            whitelist = this.filterWhitelistRules(context, staff, day, whitelist);

            // 4. 決定班別
            const prevShift = this.getShift(context, uid, day - 1);

            if (prevShift === 'OFF' || prevShift === 'M_OFF') {
                // A. 前一天是 OFF -> 優先填補當前缺口最大的班
                const currentCounts = this.getCurrentCounts(context, day);
                const gaps = ['D', 'E', 'N']
                    .map(s => ({ shift: s, gap: targetCounts[s] - currentCounts[s] }))
                    .filter(item => item.gap > 0 && whitelist.includes(item.shift))
                    .sort((a, b) => b.gap - a.gap); // 缺口大優先

                if (gaps.length > 0) {
                    this.assign(context, uid, day, gaps[0].shift);
                } else {
                    this.assign(context, uid, day, 'OFF');
                }
            } else {
                // B. 前一天是上班 -> 優先嘗試延續 (Same Shift)
                if (whitelist.includes(prevShift)) {
                    this.assign(context, uid, day, prevShift);
                } else {
                    // 不能延續 (可能違反間隔或不在偏好白名單) -> 改填缺口
                    const currentCounts = this.getCurrentCounts(context, day);
                    const gaps = ['D', 'E', 'N']
                        .map(s => ({ shift: s, gap: targetCounts[s] - currentCounts[s] }))
                        .filter(item => item.gap > 0 && whitelist.includes(item.shift))
                        .sort((a, b) => b.gap - a.gap);

                    if (gaps.length > 0) {
                        this.assign(context, uid, day, gaps[0].shift);
                    } else {
                        this.assign(context, uid, day, 'OFF');
                    }
                }
            }
        }
    }

    // =========================================================================
    // 🔄 Cycle 2: 填補缺口
    // =========================================================================
    static cycle2_FillGaps(context, day) {
        const { staffList, staffReq } = context;
        const dayOfWeek = new Date(context.year, context.month - 1, day).getDay();

        const targetCounts = {
            D: staffReq['D']?.[dayOfWeek] || 0,
            E: staffReq['E']?.[dayOfWeek] || 0,
            N: staffReq['N']?.[dayOfWeek] || 0
        };

        // ---------------------------------------------------------------------
        // 2-1: 找「休假太多 (High OFF count)」的人回來上班
        // ---------------------------------------------------------------------
        // 嘗試多次以盡量填補
        for (let i = 0; i < 2; i++) {
            const currentCounts = this.getCurrentCounts(context, day);
            const gaps = ['D', 'E', 'N'].filter(s => targetCounts[s] > currentCounts[s]);

            if (gaps.length === 0) break;

            // 找出目前排 OFF 的人 (非鎖定)
            const offStaff = staffList.filter(s => {
                if (this.isLocked(context, s.uid, day)) return false;
                return context.assignments[s.uid][day] === 'OFF'; // 必須是排班產生的OFF
            });

            // 排序：Total OFF 由多到少 (假太多的人優先被抓回來)
            offStaff.sort((a, b) => {
                return context.stats[b.uid].totalOff - context.stats[a.uid].totalOff;
            });

            for (const staff of offStaff) {
                // 檢查是否還有缺口
                const curCounts = this.getCurrentCounts(context, day);
                const liveGaps = gaps.filter(s => targetCounts[s] > curCounts[s]);
                if (liveGaps.length === 0) break;

                // 檢查白名單
                let whitelist = this.generateWhitelist(context, staff);
                whitelist = this.filterWhitelistRules(context, staff, day, whitelist);

                // 找出交集 (缺口 ∩ 白名單)
                const compatibleGaps = liveGaps.filter(g => whitelist.includes(g));

                if (compatibleGaps.length > 0) {
                    // 隨機選一個可填的缺口
                    const gapToFill = compatibleGaps[Math.floor(Math.random() * compatibleGaps.length)];
                    this.assign(context, staff.uid, day, gapToFill);
                    // console.log(`  [C2-1] 召回 ${staff.name} (OFF:${context.stats[staff.uid].totalOff}) -> ${gapToFill}`);
                }
            }
        }

        // ---------------------------------------------------------------------
        // 2-2: 若仍有缺口，找「連續3天同班者」調整
        // ---------------------------------------------------------------------
        const currentCounts2 = this.getCurrentCounts(context, day);
        const remainingGaps = ['D', 'E', 'N'].filter(s => targetCounts[s] > currentCounts2[s]);

        if (remainingGaps.length > 0) {
            // 找出超額的班別 (Source)
            const overstaffedShifts = ['D', 'E', 'N'].filter(s => currentCounts2[s] > targetCounts[s]);

            for (const sourceShift of overstaffedShifts) {
                // 找出該班別中，連續上班 >= 3 天的人
                const candidates = staffList.filter(s => {
                    if (this.isLocked(context, s.uid, day)) return false;
                    if (context.assignments[s.uid][day] !== sourceShift) return false;

                    const cons = this.getConsecutiveDaysFromOff(context, s.uid, day, sourceShift);
                    return cons >= 3;
                });

                // 隨機打散，避免總是移動同一人
                const shuffled = candidates.sort(() => Math.random() - 0.5);

                for (const staff of shuffled) {
                    // 檢查缺口
                    const curCounts = this.getCurrentCounts(context, day);
                    const liveGaps = remainingGaps.filter(s => targetCounts[s] > curCounts[s]);
                    if (liveGaps.length === 0) break;

                    let whitelist = this.generateWhitelist(context, staff);
                    whitelist = this.filterWhitelistRules(context, staff, day, whitelist);

                    const compatibleGaps = liveGaps.filter(g => whitelist.includes(g));

                    if (compatibleGaps.length > 0) {
                        const gapToFill = compatibleGaps[Math.floor(Math.random() * compatibleGaps.length)];
                        this.assign(context, staff.uid, day, gapToFill);
                        // console.log(`  [C2-2] 調整 ${staff.name} (${sourceShift}連${3}) -> ${gapToFill}`);
                    }
                }
            }
        }
    }

    // =========================================================================
    // 🔄 Cycle 3: 修剪超額
    // =========================================================================
    static cycle3_TrimExcess(context, day) {
        const { staffList, staffReq } = context;
        const dayOfWeek = new Date(context.year, context.month - 1, day).getDay();

        const targetCounts = {
            D: staffReq['D']?.[dayOfWeek] || 0,
            E: staffReq['E']?.[dayOfWeek] || 0,
            N: staffReq['N']?.[dayOfWeek] || 0
        };

        const currentCounts = this.getCurrentCounts(context, day);
        const overstaffed = ['D', 'E', 'N'].filter(s => currentCounts[s] > targetCounts[s]);

        for (const shift of overstaffed) {
            let surplus = currentCounts[shift] - targetCounts[shift];
            if (surplus <= 0) continue;

            // 找出該班別的所有人 (排除鎖定)
            const staffInShift = staffList.filter(s => {
                return !this.isLocked(context, s.uid, day) &&
                       context.assignments[s.uid][day] === shift;
            });

            // 排序：Total OFF 由少到多 (假少的人優先去休假)
            staffInShift.sort((a, b) => {
                return context.stats[a.uid].totalOff - context.stats[b.uid].totalOff;
            });

            for (const staff of staffInShift) {
                if (surplus <= 0) break;

                // 轉為 OFF
                this.assign(context, staff.uid, day, 'OFF');
                surplus--;
                // console.log(`  [C3] 修剪 ${staff.name} (${shift}超額, OFF少) -> OFF`);
            }
        }
    }

    // =========================================================================
    // 🛠️ 輔助與初始化函式
    // =========================================================================

    static prepareContext(schedule, staffList, unitSettings, preSchedule, prevMonthData = {}) {
        const assignments = {};
        const stats = {};
        const preferences = {};

        staffList.forEach(staff => {
            const uid = staff.uid;
            assignments[uid] = {};

            // 計算預班中的 OFF 數量
            let preOffCount = 0;
            const staffWishes = preSchedule?.submissions?.[uid]?.wishes || {};
            Object.values(staffWishes).forEach(w => {
                if (w === 'OFF' || w === 'M_OFF') preOffCount++;
            });

            stats[uid] = {
                D: 0, E: 0, N: 0,
                OFF: 0,                   // 排班產生的 OFF
                preOffCount: preOffCount, // 預班的 OFF
                totalOff: preOffCount,    // 總 OFF (用於排序)
            };

            const sub = preSchedule?.submissions?.[uid];
            preferences[uid] = sub?.preferences || {};
        });

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
            prevMonthData: prevMonthData
        };
    }

    static step1_Preparation(context) {
        // 簡單計算概況，實際運算在 Cycle 內動態處理
        const { staffList, daysInMonth } = context;
        context.logs.push(`開始排班: ${context.year}/${context.month}, 員工數: ${staffList.length}`);
    }

    static step3_Finalize(context) {
        // 確保所有空值都填上 OFF (防呆)
        const { daysInMonth, assignments, staffList } = context;
        staffList.forEach(staff => {
            for (let d = 1; d <= daysInMonth; d++) {
                if (!assignments[staff.uid][d]) {
                    this.assign(context, staff.uid, d, 'OFF');
                }
            }
        });
    }

    // 核心分配函式：同步更新統計數據 (Incremental Update)
    static assign(context, uid, day, shift) {
        const oldShift = context.assignments[uid][day];

        // 1. 扣除舊的統計
        if (oldShift) {
            if (['D', 'E', 'N'].includes(oldShift)) context.stats[uid][oldShift]--;
            if (oldShift === 'OFF') context.stats[uid].OFF--;
        }

        // 2. 設定新班別
        context.assignments[uid][day] = shift;

        // 3. 增加新的統計
        if (['D', 'E', 'N'].includes(shift)) context.stats[uid][shift]++;
        if (shift === 'OFF') context.stats[uid].OFF++;

        // 4. 即時更新 Total OFF (排班 OFF + 預班 OFF)
        context.stats[uid].totalOff = context.stats[uid].OFF + context.stats[uid].preOffCount;
    }

    static getCurrentCounts(context, day) {
        const counts = { D: 0, E: 0, N: 0 };
        Object.values(context.assignments).forEach(shifts => {
            const s = shifts[day];
            if (counts[s] !== undefined) counts[s]++;
        });
        return counts;
    }

    // 計算連續工作天數 (嚴格檢查到昨天，含跨月)
    static calculateConsecutiveDays(context, uid, endDay) {
        let count = 0;
        
        // 1. 往前檢查本月
        for (let d = endDay; d >= 1; d--) {
            const s = context.assignments[uid][d];
            if (['D', 'E', 'N'].includes(s)) count++;
            else return count;
        }

        // 2. 檢查上個月
        const prevMonthData = context.prevMonthData?.[uid] || {};
        // 取得上個月的日期 keys 並由大到小排序
        const days = Object.keys(prevMonthData).map(Number).sort((a, b) => b - a);
        
        for (const d of days) {
            const s = prevMonthData[d];
            if (['D', 'E', 'N'].includes(s)) count++;
            else return count;
        }
        return count;
    }

    // 計算從 OFF 後開始的連續「同一班別」天數 (含跨月)
    static getConsecutiveDaysFromOff(context, uid, targetDay, targetShift) {
        let count = 0;
        
        // 1. 往前遍歷本月
        for (let d = targetDay; d >= 1; d--) {
            const s = context.assignments[uid][d];
            if (s === targetShift) {
                count++;
            } else {
                return count; // 遇到不同班別或OFF，停止
            }
        }

        // 2. 若本月都是該班別，繼續查上個月
        const prevMonthData = context.prevMonthData?.[uid] || {};
        const days = Object.keys(prevMonthData).map(Number).sort((a, b) => b - a);
        
        for (const d of days) {
            const s = prevMonthData[d];
            if (s === targetShift) {
                count++;
            } else {
                return count;
            }
        }
        
        return count;
    }

    // 生成白名單
    static generateWhitelist(context, staff) {
        let list = ['D', 'E', 'N', 'OFF'];
        const constraints = staff.constraints || {};
        const prefs = context.preferences[staff.uid] || {};

        // 孕哺限制
        if (constraints.isPregnant || constraints.isPostpartum) {
            list = list.filter(s => s !== 'N');
        }

        // 夜班互斥 (E vs N)
        const p1 = prefs.priority1;
        const p2 = prefs.priority2;
        const p3 = prefs.priority3;
        
        let allowedNightShift = null;
        if ([p1, p2, p3].includes('E')) allowedNightShift = 'E';
        else if ([p1, p2, p3].includes('N')) allowedNightShift = 'N';
        
        if (allowedNightShift === 'E') list = list.filter(s => s !== 'N');
        else if (allowedNightShift === 'N') list = list.filter(s => s !== 'E');

        // 偏好篩選 (嚴格過濾)
        if (p1 || p2) {
            const preferred = ['OFF'];
            if (p1 && list.includes(p1)) preferred.push(p1);
            if (p2 && list.includes(p2) && !preferred.includes(p2)) preferred.push(p2);
            list = preferred;
        }

        return list;
    }

    // 白名單規則過濾 (間隔 + 連六)
    static filterWhitelistRules(context, staff, day, whitelist) {
        const prevShift = this.getShift(context, staff.uid, day - 1);
        const shiftMap = this.getShiftMap(context.settings);
        
        // 再次防守連六 (雖然 C1 檢查過，但 C2/C3 交換時需要此防守)
        const currentConsecutive = this.calculateConsecutiveDays(context, staff.uid, day - 1);
        const maxCons = staff.constraints?.maxConsecutive || context.rules.maxWorkDays || 6;
        if (currentConsecutive >= maxCons) return ['OFF'];

        return whitelist.filter(shift => {
            if (shift === 'OFF') return true;
            // 間隔檢查 (11小時)
            if (!RuleEngine.checkShiftInterval(prevShift, shift, shiftMap, 660)) return false;
            return true;
        });
    }

    // 取得指定日期的班別 (含上個月查找)
    static getShift(context, uid, day) {
        if (day < 1) {
            const prevMonthData = context.prevMonthData || {};
            if (prevMonthData[uid]) {
                const daysInPrev = new Date(context.year, context.month - 1, 0).getDate();
                const target = daysInPrev + day; // e.g., 0 -> last day
                return prevMonthData[uid][target] || 'OFF';
            }
            return 'OFF';
        }
        return context.assignments[uid]?.[day] || null;
    }

    static isLocked(context, uid, day) {
        return !!context.wishes[uid]?.wishes?.[day];
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
        // 預設值 (防呆)
        if (!map['D']) map['D'] = { start: 480, end: 960 };
        if (!map['E']) map['E'] = { start: 960, end: 1440 };
        if (!map['N']) map['N'] = { start: 0, end: 480 };
        return map;
    }
}
