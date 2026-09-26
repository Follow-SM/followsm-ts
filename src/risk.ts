import type { ConfluenceSnapshot, RecommendedAction } from "./types";

/**
 * Custom thresholds for `evaluateRiskAction`, overriding the backend's defaults.
 * Percentile thresholds apply whenever the snapshot carries `vpin_percentile`; the raw
 * `vpin*` thresholds are the fallback while the backend is still warming up.
 */
export interface RiskConfig {
  vpinPercentileWidenThreshold?: number;
  vpinPercentileHaltThreshold?: number;
  vpinWidenThreshold?: number;
  vpinHaltThreshold?: number;
  obToxicityThreshold?: number;
  minSemanticConfidence?: number;
}

const DEFAULT_RISK_CONFIG: Required<RiskConfig> = {
  vpinPercentileWidenThreshold: 0.9,
  vpinPercentileHaltThreshold: 0.95,
  vpinWidenThreshold: 0.6,
  vpinHaltThreshold: 0.8,
  obToxicityThreshold: 2.0,
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
  const micro = snapshot.binance_microstructure;
  const usePercentile = micro.vpin_percentile !== undefined && micro.vpin_percentile !== null;
  const level = usePercentile ? (micro.vpin_percentile as number) : (micro.vpin ?? 0);
  const widen = usePercentile ? cfg.vpinPercentileWidenThreshold : cfg.vpinWidenThreshold;
  const halt = usePercentile ? cfg.vpinPercentileHaltThreshold : cfg.vpinHaltThreshold;
  const toxicBook = micro.ob_toxicity_1pct > cfg.obToxicityThreshold;
  const divergence = snapshot.composite_signals.cross_market_divergence_flag;
  const events = snapshot.polymarket_confluence.active_events;
  const minConfidence = events.length
    ? Math.min(...events.map((e) => e.direction_confidence))
    : 1.0;

  if ((level >= halt || toxicBook) && divergence) {
    if (minConfidence < cfg.minSemanticConfidence) return "WIDEN_SPREAD_1_5X";
    return "HALT_MAKER_QUOTES";
  }
  if (level >= widen || toxicBook) return "WIDEN_SPREAD_2X";
  if (divergence) return "WIDEN_SPREAD_1_5X";
  return "NONE";
}
