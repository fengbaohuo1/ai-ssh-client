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
│   ├── components/         # UI 组件（chat/ layout/ settings/ terminal/ ssh/）
│   ├── contexts/           # React Context（ChatContext, SshContext, TerminalContext）
│   ├── stores/             # Zustand 全局状态（themeStore, layoutStore）
│   └── index.css           # 主题 CSS 变量定义
├── src-tauri/              # Rust 后端
│   ├── src/                # lib.rs + main.rs
│   └── Cargo.toml
├── index.html              # 入口 HTML（含内联滚动条样式）
└── package.json
```

## 关键设计决策

- **VS Code 风格布局**：ActivityBar + 左侧栏 + 终端 + AI 面板，allotment 分屏
- **主题系统**：CSS 自定义属性 `var(--xxx)`，通过 `data-theme` 属性切换，暗色/亮色各一套
- **滚动条**：`::-webkit-scrollbar` 样式写在 `index.html` 内联 `<style>` 中，绕过 Vite 构建处理
- **终端面板**：Allotment `proportionalLayout={false}` + `priority={LayoutPriority.High}`，隐藏侧栏时终端延申填充
- **状态管理**：Zustand 管理全局（主题、布局），Context + useReducer 管理领域（SSH、终端、聊天）
- **设置按钮**：位于 ActivityBar 最底部（`flex-1` 撑开），通过 `onOpenSettings` 回调提升状态到 MainLayout
