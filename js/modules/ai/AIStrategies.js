// js/ai/AIStrategies.js

const WEIGHTS = {
    NEED_MET: 0,          
    NEED_MISSING: 2000,   // 🔥 提高：缺人時上班是最高優先
    OVER_STAFFED: -20000, // 嚴重超編禁止
    
    PREF_P1: 800,         
    PREF_P2: 500,        
    PREF_NO: -9999,       
    
    CONTINUITY_BONUS: 50, 
    PATTERN_PENALTY: -50,
    TWO_DAY_BLOCK_BONUS: 200,

    // 公平性：每差一天放假的修正力道
    FAIRNESS_BASE: 1500   
};

// 輔助：嚴格計算「本月 1 號起」的 OFF 數量
const getCurrentOffDays = (uid, context, currentDay) => {
    let offCount = 0;
    // 遍歷本月已排的每一天 (從 1 號開始)
    for (let d = 1; d < currentDay; d++) {
        const s = context.assignments[uid][d];
        if (s === 'OFF' || s === 'M_OFF') offCount++;
    }
    return offCount;
};

// 🔥 公平性分數計算
const calculateFairnessScore = (uid, day, context) => {
    // 1. 理應放假天數 (累積)
    const totalIdealOff = context.idealOffDays || 8; 
    const progress = day / context.daysInMonth;
    const expectedOffSoFar = totalIdealOff * progress;

    // 2. 實際放假天數
    const actualOff = getCurrentOffDays(uid, context, day);

    // 3. 差距
    const diff = actualOff - expectedOffSoFar;
    
    // 每 5 天加重一次權重 (越月底越嚴格)
    const multiplier = Math.floor(day / 5) + 1;
    
    // diff > 0 (假放太多): 應該上班 -> 上班選項加分
    // diff < 0 (假放太少): 應該休假 -> 上班選項扣分
    // 注意：這裡是回傳給「上班班別(D/E/N)」的分數
    // 所以假放太多 (diff正) 要加分，反之扣分
    // 公式調整： return diff * -1 * WEIGHTS...  (錯的)
    // 邏輯修正：
    // 如果我假放多了 (Actual > Expected)，diff 為正。我應該去上班。所以上班分數要 +。
    // 所以 return -diff * WEIGHTS... (這樣假多 -> 負分 -> 不上班?? 不對)
    
    // 正確邏輯：
    // 對「上班班別」來說：
    // 假放太少 (Actual < Expected, diff負) -> 應該排 OFF -> 上班分數要扣分 (負上加負)
    // 假放太多 (Actual > Expected, diff正) -> 應該排 上班 -> 上班分數要加分
    
    // 因此： return (Actual - Expected) * -1 * Base?
    // 讓我們直觀一點：
    // 缺假 (diff < 0): 希望 OFF。上班分數應為 負。 (diff * PositiveWeight) -> 負
    // 多假 (diff > 0): 希望 Work。上班分數應為 正。 (diff * PositiveWeight) -> 正
    
    // 所以，直接回傳 diff * WEIGHTS 即可？
    // 例子：應放 5 天，實放 3 天。diff = -2。
    // 上班分數 += -2 * 1500 = -3000。 (降低上班機率，增加 OFF 機率) -> 正確！
    // 例子：應放 5 天，實放 7 天。diff = +2。
    // 上班分數 += +2 * 1500 = +3000。 (增加上班機率) -> 正確！

    return diff * WEIGHTS.FAIRNESS_BASE * multiplier;
};

export class BalanceStrategy {
    static calculateScore(uid, shift, day, context, currentCounts, w) {
        let score = 100;
        const shiftReq = context.staffReq[shift]?.[w] || 0;
        const current = currentCounts[shift] || 0;

        // 1. 人力需求
        if (shift !== 'OFF') {
            if (current < shiftReq) score += WEIGHTS.NEED_MISSING;
            else score += WEIGHTS.OVER_STAFFED;
        }

        // 2. 公平性追趕 (影響上班意願)
        if (shift !== 'OFF') {
            score += calculateFairnessScore(uid, day, context);
        }

        // 3. 偏好
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

        // 3. 公平性 (即使願望優先，也要微調)
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

        // 3. 公平性
        if (shift !== 'OFF') {
            score += calculateFairnessScore(uid, day, context);
        }

        return score;
    }
}
