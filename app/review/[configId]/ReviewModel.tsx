// FILE: app/review/[configId]/ReviewModel.tsx
// -----------------------------------------------------------------------------
// Static reuse of the same WEBGL renderer from /configure — "static" meaning
// the params never change (this is a saved, immutable configuration), not
// that interaction is disabled; orbit/zoom still work for free from
// ModelCanvas, which is a nice way to inspect a bespoke object before paying.
// -----------------------------------------------------------------------------
"use client";

import { useRef } from "react";
import { ModelCanvas, type ModelCanvasHandle } from "@/app/configure/ModelCanvas";
import { toPrototypeParams, type ObjectType, type ApiParams } from "@/lib/client/paramMap";

export function ReviewModel({ objectType, apiParams }: { objectType: ObjectType; apiParams: ApiParams }) {
  const stateRef = useRef<ModelCanvasHandle>({
    objectType,
    params: toPrototypeParams(objectType, apiParams),
  });

  return <ModelCanvas stateRef={stateRef} />;
}
