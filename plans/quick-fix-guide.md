# 快速修复指南

## 刚修复的问题

### ✅ ViewportFooter.tsx
- **问题**: 引用旧的 `activeLayer` 
- **修复**: 改为显示 Entity 数量

### ✅ history.ts  
- **问题**: 命令系统依赖旧 store
- **修复**: 创建占位符，Undo/Redo 暂时空实现

---

## 可能遇到的下一个错误

如果还有其他类似错误，通常是以下类型：

### 1. Store 导入错误
**错误**: `Module 'X' does not provide export named 'Y'`

**解决**: 文件还在引用旧 project store
- 查找该文件
- 替换为新的 store 导入
- 或暂时注释掉相关代码

### 2. 类型错误
**错误**: `Property 'X' does not exist on type 'Y'`

**解决**: 新 Scene 类型没有旧属性
- `layers` → `entities`
- `tileWidth/tileHeight` → `grid.size`
- `spriteSheets` → 移除（现在用 Prefab 的 Sprite 组件）

### 3. 组件未找到
**错误**: `Cannot find module './X'`

**解决**: 
- 检查文件是否还存在
- 被删除的文件创建占位符
- 或更新引用路径

---

## 快速调试技巧

### 查看完整错误
```javascript
// 在浏览器控制台
// 点击错误堆栈，查看具体文件和行号
```

### 临时禁用功能
```typescript
// 在 App.tsx 中注释掉有问题的编辑器
// import "./editors/XXX/register";
```

### 创建占位符组件
```typescript
// 如果某个组件完全损坏，快速创建占位符
export function BrokenComponent() {
  return <div>Component temporarily unavailable</div>;
}
```

---

## 当前优先级

1. **让 Editor 跑起来** ← 我们现在在这里
2. 修复剩余编译错误
3. 测试核心功能（Prefab Browser → Viewport → Inspector）
4. 实现缺失功能（Undo/Redo, Sprite Editor, File System）

---

## 测试检查清单

如果 Vite 成功启动，测试：

- [ ] Prefab Browser 显示在右侧
- [ ] 能看到 10 个示例 Prefab
- [ ] 双击 Prefab 能在场景中创建 Entity
- [ ] Entity 显示在 Viewport 中
- [ ] 点击 Entity 能选中（蓝色边框）
- [ ] Inspector 显示 Entity 属性
- [ ] 能修改属性值

---

**遇到新错误请直接复制粘贴错误信息！**
