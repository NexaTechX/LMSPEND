export type Tool =
  | 'claude-code'
  | 'codex'
  | 'cursor'
  | 'cline'
  | 'roo-code'
  | 'gemini-cli'
  | 'aider'
  | 'opencode'
  | 'imported';

export interface UsageEvent {
  timestamp: string;
  tool: Tool;
  model: string;
  project: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  /** When the source tool already computed a cost, trust it over our pricing table. */
  costOverride?: number;
}

export interface ModelPricing {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

export interface PricingTable {
  updatedAt: string;
  models: Record<string, ModelPricing>;
  families: Record<string, ModelPricing>;
  fallback: ModelPricing;
}

export interface Adapter {
  tool: Tool;
  /** Human-readable status for `lmspend tools` */
  detect(): Promise<{ available: boolean; detail: string }>;
  /** Yield all usage events found on this machine. */
  collect(): AsyncGenerator<UsageEvent>;
}

export interface Aggregates {
  month: string;
  totalCost: number;
  prevMonthCost: number;
  byTool: Map<string, Bucket>;
  byModel: Map<string, Bucket>;
  byProject: Map<string, Bucket>;
  byDay: Map<string, Bucket>;
  skippedLines: number;
  approximatePricing: Set<string>;
}

export interface Bucket {
  cost: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  events: number;
}
