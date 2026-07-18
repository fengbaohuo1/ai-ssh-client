# 聊天消息布局設計：AI 無氣泡 + 步驟穿插

## 概述

重新設計 AI 聊天面板的消息佈局，讓 AI 回覆以「無氣泡」形式直接顯示，
步驟卡片按 `contentOffset` 穿插在文本對應位置，取代目前所有步驟堆在氣泡頂部的做法。

## 改動範圍

只涉及前端展示層（`AiChatMessage.tsx`），不影響後端 SSE 數據格式和 ChatContext 狀態管理。

## 設計方案 (方案 B)

### 用戶消息 (不變)

保持現有藍色氣泡、右對齊、`max-w-[85%]` 寬度限制。

### AI 消息 (核心改動)

| 層面 | 現狀 | 改後 |
|------|------|------|
| 外層容器 | `bg-[var(--surface-input)]` 圓角氣泡 | 無背景、無邊框、無 `max-width` |
| 文本 | 在氣泡內 | 全寬，無背景 |
| 步驟卡片 | 全部疊在氣泡頂部 | 按 `contentOffset` 穿插 |
| 消息間距 | `gap-3` （由父容器控制） | `gap-3` 不變，但消息之間可選分割線 |

### 穿插邏輯

1. 每條 AI 消息有一份 `steps[]`，每個 step 有 `contentOffset: number`（記錄此 step 對應的文本截斷位置）
2. 渲染時：將 `content` 按各 step 的 `contentOffset` 切割成 N+1 段，step 卡片穿插在對應段落之間
3. 最終效果：

```
段落 1 (content[0..offset1])
🔧 executeCommand  <-- 卡片
段落 2 (content[offset1..offset2])
✓ executeCommand  <-- 卡片
段落 3 (content[offset2..])
```

4. 每個段落獨立傳給 `ReactMarkdown` 渲染（避免 `\n\n` 跨段落干擾 Markdown 解析）
5. 無對應步驟的文本正常渲染

### 交互細節

- **步驟卡片**：保留現有可折疊樣式（`ToolCallItem`），只在無氣泡背景下顯示
- **時間戳**：AI 消息無氣泡後，時間戳改到消息底部左側，字號 `10px`，顏色 `text-tertiary`
- **Streaming 游標**：保留在最後一段文本末尾閃爍
- **錯誤狀態**：AI 消息如出錯，在消息底部顯示 `status-error` 文字

## 不作的事

- ❌ 不改 ChatContext / SSE 解析
- ❌ 不改後端
- ❌ 不改步驟卡片的 `ToolCallItem` 組件本體（只改其容器）

## 文件變更清單

| 文件 | 改動 |
|------|------|
| `src/components/chat/AiChatMessage.tsx` | 重構渲染：無氣泡 + 按 contentOffset 穿插步驟 |
| `src/components/chat/AiChatMessages.tsx` | 可能微調消息間距 / 添加分割線 |

## 驗收標準

1. AI 消息無背景色、無圓角邊框
2. 步驟卡片穿插在文本對應位置，而非全部堆在頂部
3. 每個文本段正常渲染 Markdown（表格、代碼塊等）
4. 用戶氣泡不受影響
5. 無迴歸：Streaming 游標、時間戳、錯誤狀態
