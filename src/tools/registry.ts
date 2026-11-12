export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  href: string;
  category: string;
}

// 実装済みのツールのみ登録する。追加手順は README.md を参照。
export const tools: readonly ToolDefinition[] = [];
