/**
 * Model selection for the Gemini API.
 *
 * WHY DISCOVER RATHER THAN HARDCODE
 * A pinned model name eventually breaks: Google retires models, and retirement
 * is per-project — "no longer available to new users" means a brand-new project
 * cannot use a model that an older project still can. So the correct name is not
 * knowable from the code, only from the account. This picks the best model the
 * caller's own key can actually see.
 *
 * Deliberately free of Deno APIs so the scoring is unit-testable.
 */

export interface ModelInfo {
  /** Fully qualified, e.g. "models/gemini-3-flash". */
  name: string;
  supportedGenerationMethods?: string[];
}

/** Model families that cannot serve text generation for this app. */
const EXCLUDED = /embedding|aqa|imagen|veo|tts|audio|learnlm|image-generation/i;

/**
 * Ranks a candidate. Higher is better.
 *
 * Priorities, in order of weight:
 *  - "flash" over "pro": this workload is short, high-frequency and cost
 *    sensitive; pro buys reasoning depth we don't need to phrase a total.
 *  - a "-latest" alias: it tracks Google's current pick, which is the whole
 *    point of not hardcoding.
 *  - higher version numbers.
 *  - stable over preview/experimental, which can vanish without notice.
 */
export function scoreModel(name: string): number {
  const id = name.replace(/^models\//, "").toLowerCase();
  if (!id.includes("gemini") || EXCLUDED.test(id)) return -Infinity;

  let score = 0;
  if (id.includes("flash")) score += 20;
  if (id.includes("lite")) score -= 5; // cheaper still, but weaker at extraction
  if (id.includes("latest")) score += 8;
  if (/preview|exp(erimental)?|\d{3,}/.test(id)) score -= 6;

  // Version: "gemini-3-flash" -> 3, "gemini-2.5-flash" -> 2.5
  const version = id.match(/gemini-(\d+(?:\.\d+)?)/);
  if (version) score += parseFloat(version[1]) * 4;

  return score;
}

/**
 * Chooses a model from what the API reports as available.
 *
 * @param models    entries from GET /v1beta/models
 * @param preferred an explicit override (GEMINI_MODEL); used only if the API
 *                  actually lists it, so a stale override can't wedge the app
 * @returns the bare model id (no "models/" prefix), or null if nothing is usable
 */
export function pickModel(models: ModelInfo[], preferred?: string | null): string | null {
  const usable = (models ?? []).filter(
    (m) =>
      typeof m?.name === "string" &&
      (m.supportedGenerationMethods === undefined ||
        m.supportedGenerationMethods.includes("generateContent"))
  );

  if (usable.length === 0) return null;

  const bare = (name: string) => name.replace(/^models\//, "");

  if (preferred) {
    const wanted = bare(preferred).toLowerCase();
    const match = usable.find((m) => bare(m.name).toLowerCase() === wanted);
    if (match) return bare(match.name);
  }

  const ranked = usable
    .map((m) => ({ id: bare(m.name), score: scoreModel(m.name) }))
    .filter((m) => m.score > -Infinity)
    // Sort by score, then by name for a stable result across equal scores.
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  return ranked.length > 0 ? ranked[0].id : null;
}
