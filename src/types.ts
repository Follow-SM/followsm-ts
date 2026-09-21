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
