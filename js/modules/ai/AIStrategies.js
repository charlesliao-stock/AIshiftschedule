// js/ai/AIStrategies.js

const WEIGHTS = {
    NEED_MET: 0,          
    NEED_MISSING: 2000,   // 上班優先
    OVER_STAFFED: -20000, 
    
    PREF_P1: 800,         
    PREF_P2: 500,        
    PREF_NO: -9999,       
    
    CONTINUITY_BONUS: 50, 
    PATTERN_PENALTY: -50,
    TWO_DAY_BLOCK_BONUS: 200,

    // 公平性：每差一天放假的修正力道
    FAIRNESS_BASE: 1500   
};

// ✅ 改用 O(1) 的讀取方式，不再跑迴圈
const getCurrentOffDays = (uid, context) => {
    return context.stats[uid]?.currentOff || 0;
};

// 公平性分數計算
const calculateFairnessScore = (uid, day, context) => {
    const totalIdealOff = context.idealOffDays || 8; 
    const progress = day / context.daysInMonth;
    const expectedOffSoFar = totalIdealOff * progress;

    const actualOff = getCurrentOffDays(uid, context);

    const diff = actualOff - expectedOffSoFar;
    
    // Day 1-10: x1, Day 11-20: x3, Day 21+: x6
    let multiplier = 1;
    if (day > 20) multiplier = 6;
    else if (day > 10) multiplier = 3;
    
    // diff > 0 (假放太多) -> 加分 (上班)
    // diff < 0 (假放太少) -> 扣分 (不上班)
    return diff * WEIGHTS.FAIRNESS_BASE * multiplier;
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

        if (shift !== 'OFF') {
            score += calculateFairnessScore(uid, day, context);
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

        if (shift !== 'OFF') {
            score += calculateFairnessScore(uid, day, context) * 0.8; 
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

        if (shift === prev1 && shift !== 'OFF') score += WEIGHTS.CONTINUITY_BONUS;
        if (shift !== prev1 && prev1 !== 'OFF' && shift !== 'OFF') score += WEIGHTS.PATTERN_PENALTY;
        
        if (shift === 'OFF') {
            const p1Working = prev1 !== 'OFF' && prev1 !== 'M_OFF';
            if (p1Working && prev1 === prev2) score += WEIGHTS.TWO_DAY_BLOCK_BONUS;
        }

        if (shift !== 'OFF') {
            if (current < shiftReq) score += WEIGHTS.NEED_MISSING;
            else score += WEIGHTS.OVER_STAFFED;
        }

        if (shift !== 'OFF') {
            score += calculateFairnessScore(uid, day, context);
        }

        return score;
    }
}
