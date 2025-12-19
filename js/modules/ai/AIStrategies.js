// js/modules/ai/AIStrategies.js

// 策略類別將從外部配置中讀取權重
export class BalanceStrategy {
    static calculateScore(uid, shift, day, context, currentCounts, w, weights) {
        let score = 100;
        const shiftReq = context.staffReq[shift]?.[w] || 0;
        const current = currentCounts[shift] || 0;

        // 1. 人力需求 (權重較高，追求填滿)
        if (shift !== 'OFF') {
            // 這裡的權重應該來自於 AutoScheduler 傳入的 weights
            if (current < shiftReq) score += weights.coverage; // 覆蓋率
            else score += weights.overwork; // 超額上班懲罰
        }

        // 2. 班別種類平衡 (使用 shiftBalance 權重)
        // 由於 shiftBalance 是一個全域評分，這裡不適合直接加分，而是應該在最終評分時計算。
        // 這裡可以加入一個基礎的偏好滿足度，以確保能排入員工偏好的班別
        const prefs = context.preferences[uid] || {};
        if (prefs.p1 === shift) score += 50; // 基礎 P1 偏好加分，避免完全不考慮偏好

        return score;
    }
}

export class PreferenceStrategy {
    static calculateScore(uid, shift, day, context, currentCounts, w, weights) {
        let score = 100;
        const pref = context.preferences[uid] || {};
        const shiftReq = context.staffReq[shift]?.[w] || 0;
        const current = currentCounts[shift] || 0;

        // 1. 志願優先 (使用 weights.pref 權重)
        if (pref.p1 === shift) {
            score += weights.pref * 3; // 第一志願高分
        } else if (pref.p2 === shift) {
            score += weights.pref * 1.5; // 第二志願中分
        } else if (pref.p3 === shift) {
            // P3 視為「勿排」 (我們在 AutoScheduler 中已經處理了硬性勿排，這裡作為軟性懲罰)
            score += weights.pref * -1; // 輕微懲罰
        } else if (shift !== 'OFF') {
            // 若此班別既非 P1/P2/P3 也非 OFF -> 重罰 (非志願班)
            score += weights.pref * -2;
        }

        // 2. 預班達成 (使用 weights.wish 權重)
        // 修正: 確保 context.wishes 存在且包含該員工的數據
        if (context.wishes && context.wishes[uid] && context.wishes[uid][day] === shift) {
            score += weights.wish * 2;
        }

        // 3. 人力需求 (次要)
        if (shift !== 'OFF') {
            if (current < shiftReq) score += weights.coverage / 10; // 輕微填補缺口的誘因
            else score += weights.overwork / 10; // 輕微超額懲罰
        }

        return score;
    }
}


export class PatternStrategy {
    static calculateScore(uid, shift, day, context, currentCounts, w, weights) {
        let score = 100;
        const prev = context.assignments[uid][day-1] || 'OFF';
        const shiftReq = context.staffReq[shift]?.[w] || 0;
        const current = currentCounts[shift] || 0;

        // 1. 連續性 (作息規律優先)
        // 連續工作懲罰 (weights.cons)
        // 連續工作天數的硬性約束在 AutoScheduler 中處理，這裡只處理軟性懲罰
        
        // 夜班接白班懲罰 (weights.nToD)
        const isNToD = (prev === 'N' && shift === 'D');
        if (isNToD) score += weights.nToD * 2; // 重罰

        // 避免逆向輪轉 (N->E, E->D, N->D)
        const isReverseRotation = (prev === 'N' && shift === 'E') || 
                                  (prev === 'E' && shift === 'D') || 
                                  (prev === 'N' && shift === 'D');
        if (isReverseRotation) score += weights.nToD; // 輕微懲罰

        // 2. 人力需求
        if (shift !== 'OFF') {
            if (current < shiftReq) score += weights.coverage / 10;
            else score += weights.overwork / 10;
        }

        return score;
    }
}
