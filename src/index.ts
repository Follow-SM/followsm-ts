export { FollowSMClient } from "./client";
export type { FollowSMClientOptions } from "./client";
export { FollowSMError, FollowSMRateLimitError, FollowSMAuthenticationError } from "./errors";
export { evaluateRiskAction } from "./risk";
export type { RiskConfig } from "./risk";
export type {
  ToxicitySnapshot,
  DepthBand,
  DepthBands,
  SignalGateDecision,
  ConfluenceSnapshot,
  BinanceMicrostructureMetrics,
  PolymarketEventConfluence,
  PolymarketEventMetrics,
  CompositeSignals,
  EventDirection,
  RecommendedAction,
} from "./types";
