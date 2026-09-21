import { FollowSMAuthenticationError, FollowSMRateLimitError } from "./errors";
import { SimpleEmitter } from "./emitter";
import type { ToxicitySnapshot } from "./types";

const DEFAULT_BASE_URL = "https://follow-sm.com/api/v1";
const DEFAULT_WS_URL = "wss://follow-sm.com/api/v1/developer/toxicity/stream";

export interface FollowSMClientOptions {
  apiKey?: string;
  baseUrl?: string;
  wsUrl?: string;
}

interface StreamEvents extends Record<string, unknown> {
  snapshot: ToxicitySnapshot;
  error: Error;
  close: void;
}

export class FollowSMClient {
  private readonly apiKey?: string;
  private readonly baseUrl: string;
  private readonly wsUrl: string;

  constructor(options: FollowSMClientOptions = {}) {
    this.apiKey = options.apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.wsUrl = options.wsUrl ?? DEFAULT_WS_URL;
  }

  private async request<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);

    const response = await fetch(url, {
      headers: this.apiKey ? { "X-FollowSM-Key": this.apiKey } : {},
    });

    if (response.status === 429) {
      const resetTime = Number(response.headers.get("X-RateLimit-Reset") ?? 0);
      const body = await response.json().catch(() => ({}));
      console.error(
        `\n\x1b[91m[FollowSM] Rate limit exceeded (429)\x1b[0m — resets at ${resetTime}`,
      );
      throw new FollowSMRateLimitError(body.detail ?? "Rate limit exceeded", resetTime);
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
      emitter.emit("snapshot", JSON.parse(event.data as string) as ToxicitySnapshot);
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
