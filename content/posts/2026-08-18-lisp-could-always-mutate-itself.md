---
title: "Lisp 早就能改自己了，可它从来不会撤销"
post: 2026-08-18-lisp-could-always-mutate-itself.md
date: 2026-08-18T03:47:08+0800
tags: [lisp, llm, programming]
---

{{% panguSpacing %}}

Agent 跑起来需要一个环境：一组工具、一份记忆、一套上下文装配规则、一个控制循环、一层权限边界。这套东西现在叫 harness。第一代 harness 是死的——工具在启动时注册，记忆结构由框架规定，控制循环写在代码里。现在大家在探索 meta-harness：让 agent 在运行时修改自己的 harness，自己写新工具、自己改 prompt、自己调控制流。

看到这个的第一反应几乎是必然的：**这不就是 Lisp 吗**。homoiconicity、macro、first-class environment、CLOS MOP、image-based 热更新——"程序在运行时改自己"这件事，Lisp 在几十年前就做进了语言核心。所以问题似乎变成了：怎么把这两条线接上？

我花了一整个晚上跟 Gemini 辩这个命题，中途撞进了一篇刚放出来的论文，结论被彻底翻了一遍。最后收敛到的判断是：

> **Lisp 解决的是"如何无门槛地破坏性修改一个运行中的系统"。而 meta-harness 卡住的地方是"改完之后能不能干净地撤销"。这两件事看起来是一件事，其实完全不是。**

这篇文章讲这个区别，以及一个 TypeScript 框架是怎么把 Lisp 传统里的几样东西重新实现了一遍——有些实现得比 Lisp 更好，有些至今还是空白。

## Emacs 是四十年的反面实证

先说为什么"Lisp 早就做到了"这句话不成立。

Emacs 是这颗星球上运行时间最长的自修改系统。你可以在任何时刻 `eval` 一段代码覆盖掉任何核心函数，不用重启，改完立刻生效。从"能不能改自己"这个角度看，Emacs 是满分。

然后你装了一个第三方包，发现它有问题，想干净地卸载它。

Emacs 提供了 `unload-feature`。读一下它的官方文档，会发现这是一份非常诚实的失败清单：

> This command unloads the library that provided feature *feature*. It undefines all functions, macros, and variables defined in that library with `defun`, `defalias`, `defsubst`, `defmacro`, `defconst`, `defvar`, and `defcustom`.
>
> Before restoring the previous definitions, `unload-feature` runs `remove-hook` to remove functions defined by the library from certain hooks. These hooks include variables whose names end in '-hook' (or the deprecated suffix '-hooks'), plus those listed in `unload-feature-special-hooks`, as well as `auto-mode-alist`. **This is to prevent Emacs from ceasing to function because important hooks refer to functions that are no longer defined.**
>
> **If these measures are not sufficient to prevent malfunction**, a library can define an explicit unloader named *feature*`-unload-function`.

把这几句话拆开看，每一句都在承认同一件事：

1. **卸载是靠猜的**。它扫描 `load-history`，撤销那些通过标准 `def*` 形式定义的东西。但凡这个包用 `setq` 改了别人的全局变量、往某个 alist 里 `push` 了一项、`advice-add` 了一个函数——这些都不在 `def*` 的名单里。
2. **hook 清理是靠命名约定的**。它移除的是"名字以 `-hook` 结尾"的变量里的函数，外加一张硬编码的特殊 hook 白名单 `unload-feature-special-hooks`。一个 hook 只要没按这个命名约定起名，也不在白名单里，里面的函数就留在那儿了。
3. **文档明说这可能不够**（"If these measures are not sufficient to prevent malfunction"），于是把兜底责任推回给包作者：你自己写一个 `feature-unload-function` 吧。

第三条是最关键的。**撤销的正确性，在 Lisp 传统里从来是一种开发者纪律，不是系统性质。** 作者忘了写、写漏了、写错了，系统不会知道，你也不会知道——直到几小时后某个行为莫名其妙地不对了。

而且注意 `remove-hook` 那句话的动机：它清理 hook 不是为了"恢复原状"，而是为了**防止 Emacs 直接不能用**（因为重要的 hook 指向了已经不存在的函数）。这是在做损害控制，不是在做回滚。

人类遇到这种情况有个终极方案：重启 Emacs。丢掉的无非是几个 buffer 和一点撤销历史，可以接受。

**但自演化的 agent 没有这个方案。** 论文里那句话说得比我狠：

> even worse, a faulty self-modification can disable the very process needed to recover.

一次坏的自我修改，会搞死那个本来用来恢复它的进程。当 agent 改坏了自己的控制循环，那个负责"重启并恢复"的中枢，本身已经瘫了。

这就是"能改"和"能撤"的区别所在。Lisp 把前者做到了极致，后者一直是空的。

## 有人把这件事形式化了

那篇论文叫 [《A Programming Paradigm for Spatiotemporal Composability》](https://github.com/cordiverse/paper)，作者是 Yifan Shi、Wei Zhang、Tianyi Cui，北大 + DeepSeek-AI，2026 年 8 月 13 日的 draft。配套实现叫 **Cordis**，TypeScript 写的，MIT 协议。DeepSeek Harness（dsh）建在它上面——"everything is a plugin"那套说法就是从这儿来的。

它把动态组合拆成两个正交维度：

- **temporal composability**（时间可组合性）：一个组件被移除时，它装上去的所有副作用能被完整回滚。
- **spatial composability**（空间可组合性）：组件之间的依赖能被声明，并在依赖出现/消失/换身份时被响应式地重新解析。

对应的两个机制：

- **revertible effects**：每一次对 context 的变换都携带一个 inverse，runtime 追踪它，卸载时按 LIFO 顺序应用。
- **reactive coeffects**：context 每变一次，就按每个组件声明的 coeffect specification 通知它。

论文明说了自己的动机就是 self-evolving agent harness（§1.2.2），也明说了 OS 和容器只是 **coarse-grained workaround**（§1.2.3）——操作系统在进程粒度上给你 temporal，容器编排在服务粒度上给你 spatial，代价是每次重启丢掉所有进程内累积的状态：缓存、连接、在途计算。粒度对不上。

有意思的是 §6.4：论文承认这套范式是 **language-agnostic** 的，并且列出了宿主语言需要满足的最小条件：

- **temporal 要求**：闭包（inverse 必须能作为一个值被捕获，连同它要恢复的状态一起），以及运行时能引入/撤回模块（Node 的 module registry、`dlopen`/`dlclose`、wasm instance）。
- **spatial 要求**：类型层能表达依赖（Haskell typeclass、Rust trait、TS module augmentation），运行时能透明地中介访问（JS Proxy 或 Python 的 `__get__`），否则就退回 runtime reflection，牺牲类型安全。

看这个清单会有一种熟悉感：**一等公民的闭包、运行时重定义、透明拦截——这几样能力全都是 Lisp 传统的看家本领**。但论文最后选了 TypeScript，而且它需要的每一样，TS 都拿现成机制实现了。

下面逐条对照。

## 一、revertible effect：Lisp 有配对语义，但绑错了东西

看到"每个 effect 配一个 inverse"，Lisp 程序员会立刻想到 `unwind-protect`（Common Lisp）和 `dynamic-wind`（Scheme）。这些不就是几十年前就有的 before/after thunk 配对吗？

有意思的是，论文 §7.3 的 Related Work 把这个领域切成了四类：

- **stateful forward migration**：Erlang/OTP 的 `code_change/3`、webpack/Vite 的 HMR——**带着状态往前迁移，不回滚 effect**
- **developer-authored recovery**：OSGi、VSCode、saga 补偿、algebraic effect handlers、React `useEffect`——inverse 是一项 "unenforced duty"，忘了就静默泄漏
- **statically scoped reversal**：STM、可逆计算、Janus、RCCS、线性类型、RAII、Rust ownership——**作用域预先固定**
- **interposed reclamation**：Nooks 那种在内核接口上记录扩展获取了什么资源

**这四类里一个 Lisp 机制都没有。** 提了 Erlang，提了 React，提了 saga，就是没提 `unwind-protect`。

这不是疏漏，分类是准确的。关键差别在**触发时机绑定在什么上**：

```
;; unwind-protect：cleanup 绑定在调用栈帧上
(unwind-protect
    (do-something)      ; 栈帧建立
  (cleanup))            ; 栈帧一退出，立即触发
```

`unwind-protect` 和 `dynamic-wind` 的 cleanup 是由**调用栈退出**触发的。控制流一旦正常返回，或者通过 non-local jump 跳出这个块，清理代码立刻执行。

而 agent 需要的语义正好相反：**它装上一个新工具之后，这个修改必须在未来无数个独立的 turn、异步请求、控制循环里持续生效——绝不能在当前这个 turn 的栈退出时就自动撤回。** 撤回的时机是"这个组件被卸载了"，那是一个跟调用栈完全解耦的事件，可能发生在几千次调用之后。

所以 Cordis 的 inverse 不能挂在栈上，它必须是一个独立的、跨越时间的一等公民数据结构。看它的实现（Algorithm 1）：

```
function effect(ctx, callback)
    armed ← true
    task ← execute(callback, () ↦ armed)
    async function dispose()
        if not armed then return
        armed ← false
        recover ← await task
        recover()
    ctx.dispose ← dispose ∘ ctx.dispose
    return dispose
```

`ctx.dispose ← dispose ∘ ctx.dispose` 这一行是整个设计的核心：每个新的 inverse 被**前插**到父 context 的累加器上，于是回滚天然是 LIFO 顺序。而且子 effect 的 inverse 本身也是父 context 上的一个 effect——这个递归结构让整棵组件树的卸载能级联下去。

还有一个细节值得注意，`armed` 标志同时干了两件事：作为 guard 让进行中的迭代能在**步骤边界**停下来（部分回滚，只撤销已经执行的那部分），以及保证 `dispose` **最多只触发一次**。论文解释了为什么第二点是必须的：

> Firing twice would apply an inverse at a state no application of the effect produced, where nothing holds it to reverting anything.

在一个不是由该 effect 产生的状态上应用它的 inverse，没有任何东西能保证它撤销的是正确的东西。这是一个 Lisp 的 `unwind-protect` 从来不需要考虑的问题——因为栈帧只会退出一次。

**判断：Lisp 有配对语义，但它把配对绑在了词法作用域上。在 Lisp 里实现组件级的回滚，你同样得手写一套外部的 inverse 追踪表，语言本身帮不上忙。**

## 二、MOP 拦截：TS 的 Proxy 粒度更广

CLOS MOP 是 Lisp 世界里最接近"可编程运行时"的东西：`compute-applicable-methods` 可以改方法派发，`slot-value-using-class` 可以拦截槽位访问，`:before`/`:around`/`:after` 可以在方法调用前后织入逻辑。用来做 agent 的工具注册表拦截器（权限校验、沙盒包装、token 审计、结果写回记忆）看起来非常合适。

Cordis 用 JS Proxy 实现了同一件事（Algorithm 6）：

```
function resolve(ctx, key)
    fiber ← ctx.fiber
    repeat
        if key ∈ fiber.committed then return fiber.committed[key]
        if key ∈ fiber.inject then throw INACTIVE_ACCESS
        if fiber = root then throw UNDECLARED_ACCESS
        fiber ← fiber.parent.fiber
```

组件写 `ctx.someService` 就像访问一个普通属性，Proxy 的 `get` trap 拦下来，沿着 fiber 链向上走，在第一个 committed view 里绑定了这个 key 的 fiber 处返回。

这里有个设计比裸的 `ctx.get(key)` 讲究得多。论文自己点出了区别：

> `ctx.get(key)` is a lookup against the store that returns the bound value or nothing and never fails, whereas the proxy resolves against the accessing fiber's own view and enforces the coeffect specification 𝑑 at the point of use.

Proxy 解析的是**访问者自己的 view**，不是全局 store。这带来两个后果：

- **没声明的依赖直接抛错**（`UNDECLARED_ACCESS`）。论文 §6.3 说这在结构上等价于 capability-based security：`inject` 声明是能力请求，context proxy 是能力中介，而且因为声明是静态的，orchestrator 可以在**加载时**审查一个组件要什么权限，而不是等它运行时才发现。
- 组件在**自己被拆卸的过程中**仍然读得到那个触发拆卸的依赖（因为读的是已提交的 view 而非 store）。这是一个很微妙的性质——依赖消失导致你被卸载，但你在跑清理逻辑时还需要用那个依赖。

跟 CLOS MOP 比，两处差别：

| | CLOS MOP | JS Proxy |
|---|---|---|
| 拦截锚点 | class 层次与 generic function 派发 | 引用边界，任意属性读写 / 函数调用 / construct |
| 前提假设 | 系统由 class/method 元对象协议构成 | 无，任何对象都能包 |
| 撤销 | 需自己拆掉 method | revocable proxy，撤销后访问直接抛错 |
| 类型契约 | 动态类型，无静态依赖拓扑 | TS module augmentation，编译期可查 |

**revocable proxy 这一点在 agent 场景里价值不小**：撤销之后所有残留引用的访问立刻抛错，而不是继续指向一个僵尸对象。这正好对应了 Lisp 那边最难受的地方——`fmakunbound` 只能解绑符号，那些**已经被闭包捕获的旧函数指针、存在某个 hook 列表里的旧值**，一个都够不着。它们会继续正常工作，指向一份本该消失的实现。

**判断：这一格 TS 不只是"够用"，是确实做得更完整。**

## 三、continuation：generator 就够了，call/cc 是过度武装

这条是我在讨论里最坚持的一点，最后被论文正面驳回了。

我的论点是：agent harness 最痛的是**上下文分叉与回滚**——试一条路径失败了，正确做法是回到分叉点，而不是把失败堆进 context 继续污染后续推理。这在 Scheme 里就是 `call/cc`，是 Lisp 家族真正独有、其他语言学不来的东西。

论文里有一句话直接处理了这个：

> The 𝖬𝖺𝗒𝖻𝖾(𝔈iter) continuation makes a boundary available between any two consecutive iterations... In this sense the effect iterator is a **reified delimited continuation, the structure that mainstream languages expose through the yield operator**, so the model maps directly onto the generators they already provide.

它把 delimited continuation 落到了 **generator/yield** 上。组件的加载过程是一个 effect iterator，每次 `yield` 出一个 inverse，两次迭代之间就是一个天然的边界——在这个边界上 context 是"到目前为止的迭代所造成的样子"，累加器恰好能回滚这些、且只回滚这些。

关键在于**组件生命周期是 single-shot 的**：进入（yield effects）→ 逆向离开（run inverses）。它不需要 multi-shot——不需要从同一个点重新进入两次。而 generator 提供的正是 single-shot delimited continuation，`call/cc` 那种 multi-shot 的完全通用能力在这里是过度武装，代价是破坏整个调用栈模型。

那推理路径的分叉呢？那是**另一个问题**，不该混为一谈：

| | 组件装卸的回滚 | 推理路径的分叉 |
|---|---|---|
| 处理对象 | harness 自身结构（工具、依赖、权限） | message 列表与推理路径 |
| 机制 | revertible effect + inverse | 状态快照 / 树搜索 |
| 需要的语义 | single-shot（yield 够用） | multi-shot |
| 典型系统 | Cordis | Tree of Thoughts、LATS |

而推理分叉在 LLM 体系里的实质是**一个数组的浅拷贝**——message list 是纯数据，没有副作用，克隆一份就完成分叉了。真正需要 continuation 的从来不是这一层。至于跨进程崩溃的持久化恢复，工业界已经有 Temporal、Restate、DBOS 那套 durable execution：event sourcing + 确定性重放，同样不需要语言暴露 `call/cc`。

**判断：这一格 Lisp 输得比较彻底。它的优势是"完全通用的 multi-shot continuation"，而这个通用性在 agent 场景里没有对应的需求，代价却实打实。**

## 四、condition/restart：Cordis 主动放弃了这一层

前三条 Lisp 都没占到便宜。第四条反过来了。

Cordis 的失败语义在 §4.3.4，规则叫 L-Raise：

```
                  𝜃𝑛 = 𝖱𝖾𝗅𝗈𝖺𝖽𝗂𝗇𝗀(𝑖, 𝑔, 𝜔)   𝑖(𝛾) = 𝖫𝖾𝖿𝗍(𝜉)
                 ─────────────────────────────────────────── L-Raise
                     𝛾 ⟶ 𝛾[𝜃𝑛 ↦ 𝖴𝗇𝗅𝗈𝖺𝖽𝗂𝗇𝗀(𝑔, 𝜔, 𝜉)]
```

翻译成人话：组件激活过程中某一步抛错了，fiber 直接路由进 `Unloading`，把已经累积的 inverse 全部应用掉，最后停在 `Inactive(ξ)` 携带那个错误。而 `L-Begin` 的前提是 `Inactive(⊥)`——**所以一个失败的 fiber 不能从错误状态重新进入生命周期**。论文的措辞是：

> this is the substance of the outcome, which **withholds a fiber whose effect function has shown itself to be unsound in the state it ran against rather than retrying it against an unchanged environment**.

一个 effect function 已经在当前状态下证明了自己是 unsound 的，那就不要在环境没变的情况下重试它。

这个设计很干净，但它意味着 Cordis 的失败语义是**全量回滚 + 拒绝重入**，没有任何中间状态。

对比 Common Lisp 的 condition system。那套东西的核心不是"错误处理"，而是**把"报告错误"和"决定怎么办"这两件事分开，并且在决定之前不退栈**。底层函数 signal 一个 condition，同时用 `restart-case` 声明几个可能的恢复路径；栈上层的 handler 看到这个 condition，选一个 restart；然后**从出错的那个点原地继续**，栈从来没有被销毁过。

为什么这对 agent 特别重要，举个具体的例子：

> agent 挂载一个新技能，这个技能的初始化过程有 8 步。跑到第 6 步 `check_api_key` 时网络超时了。

Cordis 的行为：前 5 步做的所有事全部回滚，fiber 停在 FAILED，前面那些可能很昂贵的初始化工作（下载模型、建立连接、预热缓存）全部作废。

agent 真正想要的行为：**挂起在第 6 步**，把"API key 校验超时"这个 condition 连同几个 restart 选项（`use-backup-key`、`retry-once`、`skip-and-degrade`）一起交给上层的 meta-agent，让它决定，然后**从第 6 步继续往下走**。

这个差别在 agent 场景里被放大了，因为**回滚的代价不只是重算，还有上下文**。agent 每次重来一遍，失败的轨迹会堆进 context，token 烧掉了，而且下一轮推理还会被那些失败轨迹污染。

Cordis 为什么不做？我认为这是**为形式化定理付的代价，不是疏忽**。它的 metatheory 要证 confluence 和 progress，而这两个定理都依赖于一个事实：所有的 outcome 只能经由 `L-Unload` 到达（论文原话："Routing a failure like every other deactivation is what makes every outcome reachable only through L-Unload, which is the single fact Theorem 59 turns on"）。如果允许在 L-Raise 时不退栈、向外层暴露任意的 restart 闭包，状态机的变迁就变成非确定的了，所有关于 effect 生命周期成对映射的证明会一起崩掉。

**判断：这是真空白。condition/restart 那套"不退栈的错误协商"语义，在 Cordis 里明确缺席，而 agent 确实需要它。谁想补，得在 Cordis 的状态机之外单独建一张挂起-恢复网。**

## 五、CLOS 的实例迁移协议：至今没有对手

第二个空白，也是我觉得最被低估的一个。

设想这个场景：**agent 决定改自己长程记忆的数据结构**。比如原来记忆条目是 `{content, timestamp}`，现在它要加一个 `embedding` 字段，同时把 `timestamp` 从字符串改成结构化的时间对象。

代码好改。问题是：**内存里已经存在的那几万条旧结构怎么办？**

TypeScript/Cordis 的答案是丢弃重建——组件卸载时 inverse 跑一遍，新组件从干净状态重新装载。论文自己承认了这点：

> Cordis reverts the old component's tracked effects and reapplies the new component's from a clean slate, so a component's own in-memory state does not survive a reload unless placed in a longer-lived dependency, and layering DSU-style forward migration atop revertible effects is future work.

组件自己的内存状态不会挺过一次重载，除非你把它放进一个生命周期更长的依赖里。而 DSU 式的向前迁移，论文明说是 future work。

Common Lisp 在 1988 年就把这个问题解决了。当一个类被重新定义时，CLOS 会自动对内存中所有现存实例调用 `update-instance-for-redefined-class`。看它的签名：

```lisp
update-instance-for-redefined-class
    instance added-slots discarded-slots property-list &rest initargs
```

关键是 `property-list` 这个参数。CLHS 的原文：

> When `make-instances-obsolete` is invoked or when a class has been redefined and an instance is being updated, **a property-list is created that captures the slot names and values of all the discarded-slots with values in the original instance**. The structure of the instance is transformed so that it conforms to the current class definition.

被删掉的槽位的**值**被抢救出来，装在 property-list 里交给你。于是你可以写一个方法，把旧数据转换成新表示：

```lisp
(defmethod update-instance-for-redefined-class :before
    ((pos x-y-position) added deleted plist &key)
  ;; Transform the x-y coordinates to polar coordinates
  ;; and store into the new slots.
  (let ((x (getf plist 'x))
        (y (getf plist 'y)))
    (setf (position-rho pos) (sqrt (+ (* x x) (* y y)))
          (position-theta pos) (atan y x))))
```

写完这个方法，然后重新 `defclass` 把 `x`/`y` 槽换成 `rho`/`theta`——**内存中所有旧实例会自动迁移**，笛卡尔坐标被算成极坐标存进新槽位。规范里那句注释说得很清楚："All instances of the old x-y-position class will be updated automatically."

这套机制有三个性质在今天看依然罕见：

1. **惰性且自动**。你不需要遍历所有实例，也不需要知道它们在哪儿。运行时在实例被访问时拦截并迁移。
2. **旧值被保留而非丢弃**。`property-list` 让迁移逻辑能读到被删槽位的原始值——这是"迁移"和"重建"的分水岭。
3. **迁移逻辑是一个普通方法**，可以用 `:before`/`:after`/`:around` 组合，可以按类分派。

回到 agent 场景：一个能改自己记忆 schema 的 agent，恰恰最需要这个。因为**记忆是那个绝对不能丢的东西**——你可以重建工具注册表、重建连接池，但你不能把 agent 积累的记忆倒掉重来。

**判断：这一格 Lisp 至今没有对手。TS/Cordis 完全没涉及，论文自己标为 future work。**

## 汇总

| | 状态 |
|---|---|
| revertible effect + reactive coeffect | Cordis 已实现（TS）。Lisp 的 `unwind-protect` 绑在栈帧上，不构成先例 |
| MOP 拦截契约 | TS Proxy 覆盖，且粒度更广（任意属性 + revocable + 静态类型契约） |
| continuation 分叉 | generator/yield 的 single-shot 已足够；推理分叉只是数组浅拷贝 |
| **condition/restart 的原地挂起协商** | **真空白**——Cordis 为 metatheory 主动放弃 |
| **CLOS `update-instance-for-redefined-class`** | **真空白**——agent 改自己记忆 schema 时，旧实例只能丢弃重建 |

所以最后的结论是**借其神，弃其形**：不要用 Lisp 写 agent，但要把它沉淀的语义搬到现代运行时上。而这张表更有意思的地方在于，**前三行已经被工业界兑现了，Lisp 剩下的全部价值集中在后两行**——都是"出事的时候和改结构的时候，怎么不丢现场地过渡"。

## 但还有两件事没人解决

写到这里必须补充：上面这张表全部是关于 **harness 内部**的。而 agent 最可怕的错误全都在 harness 外面。

**第一，Cordis 保护的是脚手架，不是世界。**

论文 §6.1 用 system boundary 划了条线：boundary 内的位置能被独占修改和恢复，操作被追踪；boundary 外的操作直接是 `idΓ`——既不追踪也不恢复。而 agent 干的那些真正危险的事——发出去的邮件、merge 掉的 PR、花掉的钱、污染的生产数据库、发给用户的消息——**一件不落全在 boundary 外面**。

论文对此给了两条路：**withhold**（把输出压住，等状态确定持久化了再发，即 output commit problem）或者 **compensate**（补偿，删掉已创建的文件、退掉已收的款）。但它也诚实地指出，补偿只能恢复到"应用自己定义的某种等价"，比形式化的 `≃` 粗得多，而且整套 metatheory 的交换性证明是对 `≃` 做的，**换成粗粒度的等价关系后需要重新证明**。

所以媒体上那句"DeepSeek Harness 杀死了 agent 黑箱"是过度包装了。它让 agent 改坏自己时宿主进程不至于崩，这很有价值，但它挡不住 agent 把生产库删了。

**第二，inverse 的正确性没有人保证——这才是真正的坑。**

论文的核心卖点是"完整恢复是系统的不变量，而不是开发者的纪律"。但这个承诺有个前提，论文自己在 §5.1.1 交代得非常清楚：

> What the operation does not check is the witness that 𝔈Γ∗ carries: the callback supplies an inverse, and **that the inverse recovers the effect it accompanies is an obligation on the component author rather than a property the runtime verifies**.

inverse 真的撤销了对应的 effect——这是**组件作者的义务，不是 runtime 验证的性质**。

Theorem 61（Recovery exactness）证明的是：应用累加器得到的状态，等于那些步骤从起点出发本来会产生的状态。这是**结构层**的保证——"执行了 A，卸载时一定会执行 Inverse(A)，顺序正确，只执行一次"。它不是**语义层**的保证——"Inverse(A) 真的抹掉了 A 的影响"。

人类写组件时，这个义务是合理的。但 meta-harness 的前提是 **agent 自己生成组件**。于是：

```javascript
{
  do:   () => exec("rm -rf /data"),
  undo: () => console.log("restored")
}
```

**在 Cordis 的状态机看来，这个组件的生命周期完美闭环。** 装载时执行了 effect，卸载时执行了 inverse，LIFO 顺序正确，没有泄漏，所有定理都成立。数据没了。

这是让囚犯自己写赦免状。

而且它比"没有回滚机制"更危险，因为**你以为已经回滚干净了**。没有回滚机制时你至少知道自己在裸奔，会去做快照、会小心；有一个假的回滚保证时，你会基于它去做更激进的自我修改。

我们在讨论里推出过一个结论：任何能自改的系统都必须有一个不可被 agent 修改的固定点。Schmidhuber 的 Gödel machine 里，那个固定点是效用函数和证明检查器——如果证明检查器能改自己，系统第一步就会证明"把效用设成无穷大是最优策略"。我们原本以为在 agent harness 里，这个固定点是评价器和沙盒那一层。

**现在看它其实还要更低一层：基础 atomic effect 的 inverse 必须由人类预定义并冻结。** agent 只能**组合**这些安全原语来构造复合组件（论文说了，复合的 inverse 由组合自动导出，只有 atomic 的需要手写）——但它不能自己发明一个带副作用的新原语，再自己给它配一个 undo。

Gödel machine 的 proof checker 问题，换了个位置又出现了一次。

## 所以这个直觉应该怎么修正

回到最开始那句"Lisp 早就做到了"。

它不对，但它错的方式很有价值。准确的表述是：

> **Lisp 几十年前解决的是"如何无门槛地破坏性修改一个运行中的系统"（unconstrained runtime mutation）。而 meta-harness 真正需要的是"如何让每一次自我修改都携带确定性的逆操作，并在撤销时不破坏依赖拓扑"（governed composability）。Lisp 从未在系统层面内建后者，它反而为状态污染大开了方便之门。**

Lisp 给的是无限的**可写**。它没给**可撤**，也没给**依赖治理**。Emacs 用四十年证明了：光有前者，你会得到一个谁也不敢干净卸载任何东西的系统。

而在 meta-harness 这条路上，Lisp 剩下的价值不在语言，在它留下的两个至今没被工业界兑现的语义——**condition/restart 的原地挂起协商**，和 **CLOS 的实例重定义迁移协议**。

它们恰好都在同一个位置上：**出事的时候，和改结构的时候，怎么不丢现场地过渡。**

这也正是一个会自我修改的系统最脆弱的两个时刻。

---

*论文：[A Programming Paradigm for Spatiotemporal Composability](https://github.com/cordiverse/paper)（Shi, Zhang, Cui；北大 + DeepSeek-AI，2026-08-13 draft）。实现：[cordiverse/cordis](https://github.com/cordiverse/cordis)。Emacs 卸载语义引自 [GNU Emacs Lisp Reference Manual §16.9](https://www.gnu.org/software/emacs/manual/html_node/elisp/Unloading.html)，CLOS 协议引自 [CLHS: UPDATE-INSTANCE-FOR-REDEFINED-CLASS](https://www.lispworks.com/documentation/HyperSpec/Body/f_upda_1.htm)。*

{{% /panguSpacing %}}
