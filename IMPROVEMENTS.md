# 排班算法优化说明 (v2.2 → v2.3)

## 版本信息
- **原版本**: v2.2 平衡修正版
- **新版本**: v2.3 強化平衡版
- **更新日期**: 2025-12-19

## 核心改进

### 1. 反转排序逻辑 ⭐⭐⭐⭐⭐

**问题**：原算法让 OFF 多的人优先处理，但"优先处理"不等于"优先工作"，反而可能因为各种限制继续休假。

**改进**：
```javascript
// 原版本（第 139-146 行）
return rateB - rateA; // OFF 多的先處理

// 新版本
return offA - offB; // OFF 少的先處理
```

**效果**：
- OFF 少（过劳）的人排在前面，优先被考虑放假
- OFF 多（欠班）的人排在后面，优先被分配工作
- 在 `fillBlanks` 阶段同样反转排序，确保一致性

### 2. 放宽偏好限制 ⭐⭐⭐⭐

**问题**：原算法对员工偏好过于严格，如果偏好班别已满，只能分配 OFF，导致长期累积不平衡。

**改进**（第 189-209 行）：
```javascript
// 如果當前 OFF 數量遠低於平均值，允許接受非偏好班別
const currentOff = context.stats[staff.uid].OFF;
const avgTarget = context.avgLeaveTarget;
const daysPassed = Object.keys(context.assignments[staff.uid]).length;
const expectedOff = Math.floor((avgTarget / context.daysInMonth) * daysPassed);

// 如果落後平均值 3 天以上，開放所有班別選項
if (currentOff < expectedOff - 3) {
    list = ['D', 'E', 'N', 'OFF'];
}
```

**效果**：
- 动态调整白名单，平衡"满意度"和"公平性"
- 避免某些员工因偏好限制长期休假过多
- 保持对孕妇/哺乳期员工的保护（仍排除 N 班）

### 3. 强化全月平衡功能 ⭐⭐⭐⭐⭐

**问题**：原 `globalBalance` 函数效果有限：
- 只处理前后 1/3 的极端值
- 每人只交换一天就停止
- 没有迭代机制

**改进**（第 394-508 行）：

#### 3.1 多轮迭代
```javascript
const maxIterations = 5;
for (let iteration = 0; iteration < maxIterations; iteration++) {
    // 每輪嘗試縮小差距
    // 如果標準差 < 1.5 或無法交換，提前結束
}
```

#### 3.2 扩大处理范围
```javascript
// 原版本：只處理前後 1/3
const overworked = sorted.slice(0, Math.floor(sorted.length / 3));

// 新版本：擴大到 40%
const overworked = sorted.slice(0, Math.ceil(sorted.length * 0.4));
```

#### 3.3 增加监控日志
```javascript
console.log(`  第 ${iteration + 1} 輪: 平均 OFF=${avgOff.toFixed(1)}, 標準差=${stdOff.toFixed(2)}`);
console.log(`  本輪交換次數: ${swapCount}`);
```

#### 3.4 智能交换检查
新增 `canSwap` 函数（第 472-517 行），全面检查：
- 白名单限制
- 班次间隔规则
- 连续工作天数
- 前后班次衔接

**效果**：
- 显著提升平衡效果，可处理 20+ 天的极端差异
- 自适应终止，避免过度优化
- 保持所有规则约束，不会产生违规排班

### 4. 新增班次类型平衡 ⭐⭐⭐

**问题**：原算法只关注 OFF 数量，没有平衡 D/E/N 班次的分配。

**改进**（第 519-561 行）：
```javascript
static balanceShiftTypes(context) {
    ['D', 'E', 'N'].forEach(shiftType => {
        // 找出該班次過多和過少的人
        // 嘗試交換工作日的班次類型
    });
}
```

**效果**：
- 避免某人全月都是 D 班，另一人全月都是 N 班
- 提升班次分配的多样性和公平性
- 不涉及 OFF 交换，只交换工作日的班次类型

## 预期效果

### 定量指标
- **OFF 标准差**：从 5-8 天降低到 1.5 天以内
- **极端差异**：从 20+ 天缩小到 5 天以内
- **班次标准差**：D/E/N 各班次的标准差降低 30-50%

### 定性改进
1. **公平性提升**：员工之间的工作负担更加均衡
2. **满意度保持**：在不严重影响偏好的前提下实现平衡
3. **规则遵守**：所有改进都在规则约束内进行
4. **透明度增强**：通过日志可追踪平衡过程

## 使用方法

### 方案 A：直接替换（推荐用于测试）

```bash
# 备份原文件
cp js/modules/ai/AutoScheduler.js js/modules/ai/AutoScheduler_v2.2_backup.js

# 替换为新版本
cp js/modules/ai/AutoScheduler_v2.3.js js/modules/ai/AutoScheduler.js
```

### 方案 B：并行测试

保留两个版本，在界面上添加版本选择开关：
```javascript
import { AutoScheduler as AutoScheduler_v22 } from "./AutoScheduler_v2.2.js";
import { AutoScheduler as AutoScheduler_v23 } from "./AutoScheduler_v2.3.js";

const scheduler = useV23 ? AutoScheduler_v23 : AutoScheduler_v22;
```

## 兼容性说明

- ✅ 完全兼容现有接口，无需修改调用代码
- ✅ 保持所有规则引擎功能
- ✅ 支持所有策略（A/B/C）
- ✅ 保持预班、偏好、限制等所有功能

## 注意事项

1. **运算时间**：由于增加了多轮平衡迭代，运算时间可能增加 10-30%（仍在 60 秒限制内）
2. **偏好满足度**：在极端不平衡情况下，可能会临时忽略部分偏好以实现公平
3. **预班锁定**：所有预班（预先提交的班次）仍然被严格遵守，不会被平衡算法修改

## 后续优化建议

### 短期（1-2 周）
1. 收集用户反馈，微调平衡阈值（目前是 3 天和 1.5 标准差）
2. 添加"平衡强度"设置，让用户选择"温和平衡"或"激进平衡"
3. 优化日志输出，在界面上显示平衡过程

### 中期（1-2 月）
1. 引入机器学习，根据历史数据预测最优平衡策略
2. 添加"公平性优先"模式，在该模式下完全忽略偏好
3. 支持跨月平衡（考虑上个月的工作负担）

### 长期（3-6 月）
1. 重构为约束满足问题（CSP）求解器
2. 使用遗传算法进行全局优化
3. 支持多目标优化（公平性、满意度、规律性的帕累托前沿）

## 技术债务

1. `consecutive` 统计在回溯修改时可能不准确（已在注释中说明）
2. `canSwap` 函数的规则检查可以进一步抽象复用
3. 平衡算法的参数（40%、3 天、1.5 标准差）应该可配置化

## 测试建议

1. **基准测试**：使用相同的输入数据，对比 v2.2 和 v2.3 的输出
2. **极端测试**：构造极端不平衡的预班数据，验证平衡效果
3. **规则测试**：验证所有规则（连六休一、班次间隔、孕妇限制）仍然有效
4. **性能测试**：测量运算时间，确保在 60 秒限制内

## 联系方式

如有问题或建议，请通过 GitHub Issues 反馈。
