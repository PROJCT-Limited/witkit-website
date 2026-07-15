// pricing.test.ts
import { describe, it, expect } from "vitest";
import { validateConfig, computePrice, priceConfiguration } from "./pricing";
import type { ParamSchema } from "./pricing";

// Mirrors the seed row in schema.sql. Placeholder rates/bounds — tune to taste.
const stool: ParamSchema = {
  currency: "usd",
  pricing: { base_cents: 10000, height_cents_per_cm: 100, surface_cents_per_cm2: 10 },
  params: {
    width:        { min: 20,  max: 80, step: 1,   priced: true },
    depth:        { min: 20,  max: 80, step: 1,   priced: true },
    height:       { min: 30,  max: 75, step: 1,   priced: true },
    legWidth:     { min: 2,   max: 8,  step: 0.5, priced: false },
    topThickness: { min: 1.5, max: 5,  step: 0.5, priced: false },
  },
  structural: { maxSurfaceCm2: 4000 },
};

const validStool = { width: 40, depth: 40, height: 45, legWidth: 4, topThickness: 2.5 };

describe("computePrice", () => {
  it("prices the canonical 40×40×45 stool at exactly $305.00", () => {
    const r = computePrice(stool, validStool);
    expect(r.price_cents).toBe(30500); // 10000 base + 4500 height + 16000 surface
    expect(r.breakdown).toEqual({ base_cents: 10000, height_cents: 4500, surface_cents: 16000 });
    expect(r.currency).toBe("usd");
  });

  it("applies the surface rate of $0.10/cm² (a 10×10 top = $10.00)", () => {
    const permissive: ParamSchema = {
      ...stool,
      params: { ...stool.params, width: { min: 0, max: 100, step: 1 }, depth: { min: 0, max: 100, step: 1 } },
    };
    const r = computePrice(permissive, { width: 10, depth: 10, height: 0 });
    expect(r.breakdown.surface_cents).toBe(1000);
  });
});

describe("validateConfig", () => {
  it("accepts a valid stool", () => {
    expect(validateConfig(stool, validStool).valid).toBe(true);
  });

  it("rejects an out-of-range width", () => {
    const r = validateConfig(stool, { ...validStool, width: 200 });
    expect(r.valid).toBe(false);
    expect(r.errors.join()).toMatch(/width must be between/);
  });

  it("rejects a missing required parameter", () => {
    const { height, ...noHeight } = validStool;
    const r = validateConfig(stool, noHeight);
    expect(r.valid).toBe(false);
    expect(r.errors.join()).toMatch(/Missing required parameter: height/);
  });

  it("rejects off-step values", () => {
    const r = validateConfig(stool, { ...validStool, width: 40.5 });
    expect(r.valid).toBe(false);
    expect(r.errors.join()).toMatch(/steps of 1/);
  });

  it("accepts legal fractional steps (topThickness 2.5)", () => {
    expect(validateConfig(stool, { ...validStool, topThickness: 2.5 }).valid).toBe(true);
  });

  it("rejects unknown parameters", () => {
    const r = validateConfig(stool, { ...validStool, colour: 7 } as any);
    expect(r.valid).toBe(false);
    expect(r.errors.join()).toMatch(/Unknown parameter: colour/);
  });

  it("enforces the single-fastener structural guard (70×70 = 4900 cm²)", () => {
    const r = validateConfig(stool, { ...validStool, width: 70, depth: 70 });
    expect(r.valid).toBe(false);
    expect(r.errors.join()).toMatch(/single-fastener/);
  });
});

describe("priceConfiguration", () => {
  it("validates then prices in one call", () => {
    expect(priceConfiguration(stool, validStool).price_cents).toBe(30500);
  });

  it("throws on an invalid config rather than pricing it", () => {
    expect(() => priceConfiguration(stool, { ...validStool, width: 5 })).toThrow(/Invalid configuration/);
  });
});
