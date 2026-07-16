// FILE: lib/client/paramMap.ts
// -----------------------------------------------------------------------------
// The one place that translates between two shapes:
//   - "API space"        — the keys the server's param_schema uses, and the
//     only shape POST /api/configurations will accept: width, depth, height,
//     legWidth, topThickness.
//   - "prototype space"  — the keys the ported p5 draw functions
//     (drawTable/drawStool/drawShelf) expect, straight from the original
//     sketch: S/W/D/H/legH/t/topT depending on the object.
//
// Slider state in the app lives in API space (built directly from
// GET /api/products/[slug]'s param_schema — see Part 0.3), so no ad-hoc
// renaming happens near the fetch/save calls. toPrototypeParams() is the only
// place API-space state gets translated, and only for feeding the p5 renderer.
//
// The stool is the one non-bijective case: the prototype drives a SQUARE seat
// from a single `S` slider, but the API models width/depth as two independent
// params. width and depth are kept equal for the stool by construction (the
// UI exposes one slider that sets both) — toPrototypeParams asserts that
// invariant rather than silently averaging or picking one if it's ever violated.
// -----------------------------------------------------------------------------

export type ObjectType = "stool" | "table" | "shelf";

export type ApiParams = Record<string, number>;
export type PrototypeParams = Record<string, number>;

// Per-object 1:1 key pairs (API key -> prototype key). The stool's width/depth
// -> S collapse is handled separately since it isn't a 1:1 pair.
const KEY_MAP: Record<ObjectType, Array<[api: string, prototype: string]>> = {
  stool: [
    ["height", "legH"],
    ["legWidth", "t"],
    ["topThickness", "topT"],
  ],
  table: [
    ["width", "W"],
    ["depth", "D"],
    ["height", "legH"],
    ["legWidth", "t"],
    ["topThickness", "topT"],
  ],
  shelf: [
    ["width", "W"],
    ["depth", "D"],
    ["height", "H"], // shelf uses H, not legH — it has no separate leg/top split
    ["legWidth", "t"],
  ],
};

// Which API params this object type actually uses (drives what
// toApiParams/toPrototypeParams should look for and what /configure should
// fetch bounds for). Matches the product's param_schema.params keys.
export const API_PARAM_KEYS: Record<ObjectType, string[]> = {
  stool: ["width", "depth", "height", "legWidth", "topThickness"],
  table: ["width", "depth", "height", "legWidth", "topThickness"],
  shelf: ["width", "depth", "height", "legWidth"],
};

export function toPrototypeParams(type: ObjectType, api: ApiParams): PrototypeParams {
  const out: PrototypeParams = {};

  if (type === "stool") {
    if (api.width !== api.depth) {
      throw new Error(
        `stool params out of sync: width (${api.width}) must equal depth (${api.depth}) — ` +
          `the UI should always set both together from the single seat-width slider.`
      );
    }
    out.S = api.width;
  }

  for (const [apiKey, protoKey] of KEY_MAP[type]) {
    if (api[apiKey] === undefined) continue;
    out[protoKey] = api[apiKey];
  }

  return out;
}

export const OBJECT_TYPE_SLUGS: Record<ObjectType, string> = {
  stool: "wit-kit-stool",
  table: "wit-kit-table",
  shelf: "wit-kit-shelf",
};

export function objectTypeFromSlug(slug: string): ObjectType | null {
  const match = (Object.entries(OBJECT_TYPE_SLUGS) as Array<[ObjectType, string]>).find(
    ([, s]) => s === slug
  );
  return match ? match[0] : null;
}

export function toApiParams(type: ObjectType, prototype: PrototypeParams): ApiParams {
  const out: ApiParams = {};

  if (type === "stool") {
    out.width = prototype.S;
    out.depth = prototype.S;
  }

  for (const [apiKey, protoKey] of KEY_MAP[type]) {
    if (prototype[protoKey] === undefined) continue;
    out[apiKey] = prototype[protoKey];
  }

  return out;
}
