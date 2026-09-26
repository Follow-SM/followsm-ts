import { FollowSMAuthenticationError, FollowSMRateLimitError } from "./errors";
import { SimpleEmitter } from "./emitter";
import { evaluateRiskAction, type RiskConfig } from "./risk";
import type { ConfluenceSnapshot, RecommendedAction, ToxicitySnapshot } from "./types";

const DEFAULT_BASE_URL = "https://follow-sm.com/api/v1";
const DEFAULT_WS_URL = "wss://follow-sm.com/ws/v1/toxicity";
const DEFAULT_CONFLUENCE_WS_URL = "wss://follow-sm.com/ws/v1/confluence";

export interface FollowSMClientOptions {
  apiKey?: string;
  baseUrl?: string;
  wsUrl?: string;
  confluenceWsUrl?: string;
  riskConfig?: RiskConfig;
}

interface StreamEvents extends Record<string, unknown> {
  snapshot: ToxicitySnapshot;
  error: Error;
  close: void;
}

interface ConfluenceStreamEvents extends Record<string, unknown> {
  snapshot: ConfluenceSnapshot;
  error: Error;
  close: void;
}

export class FollowSMClient {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly wsUrl: string;
  private readonly confluenceWsUrl: string;
  private readonly riskConfig: RiskConfig;

  constructor(options: FollowSMClientOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.wsUrl = options.wsUrl ?? DEFAULT_WS_URL;
    this.confluenceWsUrl = options.confluenceWsUrl ?? DEFAULT_CONFLUENCE_WS_URL;
    this.riskConfig = options.riskConfig ?? {};
  }

  private async request<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);

    const response = await fetch(url, {
      headers: this.apiKey ? { "X-FollowSM-Key": this.apiKey } : {},
    });

    if (response.status === 429) {
      const resetTime = Number(response.headers.get("X-RateLimit-Reset") ?? 0);
      // The per-IP global limiter answers with a plain-text body, not JSON.
      const raw = await response.text().catch(() => "");
      let detail = raw || "Rate limit exceeded";
      try {
        detail = JSON.parse(raw).detail ?? detail;
      } catch {
        // keep the plain-text body
      }
      console.error(
        `\n\x1b[91m[FollowSM] Rate limit exceeded (429)\x1b[0m — resets at ${resetTime}`,
      );
      throw new FollowSMRateLimitError(detail, resetTime);
    }
    if (response.status === 401 || response.status === 403) {
      throw new FollowSMAuthenticationError(await response.text());
    }
    if (!response.ok) {
      throw new Error(`FollowSM API error: ${response.status} ${await response.text()}`);
    }
    return (await response.json()) as T;
  }

  getToxicitySnapshot(symbol: string): Promise<ToxicitySnapshot> {
    return this.request<ToxicitySnapshot>("/developer/toxicity/snapshot", { symbol });
  }

  getToxicPairs(): Promise<ToxicitySnapshot[]> {
    return this.request<ToxicitySnapshot[]>("/developer/toxicity/toxic-pairs");
  }

  /** Streams live toxicity snapshots over the WebSocket feed. Emits 'snapshot' | 'error' | 'close'. */
  streamToxicity(): SimpleEmitter<StreamEvents> {
    const emitter = new SimpleEmitter<StreamEvents>();
    const uri = this.apiKey
      ? `${this.wsUrl}?api_key=${encodeURIComponent(this.apiKey)}`
      : this.wsUrl;
    const ws = new WebSocket(uri);

    ws.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data as string);
      if (!Array.isArray(payload)) return; // ping heartbeat frame — nothing to emit
      for (const snapshot of payload as ToxicitySnapshot[]) emitter.emit("snapshot", snapshot);
    });
    ws.addEventListener("error", () => {
      emitter.emit("error", new Error("FollowSM WebSocket connection error"));
    });
    ws.addEventListener("close", () => {
      emitter.emit("close", undefined);
    });

    return emitter;
  }

  getConfluenceSnapshot(symbol: string): Promise<ConfluenceSnapshot> {
    return this.request<ConfluenceSnapshot>("/developer/confluence/snapshot", { symbol });
  }

  /** Re-derives a recommended action from `snapshot` using this client's `riskConfig`. */
  evaluateRisk(snapshot: ConfluenceSnapshot): RecommendedAction {
    return evaluateRiskAction(snapshot, this.riskConfig);
  }

  getConfluenceSnapshots(toxicOnly = false): Promise<ConfluenceSnapshot[]> {
    return this.request<ConfluenceSnapshot[]>("/developer/confluence/snapshots", {
      toxic_only: String(toxicOnly),
    });
  }

  /** Streams live ConfluenceSnapshot frames (Enterprise only, /ws/v1/confluence). */
  streamConfluence(): SimpleEmitter<ConfluenceStreamEvents> {
    const emitter = new SimpleEmitter<ConfluenceStreamEvents>();
    const uri = this.apiKey
      ? `${this.confluenceWsUrl}?api_key=${encodeURIComponent(this.apiKey)}`
      : this.confluenceWsUrl;
    const ws = new WebSocket(uri);

    ws.addEventListener("message", (event) => {
      const payload = JSON.parse(event.data as string);
      if (!Array.isArray(payload)) return; // ping heartbeat frame — nothing to emit
      for (const snapshot of payload as ConfluenceSnapshot[]) emitter.emit("snapshot", snapshot);
    });
    ws.addEventListener("error", () => {
      emitter.emit("error", new Error("FollowSM WebSocket connection error"));
    });
    ws.addEventListener("close", () => {
      emitter.emit("close", undefined);
    });

    return emitter;
  }
}