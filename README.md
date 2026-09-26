# @followsm/sdk

Official TypeScript/JavaScript SDK for the [FollowSM](https://follow-sm.com) smart-money & orderbook toxicity API. Zero external dependencies — uses native `fetch` / `WebSocket`.

## 🚀 Key Features
- **Binance Microstructure:** Tick-level VPIN, 1% orderbook toxicity bands, L1 imbalances, and volume Z-scores.
- **Polymarket Confluence:** Binary event odds, 15m probability deltas ($\Delta\text{Prob}$), and Smart Money whale sweeps.
- **Cross-Market Divergence:** Automated HFT risk recommendations ('NONE', 'WIDEN_SPREAD_1_5X', 'WIDEN_SPREAD_2X', 'HALT_MAKER_QUOTES')

## Install

```bash
npm i @followsm/sdk
```

## Quickstart

```ts
import { FollowSMClient } from "@followsm/sdk";

const client = new FollowSMClient({ apiKey: "fsm_live_..." }); // omit for the free, IP-rate-limited tier
const snapshot = await client.getToxicitySnapshot("BTCUSDT");
console.log(snapshot.vpin, snapshot.is_toxic_alert);

const toxicPairs = await client.getToxicPairs(); // also works without an apiKey
```

## `ToxicitySnapshot` response

`getToxicitySnapshot()` and `getToxicPairs()` both resolve to `ToxicitySnapshot`, matching the raw JSON the backend returns:

```json
{
  "symbol": "BTCUSDT",
  "timestamp": 1758412800.0,
  "price": 62150.5,
  "vpin": 0.72,
  "ob_toxicity_1pct": 2.35,
  "ob_imbalance_l1": 0.61,
  "depth_bands": {
    "0.5%": { "bid_notional": 184320.0, "ask_notional": 96410.0, "imbalance_ratio": 0.657 },
    "1.0%": { "bid_notional": 312500.0, "ask_notional": 210800.0, "imbalance_ratio": 0.597 },
    "2.0%": { "bid_notional": 590100.0, "ask_notional": 470200.0, "imbalance_ratio": 0.556 }
  },
  "volume_z_score": 3.1,
  "natr_15m": 0.84,
  "taker_buy_ratio": 0.58,
  "is_toxic_alert": true
}
```

| Field | Type | Description |
|---|---|---|
| `symbol` | `string` | Trading pair, e.g. `"BTCUSDT"` |
| `timestamp` | `number` | Unix epoch seconds when the snapshot was computed |
| `price` | `number` | Last traded price |
| `vpin` | `number` | Volume-Synchronized Probability of Informed Trading, `[0.0, 1.0]` (per-symbol bucket = 24h volume / 1200) |
| `vpin_percentile` | `number \| null` | Rank of `vpin` within this symbol's own trailing 24h, `[0.0, 1.0]`; `null` for ~1h after the feed starts |
| `ob_toxicity_1pct` | `number` | Ask/bid notional ratio within ±1% of mid price |
| `ob_imbalance_l1` | `number` | Best bid/ask (L1) imbalance |
| `depth_bands` | `DepthBands` | Keyed by band width (`"0.5%"`, `"1.0%"`, `"2.0%"`), each with `bid_notional`, `ask_notional`, `imbalance_ratio` |
| `volume_z_score` | `number` | Robust Z-score of recent traded volume |
| `natr_15m` | `number` | Normalized ATR over 15-minute candles |
| `taker_buy_ratio` | `number` | Share of taker volume that was buy-side |
| `is_toxic_alert` | `boolean` | `true` when `vpin_percentile >= 0.90` or `ob_toxicity_1pct > 2.0` |

## Streaming (Enterprise only)

`streamToxicity()` connects to `/ws/v1/toxicity`, which requires an API key on an
active **Enterprise** subscription — Developer API and free/unauthenticated keys are
rejected with close code `4003`.

```ts
const stream = client.streamToxicity();
stream.on("snapshot", (s) => console.log(s.symbol, s.vpin));
stream.on("error", (err) => console.error(err));
```

## Cross-Venue Confluence (Binance × Polymarket)

`getConfluenceSnapshot()`, `getConfluenceSnapshots()` and `streamConfluence()` enrich Binance
microstructure (VPIN, depth imbalance) with live Polymarket event flow (implied probability,
CLOB order-flow imbalance, smart-money whale sweeps) and a composite HFT risk recommendation.
They resolve to `ConfluenceSnapshot`, matching this JSON:

```json
{
  "symbol": "BTCUSDT",
  "timestamp_ms": 1790212800000,
  "binance_microstructure": {
    "price": 68420.50,
    "vpin": 0.78,
    "ob_toxicity_1pct": 2.14,
    "ob_imbalance_l1": 0.62,
    "depth_bands": {
      "0.5%": { "bid_notional": 450000, "ask_notional": 1200000, "imbalance_ratio": 2.66 },
      "1.0%": { "bid_notional": 1200000, "ask_notional": 2800000, "imbalance_ratio": 2.33 }
    },
    "volume_z_score": 3.1,
    "natr_15m": 0.87,
    "taker_buy_ratio": 0.29,
    "price_delta_15m_pct": 0.004
  },
  "polymarket_confluence": {
    "active_events": [
      {
        "market_slug": "will-btc-hit-70k-in-september",
        "question": "Will Bitcoin hit $70k in September?",
        "condition_id": "0x...",
        "yes_token_id": "12345...",
        "direction": "bullish_if_yes",
        "direction_confidence": 0.91,
        "implied_probability": 0.82,
        "prob_delta_15m": 0.09,
        "clob_order_flow_imbalance": 0.74,
        "smart_money_whale_sweeps_1h_usdt": 185000
      }
    ],
    "macro_event_risk_score": 0.85
  },
  "composite_signals": {
    "is_toxic_alert": true,
    "cross_market_divergence_flag": false,
    "recommended_action": "WIDEN_SPREAD_2X",
    "direction_ambiguous": false,
  }
}
```

| Field | Description |
|---|---|
| `binance_microstructure.price_delta_15m_pct` | Spot price change over the last 15 minutes |
| `polymarket_confluence.active_events[].direction` | Whether a rising `implied_probability` (YES) is bullish, bearish, or `"neutral"` (semantically ambiguous question) for spot |
| `polymarket_confluence.active_events[].direction_confidence` | `[0.0, 1.0]` semantic-similarity confidence backing `direction` |
| `polymarket_confluence.active_events[].prob_delta_15m` | Change in implied probability over the last 15 minutes |
| `polymarket_confluence.active_events[].clob_order_flow_imbalance` | Bid/(bid+ask) notional on the YES orderbook |
| `polymarket_confluence.active_events[].smart_money_whale_sweeps_1h_usdt` | Rolling 60-minute notional from top-ranked smart-money wallets |
| `polymarket_confluence.macro_event_risk_score` | `[0.0, 1.0]` composite risk, max over active events |
| `composite_signals.cross_market_divergence_flag` | `true` when spot momentum opposes the Polymarket probability shift (bull/bear trap) |
| `composite_signals.recommended_action` | `"NONE"` \| `"WIDEN_SPREAD_1_5X"` \| `"WIDEN_SPREAD_2X"` \| `"HALT_MAKER_QUOTES"` |
| `composite_signals.direction_ambiguous` | `true` when a low-confidence `direction` downgraded the recommended action |
|

```ts
const snapshot = await client.getConfluenceSnapshot("BTCUSDT");
console.log(snapshot.composite_signals.recommended_action);

const snapshots = await client.getConfluenceSnapshots(true); // toxic_only

// Streaming (Enterprise only, /ws/v1/confluence):
const stream = client.streamConfluence();
stream.on("snapshot", (s) => console.log(s.symbol, s.composite_signals.recommended_action));
```

### Custom risk thresholds (`RiskConfig`)

The backend's `recommended_action` uses fixed, conservative thresholds. Quant clients can
re-derive the risk ladder from the exposed `binance_microstructure` with their own thresholds via
`RiskConfig` and `evaluateRiskAction` / `client.evaluateRisk()`:

```ts
import { FollowSMClient, RiskConfig } from "@followsm/sdk";

const customConfig: RiskConfig = {
  vpinWidenThreshold: 0.65,      // Custom VPIN trigger for WIDEN_SPREAD_2X
  vpinHaltThreshold: 0.85,       // Custom VPIN trigger for HALT_MAKER_QUOTES
  minSemanticConfidence: 0.70,   // Stricter than the backend's 0.65 safety gate
};

const client = new FollowSMClient({ apiKey: process.env.API_KEY, riskConfig: customConfig });

const snapshot = await client.getConfluenceSnapshot("BTCUSDT");
console.log(client.evaluateRisk(snapshot)); // re-evaluated with your own thresholds
```

`evaluateRiskAction(snapshot, config)` is also exported standalone for stateless/batch use.
Like the backend, it never returns `HALT_MAKER_QUOTES` when the divergence rests on an event
whose `direction_confidence` is below `minSemanticConfidence`.

## Free vs Developer API

| | Free / Unauthenticated | DEVELOPER_API ($199/mo) | Enterprise($499/mo) |
|---|---|---|---|
| Requests/min | 30 | 300 | 1,000 |
| WebSocket streaming (`streamToxicity()`) | ❌ | ❌ | ✅ |
| Binance pairs | Limited | 50+ | 50+ |
| Latency | Standard | Sub-10ms in-memory snapshots | Sub-10ms in-memory snapshots |

On HTTP 429, the SDK throws `FollowSMRateLimitError` with an upgrade prompt pointing to https://follow-sm.com/pricing.
