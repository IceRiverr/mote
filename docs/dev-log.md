## 2026年3月30日
这是我的开发日志，我计划在这里记录开发过程。

D:\dev\mote\games\tiny-town\assets\kenney_tiny-town_tilemap.png 我希望导入图集是导入的是这张图，然后导出图集时，也描述的是这张图，然后地图可以引用这个 png 和 json 的图集。然后游戏内页引用 png 和 json 的信息来渲染，现在这整个流程是对的吗？

## 2026年4月2日
我准备把现在的编辑器设计全部删掉，重现来做。现在的感觉完全不对。
准备借鉴 Blender 来做。

## 2026-4-2
总算把 logo 做好了。用 figama 做的。

## 2026-4-12
我的 plugin 应该提供哪些基础 componnt 呢

2026-4-14 00:41:04，我需要解决 AI 自己测试的问题，现在都是我人肉自己测试。

2026-4-14 09:20:33，当 AI 完成了某个功能，我应该停下来，看懂再继续。

2026-4-15 09:32:39，我可以把我和 AI 的交流，也放到网页上。让人知道我究竟是使用神峨眉提示词开发的。

## 2026年4月18日
2026-4-18 20:55:56，我想到一个 Andrej 提到的困惑度协议。我想要将那个写成一个 Skill，每次 AI 的决策有疑惑时，问。并且要用户挨个回答。


https://x.com/jingwangtalk/status/2040793973648986289

最近在对比使用三大harness skill：
Superpower: https://github.com/obra/superpowers
Compound Engineering: https://github.com/EveryInc/compound-engineering-plugin
Gstack: https://github.com/garrytan/gstack

每个人有不同的喜好和偏向啊，我的感受如下：
首先，这三个skill本身是在解决同样一个问题，AI Agent在执行任务，尤其是写代码的时候容易跳过规划，质量不稳定，没有一个固定的workflow来限制它。但这三个skill又有不同的思维模型和侧重点：

Superpower：强调流程纪律，每一轮会从spec -> plan -> 拆解任务 -> 执行任务 -> 测试和review -> 提交。优点是流程控制的很好，缺点是小任务时间按这个走很长，需要授权的次数多，消耗token。

CE：强调知识复利，重点是给 AI 装记忆，错过的东西下次不再犯。/ce:compound 会把历史错误给沉淀下来。另外/ce:ideate 可以针对性提出改善建议，并会对优先级排序，筛选掉不重要的improvements。但是我实际的感受是，这些改善点优点不痛不痒。

gstack：最大的亮点是YC的知识和评判标准，对于产品和idea的打磨，让AI对你进行灵魂拷问。更新的版本也支持知识沉淀，未来使用。

我的感觉是，如果是大工程用gstack来进行产品和idea打磨，superpower来执行。


https://x.com/garrytan/status/2044844654978642320
Karpathy's Confusion Protocol is now in GStack

Karpathy called it: the #1 AI coding failure mode is the agent confidently picking the wrong path at an ambiguous decision point. You lose 10 minutes of work and have to start over.

gstack now has an ambiguity gate built into every workflow. Hit a fork in architecture, data modeling, or a destructive operation with unclear scope? The agent stops and asks. No more “I assumed you wanted…”

Not a blunt “confirm everything” prompt. Scoped to decisions where guessing wrong actually costs you time.

## 2026年4月19日
2026-4-19 20:43:24，一些等待做的。
- ok 移除场景中默认地图的限制，默认应该是一个无限大小的画布
- ok 刚打开场景时应该处于居中状态
- ok 笔刷和实体模式，应该是一个下拉框，而不是现在的平铺状态
- ok 视口和工具栏尽量在同一行。这样可以减少界面的占用。
- 场景的保存功能
- 精灵图产生的 prefab，资源编辑器没有刷新
- 资源面板的的 prefab 预览还是一个框，我希望是实际显示精灵。
- 点击精灵和属性编辑器，更新精灵位置，属性编辑没有实时修改。
- 精灵的导入导出界面感觉不需要。1）只应该有 png，双击png图片，打开一个临时的精灵编辑器，然后可以调整精灵的切分行为，如果切分行为OK，那么就可以报错，然后形成为一个图集资源。2）双击图集资源，然后打开一个已经编辑好的图集，可以修改，然后基于选中的一个精灵，可以快速生成 prefab。
- prefab 的编辑工作流还不完整。
- 场景图的属性编辑器要不限制component的删除和新增，只能放置 prefab。
- Tab 键盘有问题，精灵编辑器
- 一些默认组件的问题，引擎应该提供哪些组件，如果项目提供了一些组件，那么怎么暴露给编辑器呢？
- 把最新的编辑器在我的服务器部署
- 至少将一个游戏在现有编辑器下开发完，并上线
- 重构我的服务器，然后提供一个真正的开发笔记。
- 视口和笔刷的字体太大了。统一一下。
- 字体大小不一致，需要重新统一设计

2026-4-19 21:19:55，开发中，很快就会偏离所有的文档，代码和文档的偏离，最后还是代码是最终依据。

