// js/ai/AIStrategies.js

const WEIGHTS = {
    NEED_MET: 0,          
    NEED_MISSING: 500,    
    OVER_STAFFED: -10000, 
    
    PREF_P1: 1000,       
    PREF_P2: 800,        
    PREF_NO: -5000,       
    
    BALANCE_OVER_AVG: -200, 
    
    CONTINUITY_BONUS: 50, 
    PATTERN_PENALTY: -50,
    
    // ✅ 新增：兩天同班後排休的獎勵
    TWO_DAY_BLOCK_BONUS: 300 
};

const getCurrentTotalShifts = (uid, stats) => {
    return (stats[uid]?.D || 0) + (stats[uid]?.E || 0) + (stats[uid]?.N || 0);
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

        let totalAll = 0;
        Object.values(context.stats).forEach(s => totalAll += (s.D+s.E+s.N));
        const avg = totalAll / context.staffList.length;
        const myTotal = getCurrentTotalShifts(uid, context.stats);

        if (shift !== 'OFF') {
            if (myTotal > avg + 1) score += WEIGHTS.BALANCE_OVER_AVG;
            else if (myTotal < avg - 1) score += 200;
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
        
        // 取得前兩天的班別 (AutoScheduler 有準備 Day 0 和 Day -1)
        const prev1 = context.assignments[uid][day-1] || 'OFF';
        const prev2 = context.assignments[uid][day-2] || 'OFF';
        
        const shiftReq = context.staffReq[shift]?.[w] || 0;
        const current = currentCounts[shift] || 0;

        // 1. 連續性與花花班懲罰
        if (shift === prev1 && shift !== 'OFF') score += WEIGHTS.CONTINUITY_BONUS;
        if (shift !== prev1 && prev1 !== 'OFF' && shift !== 'OFF') score += WEIGHTS.PATTERN_PENALTY;

        // ✅ 2. 鼓勵「同班連 2 天後排休」 (XX O 模式)
        if (shift === 'OFF') {
            // 如果前兩天都是上班，且班別相同
            const p1Working = prev1 !== 'OFF' && prev1 !== 'M_OFF';
            if (p1Working && prev1 === prev2) {
                score += WEIGHTS.TWO_DAY_BLOCK_BONUS;
            }
        }

        // 3. 人力需求
        if (shift !== 'OFF') {
            if (current < shiftReq) score += WEIGHTS.NEED_MISSING;
            else score += WEIGHTS.OVER_STAFFED;
        }

        return score;
    }
}
