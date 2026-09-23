/** Data models mirroring backend/models/toxicity_models.py and smart_money_models.py. */

export interface DepthBand {
  bid_notional: number;
  ask_notional: number;
  imbalance_ratio: number;
}

export interface DepthBands {
  [band: string]: DepthBand; // '0.5%', '1.0%', '2.0%'
}

export interface ToxicitySnapshot {
  symbol: string;
  timestamp: number;
  price: number;
  vpin: number;
  ob_toxicity_1pct: number;
  ob_imbalance_l1: number;
  depth_bands: DepthBands;
  volume_z_score: number;
  natr_15m: number;
  taker_buy_ratio: number;
  is_toxic_alert: boolean;
}

export interface SignalGateDecision {
  is_approved: boolean;
  adjusted_stake_usdc: number;
  stake_multiplier: number;
  wallet_score: number;
  veto_reason: string | null;
}

// ── Cross-Venue Confluence (Binance microstructure × Polymarket event flow) ──

export interface BinanceMicrostructureMetrics {
  price: number;
  vpin: number;
  ob_toxicity_1pct: number;
  ob_imbalance_l1: number;
  depth_bands: DepthBands;
  volume_z_score: number;
  natr_15m: number;
  taker_buy_ratio: number;
  price_delta_15m_pct: number;
}

export type EventDirection = "bullish_if_yes" | "bearish_if_yes";

export interface PolymarketEventMetrics {
  market_slug: string;
  question: string;
  condition_id: string;
  yes_token_id: string;
  direction: EventDirection;
  implied_probability: number;
  prob_delta_15m: number;
  clob_order_flow_imbalance: number;
  smart_money_whale_sweeps_1h_usdt: number;
}

export interface PolymarketEventConfluence {
  active_events: PolymarketEventMetrics[];
  macro_event_risk_score: number;
}

export type RecommendedAction =
  | "NONE"
  | "WIDEN_SPREAD_1_5X"
  | "WIDEN_SPREAD_2X"
  | "HALT_MAKER_QUOTES";

export interface CompositeSignals {
  is_toxic_alert: boolean;
  cross_market_divergence_flag: boolean;
  recommended_action: RecommendedAction;
}

/** Top-level composite payload from /developer/confluence/* and /ws/v1/confluence. */
export interface ConfluenceSnapshot {
  symbol: string;
  timestamp_ms: number;
  binance_microstructure: BinanceMicrostructureMetrics;
  polymarket_confluence: PolymarketEventConfluence;
  composite_signals: CompositeSignals;
}
