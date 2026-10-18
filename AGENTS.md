# AGENTS.md

## 项目概述

AI SSH Client — 基于 Tauri v2 的桌面端 SSH/AI 客户端。前端 React 19 + TypeScript + Tailwind CSS v4，后端 Rust。

## 技术栈总结文档

当需要撰写技术总结、对比分析、学习笔记时：
- 总结文档统一放到 `D:\docs\knowledge\` 目录下
- **本项目文档**放 `D:\docs\knowledge\ai-ssh\`
- 遵循 `D:\docs\AGENTS.md` 中的编写规则（一篇一主题、先查后写、互相引用、概念优先）
- 善用 Mermaid 图表辅助理解，能画图的不堆文字
- 文档命名用中文，简短描述主题

## 项目结构

```
ai-ssh-client/
├── src/                    # React 前端源码
│   ├── api/                # 后端契约（client / ssh / files / audit / system / chat / agentConfig）
│   ├── components/         # UI 组件
│   │   ├── chat/           # AI 对话、步骤轨迹
│   │   ├── files/          # IDE 文件树 / 文件管理器 / 预览弹窗 / 拖拽上传队列
│   │   ├── audit/          # 操作审计侧栏
│   │   ├── overview/       # 运维概览侧栏
│   │   ├── layout/         # Header / ActivityBar / LeftSidebar / StatusBar / CommandPalette
│   │   ├── ssh/            # 服务器列表、编辑弹窗
│   │   ├── settings/       # 外观 / 安全 / 快捷键 / 关于 / 模型配置 / Agent 配置
│   │   └── ui/             # Toast / PromptDialog 等通用件
│   ├── contexts/           # React Context（ChatContext, SshContext, TerminalContext）
│   ├── stores/             # Zustand（theme/layout/toast/security/fileExplorer）
│   ├── BackendGate.tsx     # 桌面端启动闸门（等待本地后端 ready 再渲染）
│   └── index.css           # 主题 CSS 变量 + 全局动画 / 滚动条
├── scripts/
│   └── bundle-backend.ps1  # 打包后端 jar + jlink 精简 JRE（ASCII-only：PS 5.1 按 ANSI 读脚本）
├── src-tauri/              # Rust 后端（tauri.conf.json 需保持 dragDropEnabled=false）
│   ├── src/                # lib.rs（窗口/单实例/dev 端口）+ backend.rs（本地 sidecar 生命周期）
│   ├── resources/          # 打包产物：backend/ai-ssh-server-app.jar、jre/（git-ignored，只留 .gitkeep）
│   └── Cargo.toml
├── index.html              # 入口 HTML
└── package.json
```

## 桌面端运行形态（v3）

- **本地 sidecar**：`src-tauri/src/backend.rs` 负责生命周期——release 从 resource 目录取 `jre/bin/java` + `backend/ai-ssh-server-app.jar`，随机空闲端口启动 Spring Boot（`--spring.profiles.active=local`、只监听 `127.0.0.1`、`AI_SSH_HOME` 指向 `%APPDATA%\jianingfei.site.aissh`），健康检查校验 body `status=UP` 后把 baseUrl 交给前端；启动失败把日志尾部交给启动页；退出 `taskkill /T /F`；单实例插件避免双开抢 H2 文件锁；`starting` CAS 防止重试并发拉起多个 Java。
- **启动闸门**：`components/BackendGate.tsx` 在 Tauri 运行时轮询 `backend_info`，ready 后 `setApiBase(baseUrl)` 再渲染 App；纯浏览器开发直接放行。
- **API 基址**：`api/client.ts` 的 `BASE_URL`（`setApiBase/getApiBase`）是唯一出口，所有 REST / 上传 / 下载 / WS 运行期取它，禁止硬编码端口。
- **打包**：`scripts/bundle-backend.ps1`（Maven + jlink，`ALL-MODULE-PATH`）产出 jar 与约 78 MB JRE；`npm run backend:bundle` / `npm run desktop:build`；`tauri.conf.json` 的 `beforeBuildCommand` 已串上 bundle。
- **配置页**：设置 → 模型（`ModelSettings.tsx`，写后端 `llm.yml` 覆盖层，API Key 只写不回显）/ Agent 配置（`AgentConfigEditor.tsx`，直接编辑 `agent.yml`，后端校验 + `.bak` 备份）；接口封装在 `api/agentConfig.ts`。保存成功后后端立即热重装智能体，**无需重启**；返回 `applied=false` 时前端提示失败原因（旧装配继续服务）。
- **智能体能力展示（v3.2 同步）**：`api/chat.ts` 的 `AgentRoleInfo` 增加 `delegateMode`（`hybrid` / `dispatch-only` / null）；`components/config/AgentConfigSidebar.tsx` 角色卡片据此显示「可直连 / 仅派发」徽标（hybrid=可直接执行命令+可派发，dispatch-only=父智能体不持有 executeCommand），只读徽标补充"executeCommand 会拦截写操作"的说明。后端工具语义变化（`AgentServiceController#toolsFor`）时必须同步这里。

## 关键设计决策

- **VS Code 风格布局**：ActivityBar + 左侧栏（概览/服务器/远程文件/历史/审计/AI 配置）+ 终端 + AI 面板 + 底部状态栏，allotment 分屏
- **主题系统**：CSS 自定义属性 `var(--xxx)`，通过 `data-theme` 切换；新增 `--surface-elevated`、`--shadow-*`、`--radius-*`、`--accent-gradient`，组件只用变量，不写死颜色
- **状态管理**：Zustand 管全局（主题、布局、Toast、安全设置、文件管理器开关），Context + useReducer 管领域（SSH、终端、聊天）
- **API 层**：`api/client.ts` 统一注入 `X-User-Id` 与可选 `X-AI-SSH-Token`，封装 GET/POST/PUT/DELETE、multipart 上传（含 XHR 进度）与带文件名解析的下载
- **文件树**：`FileTree` + `useFileTree` 懒加载/缓存/展开；由 `FileTreeSidebar`（左侧常驻）与 `FileExplorer`（左树右列表）复用。树只负责浏览、拖放接收与右键动作，写操作仍通过父组件调用统一领域服务
- **拖拽上传 / 移动**：`dndUpload.ts` 将 `DataTransfer` 递归展开（文件夹保留相对目录），用 `mkdir` 补齐远端目录后逐个上传；远程节点拖拽使用私有 MIME `application/x-ai-ssh-path`，落到目录节点后走 `rename` 完成移动，前端预校验 + 后端二次校验（自身/子目录、目标已存在）
- **删除**：`DeletePathDialog` 为树/列表共用，目录需显式勾选递归；删除/移动成功后刷新树与列表，并同步校正当前浏览路径
- **预览**：`FilePreviewDialog` 为树/列表共用预览编辑弹窗
- **Tauri 拖放**：`src-tauri/tauri.conf.json` 明确 `"dragDropEnabled": false`，否则桌面端系统拖入会被 Tauri 原生事件拦截，HTML5 `drop` 不触发
- **命令面板**：`Ctrl/⌘ + K`，视图切换 / 服务器连接 / 打开文件 / 切主题 / 新建对话
- **服务器弹窗**：基础 / 高级 / 安全三页签；编辑模式凭证留空表示保持原值
- **滚动条**：`::-webkit-scrollbar` 样式写在 `index.html` 内联 `<style>` 中，绕过 Vite 构建处理
- **终端面板**：Allotment `proportionalLayout={false}` + `priority={LayoutPriority.High}`，隐藏侧栏时终端延申填充；连接失败支持就地重连
- **设置按钮**：位于 ActivityBar 最底部（`flex-1` 撑开），通过 `onOpenSettings` 回调提升状态到 MainLayout
