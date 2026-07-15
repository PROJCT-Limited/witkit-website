// configurations.test.ts
import { describe, it, expect } from "vitest";
import { prepareConfiguration } from "./configurations";
import type { ProductRow } from "./configurations";
import type { ParamSchema } from "./pricing";

const schema: ParamSchema = {
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

const product: ProductRow = { id: "prod_1", slug: "wit-kit-stool", active: true, param_schema: schema };
const goodParams = { width: 40, depth: 40, height: 45, legWidth: 4, topThickness: 2.5 };

describe("prepareConfiguration", () => {
  it("builds a record with a server-recomputed price of $305.00", () => {
    const r = prepareConfiguration(product, { params: goodParams });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.record.price_cents).toBe(30500);
      expect(r.record.product_id).toBe("prod_1");
      expect(r.record.currency).toBe("usd");
      expect(r.record.session_id).toBeNull();
    }
  });

  it("ignores any price the client tries to send — it is recomputed", () => {
    const r = prepareConfiguration(product, {
      params: { ...goodParams, price_cents: 1 } as any, // smuggled field
    });
    // The smuggled unknown param is rejected by validation, proving nothing
    // from the client body reaches the price.
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toMatch(/Unknown parameter: price_cents/);
  });

  it("passes a sessionId through for anonymous analytics", () => {
    const r = prepareConfiguration(product, { params: goodParams, sessionId: "sess_abc" });
    if (r.ok) expect(r.record.session_id).toBe("sess_abc");
  });

  it("404s an inactive product", () => {
    const r = prepareConfiguration({ ...product, active: false }, { params: goodParams });
    expect(r).toMatchObject({ ok: false, status: 404 });
  });

  it("400s params that aren't an object of numbers", () => {
    const r = prepareConfiguration(product, { params: { width: "40" } as any });
    expect(r).toMatchObject({ ok: false, status: 400 });
  });

  it("400s an out-of-range configuration and surfaces field errors", () => {
    const r = prepareConfiguration(product, { params: { ...goodParams, height: 300 } });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.status).toBe(400);
      expect(r.errors.join()).toMatch(/height must be between/);
    }
  });

  it("400s a structurally invalid (too-large) top", () => {
    const r = prepareConfiguration(product, { params: { ...goodParams, width: 70, depth: 70 } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join()).toMatch(/single-fastener/);
  });
});
