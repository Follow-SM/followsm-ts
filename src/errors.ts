export class FollowSMError extends Error {}

export class FollowSMRateLimitError extends FollowSMError {
  constructor(
    message: string,
    public readonly resetTime: number,
  ) {
    const upgradeUrl = "https://follow-sm.com/pricing";
    super(
      `\n[FollowSM RateLimitExceeded] ${message}\n` +
        `⚡️ Free Tier Limit Reached (30 req/min).\n` +
        `Unlock 300 req/min, 50+ Binance pairs & sub-10ms latency:\n` +
        `👉 ${upgradeUrl}\n`,
    );
    this.name = "FollowSMRateLimitError";
  }
}

export class FollowSMAuthenticationError extends FollowSMError {
  constructor(message: string) {
    super(message);
    this.name = "FollowSMAuthenticationError";
  }
}
