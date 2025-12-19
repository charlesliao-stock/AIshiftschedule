# 偏好设定和夜班限制的数据结构分析

## 问题诊断

### 问题 1：偏好读取逻辑存在问题

**当前代码（AutoScheduler.js 第 74-75 行）**：
```javascript
const sub = preSchedule?.submissions?.[uid];
preferences[uid] = sub?.preferences || {};
```

**问题**：
- 代码**已经正确读取**了 `preferences` 对象
- 但是 `preferences` 对象中可能缺少 `monthlyMix` 字段

**实际数据结构**：
```javascript
preferences = {
    batch: "包小夜" 或 "包大夜" 或 "",
    monthlyMix: "2" 或 "3",  // ⚠️ 关键字段
    priority1: "D" 或 "E" 或 "N",
    priority2: "D" 或 "E" 或 "N",
    priority3: "D" 或 "E" 或 "N"  // 可选
}
```

### 问题 2：夜班种类数限制未实施

**关键约束**：
- 从预班设定截图看到："夜班整體限制" = "2 種 (至: E/小 或 白/大)"
- 这意味着：**每个人每月只能排 2 种班别**
- 例如：可以排 D+E，或 D+N，但**不能排 D+E+N**

**验证规则（PreScheduleSubmitPage.js 第 443-449 行）**：
```javascript
// 2. 驗證：排班偏好順序中不能同時選兩種夜班 (E, N)
const hasE = selected.includes("E");
const hasN = selected.includes("N");
if (hasE && hasN) {
    alert("錯誤：排班偏好順序中不能同時選擇小夜 (E) 和大夜 (N) 兩種夜班。請修正。");
    return;
}
```

**结论**：
- 员工在提交偏好时，**不能同时选择 E 和 N**
- 因此，每个员工的偏好中，**最多只有一种夜班**
- 算法应该**严格遵守**这个限制

---

## 根本原因

### 原因 1：算法没有读取 `monthlyMix` 字段

**当前代码**：
```javascript
const p1 = prefs.priority1;  // 强偏好
const p2 = prefs.priority2;  // 弱偏好
```

**缺失**：
- 没有读取 `prefs.monthlyMix`
- 没有根据 `monthlyMix` 限制班别种类

### 原因 2：算法没有实施"2 种班别"限制

**当前逻辑**：
```javascript
let list = ['D', 'E', 'N', 'OFF'];
```

**问题**：
- 算法允许员工排所有班别（D/E/N）
- 没有检查员工已经排了哪些班别
- 没有限制班别种类数量

### 原因 3：平衡阶段破坏了偏好

**当前逻辑**：
```javascript
// 阶段 2：平衡小夜班（E）
this.balanceSpecificShift(context, 'E', '小夜');

// 阶段 3：平衡大夜班（N）
this.balanceSpecificShift(context, 'N', '大夜');
```

**问题**：
- 为了平衡 E 和 N，算法可能将 E 班分配给偏好 N 的人
- 或将 N 班分配给偏好 E 的人
- **违反了"不能同时排 E 和 N"的规则**

---

## 解决方案

### 方案 1：严格遵守偏好中的夜班类型

**实施**：
1. 读取 `preferences.priority1` 和 `preferences.priority2`
2. 确定员工的夜班类型（E 或 N）
3. 在 `generateWhitelist` 中，**排除另一种夜班**

**代码示例**：
```javascript
static generateWhitelist(context, staff) {
    let list = ['D', 'E', 'N', 'OFF'];
    const constraints = staff.constraints || {};
    const prefs = context.preferences[staff.uid] || {};

    // 孕哺限制
    if (constraints.isPregnant || constraints.isPostpartum) {
        list = list.filter(s => s !== 'N');
    }

    // ✅ 新增：夜班种类限制
    const p1 = prefs.priority1;
    const p2 = prefs.priority2;
    const p3 = prefs.priority3;
    
    // 确定员工的夜班类型
    let allowedNightShift = null;
    if (p1 === 'E' || p2 === 'E' || p3 === 'E') {
        allowedNightShift = 'E';  // 只能排小夜
    } else if (p1 === 'N' || p2 === 'N' || p3 === 'N') {
        allowedNightShift = 'N';  // 只能排大夜
    }
    
    // 排除另一种夜班
    if (allowedNightShift === 'E') {
        list = list.filter(s => s !== 'N');  // 排除大夜
    } else if (allowedNightShift === 'N') {
        list = list.filter(s => s !== 'E');  // 排除小夜
    }
    
    // ... 其余偏好逻辑
}
```

### 方案 2：修改平衡逻辑，尊重夜班类型限制

**问题**：
- 当前的 `balanceSpecificShift` 可能将 E 班分配给只能排 N 的人

**解决**：
- 在交换前，检查对方是否允许该班次
- 使用 `generateWhitelist` 来验证

**代码示例**：
```javascript
static balanceSpecificShift(context, shiftType, shiftName) {
    // ...
    
    for (const fewUser of tooFew) {
        // 检查 fewUser 是否允许该班次
        const fewStaff = context.staffList.find(s => s.uid === fewUser.uid);
        const whitelist = this.generateWhitelist(context, fewStaff);
        
        if (!whitelist.includes(shiftType)) {
            continue;  // 跳过不允许该班次的人
        }
        
        // ... 进行交换
    }
}
```

### 方案 3：追踪已排班别种类

**实施**：
1. 在 `stats` 中追踪每个员工已排的班别种类
2. 在分配新班次前，检查是否会超过 2 种

**代码示例**：
```javascript
static assign(context, uid, day, shift) {
    const oldShift = context.assignments[uid][day];
    if (oldShift) {
        context.stats[uid][oldShift]--;
    }

    context.assignments[uid][day] = shift;
    
    if (!context.stats[uid][shift]) context.stats[uid][shift] = 0;
    context.stats[uid][shift]++;

    // ✅ 新增：追踪班别种类
    if (!context.stats[uid].shiftTypes) {
        context.stats[uid].shiftTypes = new Set();
    }
    
    if (['D', 'E', 'N'].includes(shift)) {
        context.stats[uid].shiftTypes.add(shift);
    }
    
    // ... 其余逻辑
}
```

---

## 实施优先级

### 高优先级（必须实施）

1. ✅ **方案 1：严格遵守偏好中的夜班类型**
   - 最简单，最直接
   - 立即解决"不能同时排 E 和 N"的问题

2. ✅ **方案 2：修改平衡逻辑**
   - 确保平衡阶段不破坏夜班类型限制

### 中优先级（建议实施）

3. ⚠️ **方案 3：追踪已排班别种类**
   - 提供额外的安全检查
   - 便于调试和验证

---

## 预期效果

### 实施方案 1 + 方案 2 后

**偏好满足度**：
- 如果员工偏好 E，**只会排 D 和 E**，不会排 N
- 如果员工偏好 N，**只会排 D 和 N**，不会排 E
- priority1 满足率：**90%+**（因为严格遵守偏好）

**班次平衡度**：
- 小夜班（E）只在偏好 E 的人之间平衡
- 大夜班（N）只在偏好 N 的人之间平衡
- 标准差可能会略微增加（因为池子变小了）
- 但**不会出现 0-15 天的极端差异**

**规则遵守**：
- ✅ 每个人最多 2 种班别（D + E 或 D + N）
- ✅ 不会同时排 E 和 N
- ✅ 符合预班设定的"夜班整體限制"

---

## 测试验证

### 验证点 1：夜班类型限制

**检查**：
- 统计每个员工的班别种类数
- 应该 ≤ 2

**Excel 公式**：
```excel
=SUMPRODUCT(--(COUNTIF(B2:AF2,{"D","E","N"})>0))
```

### 验证点 2：偏好满足度

**检查**：
- 如果员工偏好 E，检查是否排了 N
- 如果员工偏好 N，检查是否排了 E
- 应该都是"否"

### 验证点 3：平衡度

**检查**：
- 小夜班标准差（只计算偏好 E 的人）
- 大夜班标准差（只计算偏好 N 的人）
- 应该 < 3 天（因为池子变小，标准会略微放宽）

---

## 总结

**核心问题**：
1. 算法没有实施"每人最多 2 种班别"的限制
2. 算法没有根据偏好排除另一种夜班
3. 平衡阶段破坏了夜班类型限制

**解决方案**：
1. 在 `generateWhitelist` 中，根据偏好排除另一种夜班
2. 在 `balanceSpecificShift` 中，检查对方是否允许该班次
3. 严格遵守偏好，不在平衡时破坏规则

**预期效果**：
- ✅ 每个人最多 2 种班别
- ✅ 不会同时排 E 和 N
- ✅ priority1 满足率 90%+
- ✅ 小夜/大夜分别在对应群体内平衡
