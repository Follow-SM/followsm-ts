import type { ConfluenceSnapshot, RecommendedAction } from "./types";

/** Custom thresholds for `evaluateRiskAction`, overriding the backend's defaults. */
export interface RiskConfig {
  vpinWidenThreshold?: number;
  vpinHaltThreshold?: number;
  minSemanticConfidence?: number;
}

const DEFAULT_RISK_CONFIG: Required<RiskConfig> = {
  vpinWidenThreshold: 0.6,
  vpinHaltThreshold: 0.8,
  minSemanticConfidence: 0.65,
};

/**
 * Re-derive a recommended action from `snapshot`'s raw metrics using custom thresholds.
 *
 * Mirrors the backend's HFT risk ladder but lets clients pick their own VPIN triggers;
 * HALT_MAKER_QUOTES is never returned when the divergence rests on a market whose
 * direction_confidence is below `config.minSemanticConfidence`.
 */
export function evaluateRiskAction(
  snapshot: ConfluenceSnapshot,
  config: RiskConfig = {},
): RecommendedAction {
  const cfg = { ...DEFAULT_RISK_CONFIG, ...config };
  const vpin = snapshot.binance_microstructure.vpin ?? 0;
  const divergence = snapshot.composite_signals.cross_market_divergence_flag;
  const events = snapshot.polymarket_confluence.active_events;
  const minConfidence = events.length
    ? Math.min(...events.map((e) => e.direction_confidence))
    : 1.0;

  if (vpin >= cfg.vpinHaltThreshold && divergence) {
    if (minConfidence < cfg.minSemanticConfidence) return "WIDEN_SPREAD_1_5X";
    return "HALT_MAKER_QUOTES";
  }
  if (vpin >= cfg.vpinWidenThreshold) return "WIDEN_SPREAD_2X";
  if (divergence) return "WIDEN_SPREAD_1_5X";
  return "NONE";
}
