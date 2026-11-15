/**
 * Snapshot tĩnh của 3 inference profile Bedrock (provider id `amazon-bedrock`) đã verify
 * Converse live 2026-11-15 trên account 229446390715, region ap-southeast-1.
 * KHÔNG sửa tay danh sách này nếu chưa verify lại; giá theo account đó trừ khi có ghi chú.
 *
 * Ids là profile ids BARE, không prefix — provider lưu riêng ở backend `app_settings.agent.provider`.
 * Kimi K3 / Kimi K3.1 dùng giá $3/$15 và $4/$20 ($4/$20 là list price của SDK catalog);
 * Nova 2 Lite dùng giá $0.41/$3.39 của account. K3.1 là reasoning model — reasoning ăn maxTokens;
 * call rẻ cần maxTokens ≥16.
 */
export type BedrockCatalogModel = {
  id: string;
  name: string;
  /** USD per MTok input. */
  inputCostPerMTok: number;
  /** USD per MTok output. */
  outputCostPerMTok: number;
  contextWindow: number;
  maxTokens: number;
};

export const BEDROCK_CATALOG: readonly BedrockCatalogModel[] = [
  { id: "global.amazon.nova-2-lite-v1:0", name: "Nova 2 Lite (Global)", inputCostPerMTok: 0.41, outputCostPerMTok: 3.39, contextWindow: 1000000, maxTokens: 65535 },
  { id: "global.moonshotai.kimi-k3", name: "Kimi K3 (Global)", inputCostPerMTok: 3, outputCostPerMTok: 15, contextWindow: 1048576, maxTokens: 128000 },
  { id: "global.moonshotai.kimi-k3.1", name: "Kimi K3.1 Pro Highspeed (Global)", inputCostPerMTok: 4, outputCostPerMTok: 20, contextWindow: 1048576, maxTokens: 1048576 },
];
