/** 生成局部唯一 ID（与 ChatContext.generateId 同规则） */
export function generateLocalId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}
