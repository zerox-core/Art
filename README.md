# Art — 自动化设计实验室

一个拥有设计判断、创作记忆和自我纠错能力的自动化数字设计实验室。

每天产出三版设计——**网页设计（V1）**、**手机应用 UI（V2·原生App与微信小程序交替）**、**交互组件实验室（V3·光标驱动的拟物化小组件）**。每版一件艺术品级单品，风格随机、不复制固定模板。

## Orchestrator 生产流水线

每件作品经过完整的 7 角色 Agent 流水线：

```
题目 → 理解 → 历史 → 创意竞争 → 方向选择 → Contract → 高质量实现
→ 真实浏览器 QA → 独立设计 Critic → 精准 Repair → Quality Gate
→ 只有真正合格的作品入库 → 更新长期设计记忆
```

| 角色 | 职责 | 协议文件 |
|------|------|---------|
| Orchestrator | 调度、状态管理、流程控制 | `agents/orchestrator-spec.md` |
| Art Director | 理解主题、产生 5 个创意方向、历史避重、生成 Design Contract | `agents/art_director.md` |
| Designer | 将 Contract 完整实现，完成视觉/交互/代码 | `agents/designer.md` |
| Browser QA | 客观事实检查（白屏、Error、布局、交互失效） | `agents/browser_qa.md` |
| Critic | 找出阻止作品成为优秀作品的具体原因 | `agents/critic/{web,phone,component}.md` |
| Quality Gate | 最终裁决：PASS / REPAIR / REJECT | `agents/quality_gate.md` |
| Memory Writer | 将最终设计转为结构化 Design Fingerprint | `agents/memory_writer.md` |

## 目录结构

```
Art/
├── agents/                  # 设计规则与 Agent 协议
│   ├── global.md            # 总控设计 Prompt（28 条全局原则）
│   ├── web.md               # 网页 Mock 设计 Prompt（48 条）
│   ├── phone.md             # 手机 Mock 设计 Prompt（35 条）
│   ├── component.md         # 组件/交互实验室 Prompt（17 条）
│   ├── art_director.md      # Art Director 输入输出协议
│   ├── designer.md          # Designer 输入输出协议
│   ├── orchestrator-spec.md # Orchestrator 完整设计规范（85 条）
│   ├── browser_qa.md       # Browser QA 检查范围与输出协议
│   ├── repair.md            # Repair Agent 策略与上限
│   ├── quality_gate.md     # Quality Gate 门槛与裁决逻辑
│   ├── memory_writer.md    # Memory Writer 指纹格式与 Pattern Stats
│   └── critic/
│       ├── web.md           # Web Critic 攻击重点
│       ├── phone.md        # Phone Critic 攻击重点
│       └── component.md    # Component Critic 攻击重点
├── memory/                  # 设计记忆
│   ├── web.json             # Web 设计指纹数组
│   ├── phone.json           # Phone 设计指纹数组
│   ├── component.json       # Component 设计指纹数组
│   ├── pattern_stats.json   # 模式使用统计（all_time/last_10/20/50）
│   └── decisions/           # 失败方向记录
├── runs/                    # 单次运行中间产物
│   └── <run_id>/
│       ├── run.json         # Run Manifest
│       ├── candidates.json  # 5 候选方向
│       ├── novelty.json     # 新颖性检查
│       ├── design_contract.md
│       ├── browser_qa_v1.json
│       ├── critic_v1.json
│       ├── repair_v1.json
│       ├── quality_gate.json
│       └── decision_log.json
├── web_mock/                # 网页设计作品
├── phone_mock/             # 手机应用 UI 作品
└── 组件/                    # 交互组件作品
```

## 作品子文件夹结构

```
<日期>_<中文名称>_<英文标识>/
├── index.html              # 浏览页（双击即可预览）
├── *.css / *.js            # 源码
├── 设计规范.md              # 设计规范文档
├── preview/                # 截图
│   └── *.png
├── assets/                 # 本地资源（如有）
└── README.md               # 单项介绍 + 截图 + 妙搭在线预览链接
```

## 设计原则

- **真实可交互**：非图片占位，所有控件可操作
- **动效符合逻辑**：物理模型 / 主题语义，禁整图缩放 Ken Burns
- **自定义光标**：开页即显示在屏幕中央，高对比，层级最高
- **禁蓝紫渐变**：三版配色互斥，每天随机重抽
- **健壮性红线**：零未定义引用、RAF 随可见性暂停且卸载取消、支持 `prefers-reduced-motion`
- **文案以中文为主**，少英文
- **V3 方向**：实用可复用 UI 组件（Toggle/Slider/Tabs/Modal/Toast/Pagination/Command Palette 等可直接搬到真实项目的界面积木）

## V2 形态交替

手机 Mock 在「原生 App」与「微信小程序」两种形态间逐次交替。

## 在线预览

每个子文件夹的 README 中保留了妙搭（Miaoda）在线预览链接。

## 调度

- 心跳调度器：间隔 20 分钟，ID `trigger_meta_4kqbbxzy82y5n`
- 单板块自动任务（每次只产出 1 件作品）：
  - V1 网页：`auto_4kvhdppjcnw4a`
  - V2 手机：`auto_4kvhdwd91xmsj`
  - V3 组件：`auto_4kvhdx843y005`
- 并行窗口：3 个（V1/V2/V3 各 1 个，每类最多 1 个在跑）
- 旧三合一任务 `auto_4kunaef1pp0a4` 已停用
- 心跳协调者负责：质检、修复、提交 GitHub、续派新任务
- 创作任务只负责产出 mock 和本地整理（不 push GitHub）

## 许可协议

本项目采用 [MIT License](LICENSE) 开源协议。

```
MIT License

Copyright (c) 2026 zerox-core
```

你可以自由地使用、复制、修改、合并、发布、分发、再授权及/或销售本软件的副本，唯一的要求是在所有副本或主要部分中保留上述版权声明与本许可声明。本软件按「原样」提供，不附带任何形式的明示或默示担保。