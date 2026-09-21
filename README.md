# @followsm/sdk

Official TypeScript/JavaScript SDK for the [FollowSM](https://follow-sm.com) smart-money & orderbook toxicity API. Zero external dependencies — uses native `fetch` / `WebSocket`.

## Install

```bash
npm i @followsm/sdk
```

## Quickstart

```ts
import { FollowSMClient } from "@followsm/sdk";

const client = new FollowSMClient({ apiKey: "fsm_live_..." }); // omit to use the free tier
const snapshot = await client.getToxicitySnapshot("BTCUSDT");
console.log(snapshot.vpin, snapshot.is_toxic_alert);
```

## Free vs Developer API

| | Free / Unauthenticated | DEVELOPER_API ($199/mo) |
|---|---|---|
| Requests/min | 30 | 300 |
| WebSocket connections | 1 | Multiple |
| Binance pairs | Limited | 50+ |
| Latency | Standard | Sub-10ms in-memory snapshots |

On HTTP 429, the SDK throws `FollowSMRateLimitError` with an upgrade prompt pointing to https://follow-sm.com/pricing.

## Streaming

```ts
const stream = client.streamToxicity();
stream.on("snapshot", (s) => console.log(s.symbol, s.vpin));
stream.on("error", (err) => console.error(err));
```
