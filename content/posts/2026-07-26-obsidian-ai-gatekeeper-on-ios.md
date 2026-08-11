---
title: "从 Mac mini 到 iPhone：把 Obsidian AI 守门员迁到 Open Minis 的完整实践"
post: 2026-07-26-obsidian-ai-gatekeeper-on-ios.md
date: 2026-08-11T07:01:56+0800
draft: false
tags: [ios, llm, python]
---

{{% panguSpacing %}}

我的 Obsidian 知识库靠一个"AI 守门员"（Obsidian Gatekeeper）打理：新笔记自动分类、打标签、提炼概念（High-Order Notes / HON），以及做语义检索。这套系统最初跑在一台远程 Mac mini 上——Node.js 服务 + better-sqlite3 + sqlite-vec 向量扩展，手机端每次整理都要跨网络调它。

好用，但有代价。后来我把整条链路搬进了 iPhone 上的 Open Minis——一个内置 iSH（Alpine Linux）终端环境的 AI 助手 App：原生编译向量扩展、用纯 Python 标准库写检索工具、把守门员规则注册进 Agent 技能系统让新会话也能自动识别。本文记录这次迁移的完整路径，分三步走，你可以在自己的设备上照着复现。

## 为什么迁：远程守门员的三个痛点

旧架构的核心问题，一句话概括：**知识库的日常操作绑在了一台你不一定带在身边的服务器上**。具体拆开是三点：

1. **网络与设备依赖**：离线或弱网（出行、飞机上）守门员直接断连；
2. **运维成本**：Mac mini 的守护进程、端口转发和 SSH 凭据维护，每一项都是持续要管的负担；
3. **响应延迟**：每次手机端发起整理或检索，都要跨网络走一趟 RPC 或 SSH。

迁移目标很明确：**Local-First**——笔记整理、向量计算、数据库查询全部在 iOS 本地完成，不再依赖任何远程基础设施。

## 新旧架构对比

```
[ 旧架构 (远程) ]
iOS (Obsidian / Agent) ---> [ SSH / Network ] ---> Mac mini (Node.js + better-sqlite3 + sqlite-vec)

[ 新架构 (iOS 本地原生) ]
iOS (Open Minis / iSH Shell)
├── Local Vault Mount (/var/minis/mounts/onote-neo-main)
├── Persistent Shared (/var/minis/shared/ -> vault.db + vec0.so)
└── Skill Protocol (/var/minis/skills/obsidian-gatekeeper/)
```

变的是服务端的位置：从"远程 Mac mini"换成"Open Minis 内置的本地 iSH 沙盒"；不变的是数据层：SQLite + 向量检索这套逻辑原样保留，只是换了宿主。

## 前置条件

动手之前需要准备齐这些：

- 一台 iOS 设备，装好 [Open Minis](https://github.com/OpenMinis/OpenMinis)——App 内置 iSH（Alpine Linux）终端环境，向量扩展、Python 工具都跑在它里面；
- Obsidian vault 通过 iOS「文件」App 挂载到 `/var/minis/mounts/` 下；
- 一个 Google Cloud 项目，开通 Vertex AI 上的 Gemini Embedding API，用 ADC（Application Default Credentials）拿到 OAuth 凭据（`user-adc.json`）；
- 知识库的向量数据已生成：笔记的 embedding 存在 `vault.db` 的 `vec_notes` 表里，随数据库文件一起迁移过来。

## 第一步：在 Open Minis 的终端里原生编译 sqlite-vec

**问题**：`sqlite-vec` 官方 Release 没有 `aarch64-unknown-linux-musl` 的预编译包——这正是 iOS 上 Alpine Linux 的目标平台。装不上现成的，只能本地编译。

**做法**：装好工具链，用 clang 直接把 C 源码编成共享库：

```bash
# 安装基础编译环境
apk add gcc musl-dev clang sqlite-dev

# 下载 sqlite-vec 源码并编译为动态库 vec0.so
clang -fPIC -shared -O3 \
  -D_GNU_SOURCE \
  sqlite-vec.c \
  -o /var/minis/shared/vec0.so
```

**关键点**：musl 和 glibc 的头文件定义有差异，编译过程中需要对 musl 做针对性微调。产物是一个原生 `vec0.so` 动态链接库，之后由 Python 的 `sqlite3` 模块直接 `load_extension` 加载——移动端本地执行的 C 向量扩展，没有中间层。

## 第二步：用纯 Python 标准库写零依赖 RAG 引擎

**问题**：Node.js 及 npm 的依赖树太重，不想在手机沙盒里维护一套 `node_modules`。

**做法**：Python 3 标准库 + 内置 `sqlite3` 写一个轻量 CLI 工具 `vault_tool.py`，只做三件事：

1. **动态加载向量扩展**：直接加载上一步编译好的 `vec0.so`；
2. **凭据与 Embeddings 接入**：用 Google Cloud ADC OAuth 2.0 凭据调用 `gemini-embedding-2`（3072 维向量）；
3. **KNN 语义检索**：在 SQLite 内直接执行向量距离矩阵计算。

```python
import sqlite3
import json
import urllib.request

# 1. 初始化 SQLite 数据库并加载本地 C 向量扩展
def get_db_connection():
    conn = sqlite3.connect('/var/minis/shared/vault.db')
    conn.enable_load_extension(True)
    conn.load_extension('/var/minis/shared/vec0.so')
    return conn

# 2. 调用 Gemini Embedding API 生成 3072 维向量
def get_embedding(text, access_token):
    url = "https://europe-west1-aiplatform.googleapis.com/v1/projects/afk-blog/locations/eu/publishers/google/models/gemini-embedding-2:predict"
    req = urllib.request.Request(
        url,
        data=json.dumps({"instances": [{"content": text}]}).encode('utf-8'),
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }
    )
    with urllib.request.urlopen(req) as resp:
        res = json.loads(resp.read().decode('utf-8'))
        return res['predictions'][0]['embedding']['values']

# 3. 在 SQLite 中执行向量 KNN 相似度检索
def search_similar_notes(query_vector, limit=5):
    conn = get_db_connection()
    cursor = conn.cursor()

    # 使用 sqlite-vec 提供的 vec_distance_cosine 函数
    query = """
    SELECT rowid, vec_distance_cosine(embedding, ?) as distance
    FROM vec_notes
    ORDER BY distance ASC
    LIMIT ?
    """
    cursor.execute(query, (json.dumps(query_vector), limit))
    return cursor.fetchall()
```

三个函数的职责边界很干净：`get_db_connection` 是纯本地的（数据库和扩展都在设备上）；`get_embedding` 是整条链路里**唯一联网**的一步，把查询文本变成 3072 维向量；`search_similar_notes` 回到本地，用余弦距离排序取 top-k。全部依赖只有 Python 标准库 + 一个 C 扩展，零第三方包。

## 第三步：把守门员注册进 Agent 技能系统

**问题**：手机端的 AI 助手（Open Minis）每次新开对话都是一个全新上下文，怎么保证它依然认识 vault 的守门员规则、知道去哪找数据库？

**做法**：跨会话持久化 + 显式的文件系统划分。

1. **Skill 自动化挂载**：把守门员协议写成 `SKILL.md`，放进 `/var/minis/skills/obsidian-gatekeeper/`。每次启动新会话，Open Minis 系统会自动扫描并注册该技能，规则随会话常驻。
2. **共享文件系统划分**：
   - `/var/minis/mounts/onote-neo-main/`：通过 iOS「文件」挂载的本地 Obsidian 知识库；
   - `/var/minis/shared/`：持久化存放 `vault.db`（向量数据库）、`vec0.so`（C 动态库）、`user-adc.json`（认证凭据）和 `vault_tool.py`。

这样 Agent 在任何新会话里都能定位工具链和规则，跨会话、跨重启都有效。

## 实测效果

迁移完成后的日常体验：

- **秒级响应**：本地扫描 vault 里数百篇笔记及 HON 概念节点，没有网络传输等待；
- **无服务器依赖**：Mac mini 挂掉、IP 变动、SSH 断连——这些曾经的真实事故，现在都与我无关了；
- **无缝交互**：在手机上随口一句"帮我把这段想法归档并检查是否有重复的 HON 笔记"，Agent 自动执行语义向量搜索、计算余弦相似度，直接更新挂载的 md 文件。

## 边界：说说"完全本地"到底本地在哪

这里需要诚实一点。迁移去掉了 Mac mini，但整条链路里**仍有一环必须联网**：embedding 由 Google 的 `gemini-embedding-2` API 生成（就是第二步的 `get_embedding`）。真正 100% 本地的是：

- **向量检索**：sqlite-vec 的 KNN 计算，全本地执行；
- **文件读写**：挂载的 vault 直接操作，不走网络；
- **规则与协议**：SKILL.md 技能注册，本地常驻。

所以准确的说法是：**基础设施完全本地化，embedding 生成用的是云端 API**。需要说明的是，向量生成这一步本地化**完全可行**——在移动端跑一个量化的本地 embedding 模型（比如小型 sentence-encoder），就能把最后这一环也收回来，实现真正完全离线。我只是目前选择了 Google 的云端模型，没有做本地化。这是取舍，不是技术限制。

## 结语

这次迁移最大的收获，不是"在手机上跑通了 RAG"，而是验证了一个可以复用的极简组合：

> **C 动态库（原生性能）+ Python 标准库（零依赖）+ 本地文件挂载（数据就近）+ 结构化 Skill 协议（Agent 可发现）**

移动端的 Linux 沙盒早已不是玩具：Open Minis 内置的 iSH 沙盒里的 Alpine，足够原生编译 C 扩展、跑完整的 SQLite、支撑一个每天都在用的 AI 工作流。去掉远程中间件之后，架构变简单了，系统反而更可靠——这大概就是 Local-First 的真正收益。

{{% /panguSpacing %}}
