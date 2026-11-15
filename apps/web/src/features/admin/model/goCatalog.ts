/**
 * Snapshot tĩnh của catalog OpenCode Go (provider id `opencode-go`, built-in của
 * `@earendil-works/pi-ai`, các endpoint `https://opencode.ai/inference/go/...`).
 *
 * Sinh bởi `bun apps/web/scripts/sync-go-catalog.mjs` từ `opencode-go.json` của SDK đã pin
 * (xem script đó để biết cách chạy lại sau khi SDK đổi version). KHÔNG sửa tay.
 *
 * Free ($0/MTok) models bị loại có chủ ý: Go chỉ dành cho OpenCode client, client ngoài bị 403 —
 * Sky là client ngoài nên chỉ dùng paid models.
 *
 * Nguồn: /home/keios/repos/mein/nsac-agent-go-models/node_modules/.bun/@earendil-works+pi-coding-agent@1.5.2+e409bf73c56f80fb/node_modules/@earendil-works/pi-ai/dist/providers/data/opencode-go.json
 * Models: 29 (free models excluded).
 */
export type GoCatalogModel = {
  id: string;
  name: string;
  /** USD per MTok input. */
  inputCostPerMTok: number;
  /** USD per MTok output. */
  outputCostPerMTok: number;
  contextWindow: number;
  maxTokens: number;
};

export const GO_CATALOG: readonly GoCatalogModel[] = [
  { id: "claude-haiku-5-5", name: "Claude Haiku 5.5", inputCostPerMTok: 0.1, outputCostPerMTok: 0.5, contextWindow: 1000000, maxTokens: 128000 },
  { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", inputCostPerMTok: 0.66, outputCostPerMTok: 1.98, contextWindow: 1000000, maxTokens: 384000 },
  { id: "deepseek-v4.1-flash", name: "DeepSeek V4.1 Flash", inputCostPerMTok: 0.15, outputCostPerMTok: 0.6, contextWindow: 1000000, maxTokens: 384000 },
  { id: "gemini-4-argon", name: "Gemini 4 Argon", inputCostPerMTok: 2, outputCostPerMTok: 10, contextWindow: 1048576, maxTokens: 65536 },
  { id: "glm-5.2", name: "GLM-5.2", inputCostPerMTok: 1.4, outputCostPerMTok: 4.4, contextWindow: 1000000, maxTokens: 131072 },
  { id: "glm-5.3", name: "GLM-5.3", inputCostPerMTok: 1.4, outputCostPerMTok: 4.4, contextWindow: 1000000, maxTokens: 131072 },
  { id: "glm-5.3-flash", name: "GLM-5.3-Flash", inputCostPerMTok: 0.15, outputCostPerMTok: 0.5, contextWindow: 1000000, maxTokens: 131072 },
  { id: "gpt-5.6-luna", name: "GPT-5.6 Luna", inputCostPerMTok: 0.2, outputCostPerMTok: 1.2, contextWindow: 1050000, maxTokens: 128000 },
  { id: "gpt-6-luna", name: "GPT-6 Luna", inputCostPerMTok: 0.1, outputCostPerMTok: 0.5, contextWindow: 1050000, maxTokens: 128000 },
  { id: "grok-4.7", name: "Grok 4.7", inputCostPerMTok: 2, outputCostPerMTok: 6, contextWindow: 500000, maxTokens: 500000 },
  { id: "hy3", name: "Hy3", inputCostPerMTok: 0.14, outputCostPerMTok: 0.58, contextWindow: 256000, maxTokens: 128000 },
  { id: "hy4", name: "Hy4", inputCostPerMTok: 0.834, outputCostPerMTok: 2.501, contextWindow: 1048576, maxTokens: 65536 },
  { id: "hy4-preview", name: "Hy4 preview", inputCostPerMTok: 0.834, outputCostPerMTok: 2.501, contextWindow: 1024000, maxTokens: 64000 },
  { id: "kimi-k2.7-code", name: "Kimi K2.7 Code", inputCostPerMTok: 0.95, outputCostPerMTok: 4, contextWindow: 262144, maxTokens: 262144 },
  { id: "kimi-k3", name: "Kimi K3", inputCostPerMTok: 3, outputCostPerMTok: 15, contextWindow: 1048576, maxTokens: 131072 },
  { id: "kimi-k3.1-pro", name: "Kimi K3.1 Pro", inputCostPerMTok: 2, outputCostPerMTok: 10, contextWindow: 1048576, maxTokens: 131072 },
  { id: "longcat-2.0", name: "LongCat-2.0", inputCostPerMTok: 0.3, outputCostPerMTok: 1.2, contextWindow: 1000000, maxTokens: 131072 },
  { id: "mimo-v2.5", name: "MiMo V2.5", inputCostPerMTok: 0.14, outputCostPerMTok: 0.28, contextWindow: 1000000, maxTokens: 128000 },
  { id: "mimo-v2.5-pro", name: "MiMo V2.5 Pro", inputCostPerMTok: 0.435, outputCostPerMTok: 0.87, contextWindow: 1048576, maxTokens: 128000 },
  { id: "mimo-v2.6-flash", name: "MiMo-V2.6-Flash", inputCostPerMTok: 0.14, outputCostPerMTok: 0.28, contextWindow: 1048576, maxTokens: 131072 },
  { id: "mimo-v2.6-pro", name: "MiMo-V2.6-Pro", inputCostPerMTok: 0.435, outputCostPerMTok: 0.87, contextWindow: 1048576, maxTokens: 131072 },
  { id: "minimax-m3", name: "MiniMax-M3", inputCostPerMTok: 0.3, outputCostPerMTok: 1.2, contextWindow: 1000000, maxTokens: 131072 },
  { id: "minimax-m3.1-flash", name: "MiniMax M3.1 Flash", inputCostPerMTok: 0.15, outputCostPerMTok: 0.6, contextWindow: 1000000, maxTokens: 512000 },
  { id: "muse-spark-1.2-contributor", name: "Muse Spark 1.2 Contributor", inputCostPerMTok: 0.1, outputCostPerMTok: 0.2, contextWindow: 1048576, maxTokens: 131072 },
  { id: "muse-spark-1.3-contributor", name: "Muse Spark 1.3 Contributor", inputCostPerMTok: 0.1, outputCostPerMTok: 0.2, contextWindow: 1048576, maxTokens: 131072 },
  { id: "qwen3.7-plus", name: "Qwen3.7 Plus", inputCostPerMTok: 0.4, outputCostPerMTok: 1.6, contextWindow: 1000000, maxTokens: 65536 },
  { id: "qwen3.8-flash", name: "Qwen3.8 Flash", inputCostPerMTok: 0.15, outputCostPerMTok: 0.47, contextWindow: 1000000, maxTokens: 131072 },
  { id: "qwen3.8-max", name: "Qwen3.8 Max", inputCostPerMTok: 2, outputCostPerMTok: 6, contextWindow: 1000000, maxTokens: 131072 },
  { id: "step-5-preview", name: "Step 5 Preview", inputCostPerMTok: 1, outputCostPerMTok: 2.7, contextWindow: 1000000, maxTokens: 65536 },
];
