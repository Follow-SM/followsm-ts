/**
 * Example: an Express bot endpoint that relays live toxicity alerts.
 *
 * Run with: npx tsx 01_express_bot_integration.ts
 */
import express from "express";
import { FollowSMClient } from "@followsm/sdk";

const app = express();
const client = new FollowSMClient({ apiKey: process.env.FOLLOWSM_API_KEY });

let lastAlert: unknown = null;

const stream = client.streamToxicity();
stream.on("snapshot", (snapshot) => {
  if (snapshot.is_toxic_alert) lastAlert = snapshot;
});
stream.on("error", (err) => console.error("[FollowSM] stream error:", err));

app.get("/last-toxic-alert", (_req, res) => {
  res.json(lastAlert ?? { message: "No toxic alerts yet" });
});

app.listen(3000, () => console.log("Bot listening on http://localhost:3000"));
