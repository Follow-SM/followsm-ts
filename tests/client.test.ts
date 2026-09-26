import { afterEach, describe, expect, it, vi } from "vitest";
import { FollowSMClient, FollowSMRateLimitError } from "../src";
import { evaluateRiskAction } from "../src/risk";
import type { ConfluenceSnapshot } from "../src/types";

const SNAPSHOT_JSON = {
  symbol: "BTCUSDT",
  timestamp: 1,
  price: 60000,
  vpin: 0.85,
  ob_toxicity_1pct: 1.0,
  ob_imbalance_l1: 0.5,
  depth_bands: { "0.5%": { bid_notional: 1, ask_notional: 1, imbalance_ratio: 0.5 } },
  volume_z_score: 0.1,
  natr_15m: 0.1,
  taker_buy_ratio: 0.5,
  is_toxic_alert: true,
};

function mockFetchResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    status,
    ok: status < 400,
    json: async () => body,
    text: async () => JSON.stringify(body),
    headers: new Headers(headers),
  } as Response;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("FollowSMClient", () => {
  it("parses a toxicity snapshot", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockFetchResponse(200, SNAPSHOT_JSON)));

    const client = new FollowSMClient({ apiKey: "fsm_live_test" });
    const snapshot = await client.getToxicitySnapshot("BTCUSDT");

    expect(snapshot.symbol).toBe("BTCUSDT");
    expect(snapshot.is_toxic_alert).toBe(true);
  });

  it("throws FollowSMRateLimitError on 429", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockFetchResponse(429, { detail: "Rate limit exceeded" }, { "X-RateLimit-Reset": "1726915000" }),
      ),
    );

    const client = new FollowSMClient();
    await expect(client.getToxicitySnapshot("BTCUSDT")).rejects.toBeInstanceOf(
      FollowSMRateLimitError,
    );
  });

  it("defaults to an unauthenticated client", () => {
    const client = new FollowSMClient();
    expect((client as unknown as { apiKey?: string }).apiKey).toBeUndefined();
  });

  it("throws FollowSMRateLimitError with the plain-text body on a global-limiter 429", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 429,
        ok: false,
        text: async () => "Global rate limit exceeded",
        headers: new Headers(),
      } as Response),
    );
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(new FollowSMClient().getToxicitySnapshot("BTCUSDT")).rejects.toThrow(
      "Global rate limit exceeded",
    );
  });

  it("streamToxicity emits one snapshot per list item and skips pings", () => {
    const sockets: FakeWebSocket[] = [];
    class FakeWebSocket {
      listeners: Record<string, (event: { data?: string }) => void> = {};
      constructor(public url: string) {
        sockets.push(this);
      }
      addEventListener(type: string, listener: (event: { data?: string }) => void) {
        this.listeners[type] = listener;
      }
    }
    vi.stubGlobal("WebSocket", FakeWebSocket);

    const symbols: string[] = [];
    new FollowSMClient({ apiKey: "k" })
      .streamToxicity()
      .on("snapshot", (snapshot) => symbols.push(snapshot.symbol));

    const [ws] = sockets;
    ws.listeners.message({ data: JSON.stringify([SNAPSHOT_JSON, { ...SNAPSHOT_JSON, symbol: "ETHUSDT" }]) });
    ws.listeners.message({ data: JSON.stringify({ type: "ping" }) });

    expect(ws.url).toBe("wss://follow-sm.com/ws/v1/toxicity?api_key=k");
    expect(symbols).toEqual(["BTCUSDT", "ETHUSDT"]);
  });
});

function makeSnapshot(vpin: number, divergence: boolean, confidence = 1.0): ConfluenceSnapshot {
  return {
    symbol: "BTCUSDT",
    timestamp_ms: 1,
    binance_microstructure: {
      price: 60000,
      vpin,
      ob_toxicity_1pct: 1,
      ob_imbalance_l1: 0.5,
      depth_bands: {},
      volume_z_score: 0.1,
      natr_15m: 0.1,
      taker_buy_ratio: 0.5,
      price_delta_15m_pct: 0.01,
    },
    polymarket_confluence: {
      active_events: [
        {
          market_slug: "will-btc-hit-70k",
          question: "Will Bitcoin hit $70k?",
          condition_id: "cond-1",
          yes_token_id: "yes-1",
          direction: "bullish_if_yes",
          direction_confidence: confidence,
          implied_probability: 0.6,
          prob_delta_15m: 0.09,
          clob_order_flow_imbalance: 0.6,
          smart_money_whale_sweeps_1h_usdt: 100_000,
        },
      ],
      macro_event_risk_score: 0.7,
    },
    composite_signals: {
      is_toxic_alert: vpin >= 0.7,
      cross_market_divergence_flag: divergence,
      recommended_action: divergence ? "HALT_MAKER_QUOTES" : "NONE",
      direction_ambiguous: false,
    },
  };
}

describe("evaluateRiskAction", () => {
  it("halts on high vpin and divergence by default", () => {
    expect(evaluateRiskAction(makeSnapshot(0.85, true))).toBe("HALT_MAKER_QUOTES");
  });

  it("downgrades halt when direction confidence is low", () => {
    expect(evaluateRiskAction(makeSnapshot(0.85, true, 0.4))).toBe("WIDEN_SPREAD_1_5X");
  });

  it("respects custom thresholds", () => {
    const action = evaluateRiskAction(makeSnapshot(0.5, false), {
      vpinWidenThreshold: 0.4,
      vpinHaltThreshold: 0.9,
    });
    expect(action).toBe("WIDEN_SPREAD_2X");
  });

  it("client.evaluateRisk uses its configured riskConfig", () => {
    const client = new FollowSMClient({ riskConfig: { minSemanticConfidence: 0.9 } });
    expect(client.evaluateRisk(makeSnapshot(0.85, true, 0.8))).toBe("WIDEN_SPREAD_1_5X");
  });
});
