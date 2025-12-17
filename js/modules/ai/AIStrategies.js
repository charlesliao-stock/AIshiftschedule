// js/ai/AIStrategies.js

const WEIGHTS = {
    NEED_MET: 0,          
    NEED_MISSING: 1000,   // 提高缺人權重，確保有人上班
    OVER_STAFFED: -20000, // 嚴重超編
    
    PREF_P1: 800,         // 志願分稍微調降，讓公平性優先
    PREF_P2: 500,        
    PREF_NO: -9999,       
    
    CONTINUITY_BONUS: 50, 
    PATTERN_PENALTY: -50,
    TWO_DAY_BLOCK_BONUS: 200,

    // ✅ 新增：公平性追趕力道 (數值越大，大家班數越接近)
    FAIRNESS_STRENGTH: 5000 
};

// 輔助：計算該員目前的總班數
const getCurrentTotalShifts = (uid, stats) => {
    return (stats[uid]?.D || 0) + (stats[uid]?.E || 0) + (stats[uid]?.N || 0);
};

// 輔助：計算全體人員目前的平均班數
const getCohortAverage = (context) => {
    let totalAll = 0;
    const staffCount = context.staffList.length;
    if (staffCount === 0) return 0;
    
    // 累加所有人的班數
    context.staffList.forEach(s => {
        const uid = s.uid;
        totalAll += getCurrentTotalShifts(uid, context.stats);
    });
    return totalAll / staffCount;
};

export class BalanceStrategy {
    static calculateScore(uid, shift, day, context, currentCounts, w) {
        let score = 100;
        const shiftReq = context.staffReq[shift]?.[w] || 0;
        const current = currentCounts[shift] || 0;

        // 1. 人力需求 (基礎)
        if (shift !== 'OFF') {
            if (current < shiftReq) score += WEIGHTS.NEED_MISSING;
            else score += WEIGHTS.OVER_STAFFED;
        }

        // 2. ✅ 動態公平性追趕 (Dynamic Fairness)
        // 核心邏輯：(平均班數 - 我的班數) * 力道
        // 如果我班少 (平均 > 我)，結果為正，大加分 -> 優先排我
        // 如果我班多 (平均 < 我)，結果為負，大扣分 -> 讓我休假
        if (shift !== 'OFF') {
            const avgSoFar = getCohortAverage(context);
            const myTotal = getCurrentTotalShifts(uid, context.stats);
            
            const diff = avgSoFar - myTotal; 
            // 例如：平均 5.5，我 4 -> diff = 1.5 -> 加分 7500 (極高)
            // 例如：平均 5.5，我 7 -> diff = -1.5 -> 扣分 7500 (極低)
            
            score += diff * WEIGHTS.FAIRNESS_STRENGTH;
        }

        // 3. 基礎偏好
        const prefs = context.preferences[uid] || {};
        if (prefs.p1 === shift) score += 100;

        return score;
    }
}

export class PreferenceStrategy {
    static calculateScore(uid, shift, day, context, currentCounts, w) {
        let score = 100;
        const prefs = context.preferences[uid] || {};
        const shiftReq = context.staffReq[shift]?.[w] || 0;
        const current = currentCounts[shift] || 0;

        // 1. 滿足願望
        if (prefs.p1 === shift) score += WEIGHTS.PREF_P1;
        else if (prefs.p2 === shift) score += WEIGHTS.PREF_P2;

        // 2. 人力需求
        if (shift !== 'OFF') {
            if (current < shiftReq) score += WEIGHTS.NEED_MISSING;
            else score += WEIGHTS.OVER_STAFFED;
        }

        // 3. ✅ 即使是願望優先，也要納入公平性 (但權重稍低)
        if (shift !== 'OFF') {
            const avgSoFar = getCohortAverage(context);
            const myTotal = getCurrentTotalShifts(uid, context.stats);
            const diff = avgSoFar - myTotal;
            
            // 願望優先模式下，公平性權重設為 3000 (比平衡模式低，允許一點點差距換取願望)
            score += diff * 3000; 
        }

        return score;
    }
}

export class PatternStrategy {
    static calculateScore(uid, shift, day, context, currentCounts, w) {
        let score = 100;
        const prev1 = context.assignments[uid][day-1] || 'OFF';
        const prev2 = context.assignments[uid][day-2] || 'OFF';
        const shiftReq = context.staffReq[shift]?.[w] || 0;
        const current = currentCounts[shift] || 0;

        // 1. 連續性
        if (shift === prev1 && shift !== 'OFF') score += WEIGHTS.CONTINUITY_BONUS;
        if (shift !== prev1 && prev1 !== 'OFF' && shift !== 'OFF') score += WEIGHTS.PATTERN_PENALTY;
        
        if (shift === 'OFF') {
            const p1Working = prev1 !== 'OFF' && prev1 !== 'M_OFF';
            if (p1Working && prev1 === prev2) score += WEIGHTS.TWO_DAY_BLOCK_BONUS;
        }

        // 2. 人力需求
        if (shift !== 'OFF') {
            if (current < shiftReq) score += WEIGHTS.NEED_MISSING;
            else score += WEIGHTS.OVER_STAFFED;
        }

        // 3. ✅ 公平性追趕
        if (shift !== 'OFF') {
            const avgSoFar = getCohortAverage(context);
            const myTotal = getCurrentTotalShifts(uid, context.stats);
            const diff = avgSoFar - myTotal;
            score += diff * WEIGHTS.FAIRNESS_STRENGTH;
        }

        return score;
    }
}
