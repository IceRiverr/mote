// 在浏览器控制台执行这段代码来测试碰撞体功能
// 1. 打开 Sprite Editor
// 2. 按 F12 打开控制台
// 3. 粘贴以下代码：

const sheet = spriteSheets.value[0];
if (!sheet) {
  console.log('没有加载的图集');
} else {
  const frameId = Object.keys(sheet.frames)[0];
  console.log('测试给 frame', frameId, '添加碰撞体');
  
  // 直接调用 store 函数
  setFrameCollider(sheet.id, frameId, [{ type: 'full' }]);
  
  // 验证
  setTimeout(() => {
    const updated = spriteSheets.value.find(s => s.id === sheet.id);
    console.log('更新后的 collider:', updated.frames[frameId].collider);
  }, 100);
}
