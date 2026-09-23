/**
 * Example: query a Cross-Venue Confluence snapshot and stream live updates.
 *
 * Run with: npx tsx 02_confluence_snapshot.ts
 */
import { FollowSMClient } from "@followsm/sdk";

const client = new FollowSMClient({ apiKey: process.env.FOLLOWSM_API_KEY });

const snapshot = await client.getConfluenceSnapshot("BTCUSDT");
console.log(snapshot.symbol, snapshot.composite_signals.recommended_action);

const stream = client.streamConfluence();
stream.on("snapshot", (s) => {
  if (s.composite_signals.cross_market_divergence_flag) {
    console.log(`[divergence] ${s.symbol}: ${s.composite_signals.recommended_action}`);
  }
});
stream.on("error", (err) => console.error("[FollowSM] stream error:", err));
