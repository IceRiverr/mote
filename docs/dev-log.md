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