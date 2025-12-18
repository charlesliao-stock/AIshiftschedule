
const WEIGHTS = {
    // 滿足人力需求
    NEED_MET: 0,          
    NEED_MISSING: 3000,   // 缺人 (高分，但低於 P1，確保在策略 B 中願望優先)
    OVER_STAFFED: -10,    // 微小扣分，允許超編
    
    // 員工偏好
    PREF_P1: 5000,        // P1 權重極高
    PREF_P2: 2500,        // P2 權重次之
    PREF_NO: -9999,       // 勿排 (絕對禁止)
    NOT_IN_PREF: -5000,   // ✅ 新增：排了「非志願」的班 (針對策略 B)
    
    // 平衡性
    BALANCE_OVER_AVG: -50, 
    
    // 連續性
    CONTINUITY_BONUS: 500, 
    PATTERN_PENALTY: -200   
};