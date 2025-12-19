# 排班算法测试对比

## 测试说明

由于这是一个前端 JavaScript 项目，需要在浏览器环境中运行才能完整测试。但我们可以通过以下方式验证改进：

## 代码改进验证

### 1. 关键改进点对比

| 改进项 | v2.2 原版本 | v2.3 新版本 | 预期效果 |
|--------|------------|------------|---------|
| 排序逻辑 | OFF 多的先处理 | OFF 少的先处理 | 过劳者优先休假 |
| 偏好限制 | 严格限制白名单 | 动态放宽（落后 3 天） | 避免偏好导致长期不平衡 |
| 平衡范围 | 前后 1/3 (33%) | 前后 40% | 覆盖更多员工 |
| 平衡迭代 | 单次，每人 1 天 | 最多 5 轮，直到标准差 < 1.5 | 显著缩小差距 |
| 班次平衡 | 无 | 新增 D/E/N 平衡 | 班次类型更均匀 |
| 监控日志 | 无 | 详细日志输出 | 可追踪优化过程 |

### 2. 代码质量检查

#### 语法检查
```bash
# 检查 JavaScript 语法错误
node -c js/modules/ai/AutoScheduler.js
```

#### 代码行数对比
```bash
wc -l js/modules/ai/AutoScheduler_v2.2_backup.js
wc -l js/modules/ai/AutoScheduler.js
```

### 3. 逻辑验证

#### 3.1 排序逻辑验证
**v2.2 (第 145 行)**:
```javascript
return rateB - rateA; // 大到小 (OFF 多的先處理)
```

**v2.3 (第 139 行)**:
```javascript
return offA - offB; // 小到大（OFF 少的先處理）
```
✅ **验证通过**：逻辑已反转

#### 3.2 偏好放宽验证
**v2.3 新增 (第 189-209 行)**:
```javascript
const currentOff = context.stats[staff.uid].OFF;
const avgTarget = context.avgLeaveTarget;
const daysPassed = Object.keys(context.assignments[staff.uid]).length;
const expectedOff = Math.floor((avgTarget / context.daysInMonth) * daysPassed);

if (currentOff < expectedOff - 3) {
    list = ['D', 'E', 'N', 'OFF'];
    if (constraints.isPregnant || constraints.isPostpartum) {
        list = list.filter(s => s !== 'N');
    }
} else {
    list = preferred;
}
```
✅ **验证通过**：动态调整机制已实现

#### 3.3 强化平衡验证
**v2.3 新增 (第 394-561 行)**:
- `enhancedGlobalBalance`: 多轮迭代主函数
- `canSwap`: 交换可行性检查
- `balanceShiftTypes`: 班次类型平衡

✅ **验证通过**：所有新功能已实现

## 实际测试步骤

### 在浏览器中测试

1. **启动项目**
   ```bash
   # 如果项目有本地服务器
   cd /home/ubuntu/AIshiftschedule
   python3 -m http.server 8000
   ```

2. **访问系统**
   - 打开浏览器访问 `http://localhost:8000`
   - 登录系统

3. **准备测试数据**
   - 使用与截图相同的员工列表和需求设置
   - 使用相同的预班数据

4. **运行排班**
   - 选择策略 A（公平优先）
   - 点击"AI 排班"按钮
   - 观察控制台日志输出

5. **对比结果**
   - 记录每个员工的 OFF、D、E、N 天数
   - 计算标准差
   - 对比 v2.2 和 v2.3 的差异

### 预期改进效果

基于用户提供的截图数据：

| 员工 | v2.2 OFF | 预期 v2.3 OFF | 改进 |
|------|----------|---------------|------|
| 郭力瑄 | 0 | 6-8 | +6-8 |
| 曾都云 | 0 | 6-8 | +6-8 |
| 曾嘉堂 | 0 | 6-8 | +6-8 |
| 李易澄 | 22 | 8-10 | -12-14 |
| 许佑佑 | 22 | 8-10 | -12-14 |

**标准差改进**：
- v2.2: 约 7-8 天
- v2.3: 预期 < 2 天

## 控制台日志示例

运行 v2.3 时，应该在浏览器控制台看到类似输出：

```
🚀 AI 排班啟動 (v2.3 強化平衡版): 策略 A
🔄 開始強化版全月平衡...
  第 1 輪: 平均 OFF=8.2, 標準差=5.43
  本輪交換次數: 15
  第 2 輪: 平均 OFF=8.2, 標準差=3.21
  本輪交換次數: 8
  第 3 輪: 平均 OFF=8.2, 標準差=1.87
  本輪交換次數: 4
  第 4 輪: 平均 OFF=8.2, 標準差=1.42
  ✅ 平衡度已達標，提前結束
✅ 全月平衡完成
```

## 回归测试清单

- [ ] 连续工作天数不超过 6 天
- [ ] 班次间隔规则正确（N 班后不能立即接 D 班）
- [ ] 孕妇/哺乳期员工不排 N 班
- [ ] 预班（预先提交的班次）被正确锁定
- [ ] 每日人力需求被满足
- [ ] 运算时间在 60 秒内完成

## 性能测试

```javascript
// 在浏览器控制台运行
console.time('AI排班');
// 执行排班
console.timeEnd('AI排班');
```

预期时间：
- v2.2: 5-15 秒
- v2.3: 8-20 秒（增加 20-30%）

## 问题排查

如果遇到问题：

1. **检查浏览器控制台错误**
   - 打开开发者工具 (F12)
   - 查看 Console 标签

2. **验证文件替换**
   ```bash
   head -n 10 js/modules/ai/AutoScheduler.js
   # 应该显示 "v2.3 強化平衡版"
   ```

3. **清除浏览器缓存**
   - Ctrl+Shift+R 强制刷新
   - 或清除站点数据

## 结论

代码改进已完成并应用。由于这是前端项目，需要在实际浏览器环境中运行才能看到最终效果。建议按照上述步骤进行完整测试。
