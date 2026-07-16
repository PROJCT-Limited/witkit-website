import { describe, it, expect } from "vitest";
import { toApiParams, toPrototypeParams, API_PARAM_KEYS } from "./paramMap";

describe("stool (square seat: one prototype slider S drives width AND depth)", () => {
  it("maps the verified 40×40×45 / $305 example to prototype space", () => {
    const api = { width: 40, depth: 40, height: 45, legWidth: 4, topThickness: 2.5 };
    expect(toPrototypeParams("stool", api)).toEqual({ S: 40, legH: 45, t: 4, topT: 2.5 });
  });

  it("maps prototype space back to API space, duplicating S into width and depth", () => {
    const prototype = { S: 38, legH: 48, t: 3, topT: 2 };
    expect(toApiParams("stool", prototype)).toEqual({
      width: 38,
      depth: 38,
      height: 48,
      legWidth: 3,
      topThickness: 2,
    });
  });

  it("throws if width and depth ever disagree, rather than silently guessing", () => {
    expect(() => toPrototypeParams("stool", { width: 40, depth: 41, height: 45 })).toThrow(/width.*depth/i);
  });

  it("round-trips api -> prototype -> api", () => {
    const api = { width: 25, depth: 25, height: 30, legWidth: 2, topThickness: 1 };
    expect(toApiParams("stool", toPrototypeParams("stool", api))).toEqual(api);
  });
});

describe("table (1:1 rename, no collapsing)", () => {
  it("maps the verified 110×60×72 / $832 default to prototype space", () => {
    const api = { width: 110, depth: 60, height: 72, legWidth: 4, topThickness: 2.5 };
    expect(toPrototypeParams("table", api)).toEqual({ W: 110, D: 60, legH: 72, t: 4, topT: 2.5 });
  });

  it("round-trips prototype -> api -> prototype", () => {
    const prototype = { W: 160, D: 100, legH: 95, t: 8, topT: 5 };
    expect(toPrototypeParams("table", toApiParams("table", prototype))).toEqual(prototype);
  });
});

describe("shelf (no topThickness; prototype uses H, not legH)", () => {
  it("maps the verified 80×30×120 / $460 default to prototype space", () => {
    const api = { width: 80, depth: 30, height: 120, legWidth: 3 };
    expect(toPrototypeParams("shelf", api)).toEqual({ W: 80, D: 30, H: 120, t: 3 });
  });

  it("never introduces a topThickness/topT key for the shelf", () => {
    const api = { width: 80, depth: 30, height: 120, legWidth: 3 };
    expect(toPrototypeParams("shelf", api)).not.toHaveProperty("topT");
    const prototype = { W: 80, D: 30, H: 120, t: 3 };
    expect(toApiParams("shelf", prototype)).not.toHaveProperty("topThickness");
  });

  it("round-trips api -> prototype -> api", () => {
    const api = { width: 120, depth: 45, height: 180, legWidth: 6 };
    expect(toApiParams("shelf", toPrototypeParams("shelf", api))).toEqual(api);
  });
});

describe("API_PARAM_KEYS", () => {
  it("matches each product's actual param_schema keys (schema is the source of truth)", () => {
    expect(API_PARAM_KEYS.stool).toEqual(["width", "depth", "height", "legWidth", "topThickness"]);
    expect(API_PARAM_KEYS.table).toEqual(["width", "depth", "height", "legWidth", "topThickness"]);
    expect(API_PARAM_KEYS.shelf).toEqual(["width", "depth", "height", "legWidth"]);
  });
});
