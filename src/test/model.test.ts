import { describe, it, expect } from "vitest";
import { pickModel, scoreModel, type ModelInfo } from "../../supabase/functions/ai/model";

const m = (name: string, methods: string[] = ["generateContent"]): ModelInfo => ({
  name,
  supportedGenerationMethods: methods,
});

/** Shaped like a real GET /v1beta/models response. */
const REALISTIC: ModelInfo[] = [
  m("models/embedding-001", ["embedContent"]),
  m("models/text-embedding-004", ["embedContent"]),
  m("models/gemini-2.5-pro"),
  m("models/gemini-2.5-flash"),
  m("models/gemini-3-flash"),
  m("models/gemini-3-pro"),
  m("models/gemini-flash-latest"),
  m("models/gemini-2.5-flash-lite"),
  m("models/imagen-3.0-generate-002", ["predict"]),
];

describe("pickModel", () => {
  it("prefers a flash model over pro", () => {
    const chosen = pickModel([m("models/gemini-3-pro"), m("models/gemini-3-flash")]);
    expect(chosen).toBe("gemini-3-flash");
  });

  it("prefers a higher version", () => {
    const chosen = pickModel([m("models/gemini-2.5-flash"), m("models/gemini-3-flash")]);
    expect(chosen).toBe("gemini-3-flash");
  });

  it("never returns an embedding or image model", () => {
    const chosen = pickModel([
      m("models/embedding-001", ["embedContent"]),
      m("models/imagen-3.0-generate-002", ["predict"]),
      m("models/gemini-2.5-flash"),
    ]);
    expect(chosen).toBe("gemini-2.5-flash");
  });

  it("skips models that cannot do generateContent", () => {
    const chosen = pickModel([m("models/gemini-3-flash", ["countTokens"]), m("models/gemini-2.5-flash")]);
    expect(chosen).toBe("gemini-2.5-flash");
  });

  it("strips the models/ prefix", () => {
    expect(pickModel([m("models/gemini-3-flash")])).toBe("gemini-3-flash");
  });

  it("honours an explicit override when the API lists it", () => {
    expect(pickModel(REALISTIC, "gemini-3-pro")).toBe("gemini-3-pro");
    expect(pickModel(REALISTIC, "models/gemini-2.5-pro")).toBe("gemini-2.5-pro");
  });

  it("ignores a stale override the API does not list, rather than wedging", () => {
    // The whole point of discovery: a retired override must not break the app.
    const chosen = pickModel(REALISTIC, "gemini-1.0-pro-vision-latest");
    expect(chosen).not.toBe("gemini-1.0-pro-vision-latest");
    expect(chosen).toBeTruthy();
  });

  it("deprioritises preview and experimental builds", () => {
    const chosen = pickModel([
      m("models/gemini-3-flash-preview-11-2025"),
      m("models/gemini-3-flash"),
    ]);
    expect(chosen).toBe("gemini-3-flash");
  });

  it("prefers full flash over the lite variant", () => {
    const chosen = pickModel([m("models/gemini-3-flash-lite"), m("models/gemini-3-flash")]);
    expect(chosen).toBe("gemini-3-flash");
  });

  it("returns null when nothing is usable", () => {
    expect(pickModel([])).toBeNull();
    expect(pickModel([m("models/embedding-001", ["embedContent"])])).toBeNull();
  });

  it("survives malformed entries", () => {
    const dirty = [{ name: undefined } as unknown as ModelInfo, m("models/gemini-3-flash")];
    expect(pickModel(dirty)).toBe("gemini-3-flash");
  });

  it("accepts entries with no supportedGenerationMethods field", () => {
    expect(pickModel([{ name: "models/gemini-3-flash" }])).toBe("gemini-3-flash");
  });

  it("picks a sensible model from a realistic list", () => {
    const chosen = pickModel(REALISTIC);
    expect(chosen).toBeTruthy();
    expect(chosen).toContain("flash");
    expect(chosen).not.toContain("lite");
  });
});

describe("scoreModel", () => {
  it("disqualifies non-gemini and excluded families", () => {
    expect(scoreModel("models/embedding-001")).toBe(-Infinity);
    expect(scoreModel("models/imagen-3.0")).toBe(-Infinity);
    expect(scoreModel("models/veo-2")).toBe(-Infinity);
  });

  it("ranks newer flash above older flash", () => {
    expect(scoreModel("models/gemini-3-flash")).toBeGreaterThan(scoreModel("models/gemini-2.5-flash"));
  });

  it("ranks flash above pro of the same version", () => {
    expect(scoreModel("models/gemini-3-flash")).toBeGreaterThan(scoreModel("models/gemini-3-pro"));
  });
});
