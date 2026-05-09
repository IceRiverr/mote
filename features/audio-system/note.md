## 2026-05-10

- 原话："记录一下"
- 上下文：给 tiny-dungeon 添加声音时，采用程序化音效方案（Web Audio API 合成 shoot / hit / enemyDie / hurt / pickup / levelup 六种音效），无需外部音频文件；同时给引擎 AudioManager 新增 `register(key, buffer)` 方法，支持直接注册程序生成的 AudioBuffer。已在 tiny-dungeon 中验证 AudioPlugin 可用。
- 原话："我没有太明白 audiocontext 是哪里来的？介绍一下 Web Audio API"
- 上下文：向用户解释了 Web Audio API 的核心概念——AudioContext 由浏览器原生提供（`new AudioContext()`），是音频处理总控台；声音通过节点图（Node Graph）流水线传播（BufferSourceNode → GainNode → destination）；AudioBuffer 只是静态波形数据，既可由文件解码得到，也可由 JS 数学公式直接写入 Float32Array 生成；浏览器策略要求用户交互后才能 `resume()` 音频上下文，否则播放静默。
- 原话："https://sfxr.me/ https://www.bfxr.net/ 这些生成音效的方式是什么原理呢"
- 上下文：sfxr / bfxr 的本质与 tiny-dungeon 当前方案相同，都是参数化波形合成（Parametric Synthesis）。核心管线为：基础波形发生器（Square/Sawtooth/Sine/Noise/Triangle）→ 振幅包络 ADSR（Attack/Decay/Sustain/Release）→ 频率调制（Slide、Vibrato、Change）→ 音色调制（Square Duty Sweep）→ 可选滤波（Lowpass/Highpass/Bandpass）→ 重触发（Repeat）。sfxr 的 Randomize 按钮是在预设参数空间内随机采样，保证物理合理性。tiny-dungeon 当前仅实现了波形+包络+简单滑音，是 sfxr 参数空间的子集。
