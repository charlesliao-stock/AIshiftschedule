// js/ai/AIStrategies.js

const WEIGHTS = {
    // 滿足人力需求
    NEED_MET: 0,          
    NEED_MISSING: 2000,   // 缺人 (極高分，優先填)
    OVER_STAFFED: -5,     // 允許微小超編 (方便後續平衡)
    
    // 員工偏好
    PREF_P1: 3000,        // 第一志願
    PREF_P2: 1500,        // 第二志願
    PREF_NO: -9999,       // 勿排
    
    // 平衡性
    BALANCE_OVER_AVG: -10, 
    
    // 連續性
    CONTINUITY_BONUS: 200, 
    PATTERN_PENALTY: -50   
};

export class BalanceStrategy {
    static calculateScore(uid, shift, day, context, currentCounts, w) {
        let score = 100;
        const shiftReq = context.staffReq[shift]?.[w] || 0;
        const current = currentCounts[shift] || 0;

        if (shift !== 'OFF') {
            if (current < shiftReq) score += WEIGHTS.NEED_MISSING;
            else score += WEIGHTS.OVER_STAFFED;
        }

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

        if (prefs.p1 === shift) score += WEIGHTS.PREF_P1;
        else if (prefs.p2 === shift) score += WEIGHTS.PREF_P2;

        if (shift !== 'OFF') {
            if (current < shiftReq) score += WEIGHTS.NEED_MISSING;
            else score += WEIGHTS.OVER_STAFFED;
        }

        return score;
    }
}

export class PatternStrategy {
    static calculateScore(uid, shift, day, context, currentCounts, w) {
        let score = 100;
        const prev = context.assignments[uid][day-1] || 'OFF';
        const shiftReq = context.staffReq[shift]?.[w] || 0;
        const current = currentCounts[shift] || 0;

        if (shift === prev && shift !== 'OFF') score += WEIGHTS.CONTINUITY_BONUS;
        if (shift !== prev && prev !== 'OFF' && shift !== 'OFF') score += WEIGHTS.PATTERN_PENALTY;

        if (shift !== 'OFF') {
            if (current < shiftReq) score += WEIGHTS.NEED_MISSING;
            else score += WEIGHTS.OVER_STAFFED;
        }

        return score;
    }
}
