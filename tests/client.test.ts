import { afterEach, describe, expect, it, vi } from "vitest";
import { FollowSMClient, FollowSMRateLimitError } from "../src";

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
});
