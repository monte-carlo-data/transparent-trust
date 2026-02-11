// codex: unit tests for usage tracking helpers
import { describe, it, expect } from "vitest";
import { calculateCost, extractUsageFromResponse } from "@/lib/usageTracking";

describe("calculateCost", () => {
  it("codex: uses model-specific pricing when available", () => {
    const dollars = calculateCost("claude-3-haiku-20240307", 2000, 1000);
    // 2000 input tokens @ $0.25 per 1M = 0.0005, 1000 output @ $1.25 per 1M = 0.00125
    expect(dollars).toBeCloseTo(0.00175, 6);
  });

  it("codex: falls back to default pricing for unknown models", () => {
    const dollars = calculateCost("unknown-model", 500000, 250000);
    expect(dollars).toBeCloseTo(5.25, 3); // 0.5M*$3 + 0.25M*$15 = 1.5 + 3.75
  });
});

describe("extractUsageFromResponse", () => {
  it("codex: safely handles missing usage blocks", () => {
    expect(extractUsageFromResponse({})).toEqual({ inputTokens: 0, outputTokens: 0 });
    expect(
      extractUsageFromResponse({ usage: { input_tokens: 123, output_tokens: 45 } }),
    ).toEqual({ inputTokens: 123, outputTokens: 45 });
  });
});
