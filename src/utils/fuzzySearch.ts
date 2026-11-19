export interface HighlightSegment {
  text: string;
  match: boolean;
}

const COMBINING_MARK_RE = /[\u0300-\u036f\u0900-\u0903\u093a-\u094f\u0951-\u0957\u0962-\u0963]/;

export function normalizeFuzzyText(value: string): string {
  return value
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function stripFuzzyPunctuation(value: string): string {
  return normalizeFuzzyText(value).replace(/[-/.,:_()\s]+/g, '');
}

/**
 * Bounded Damerau-Levenshtein edit distance (supports adjacent transpositions).
 */
function damerauLevenshtein(a: string, b: string, maxDist: number): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > maxDist) return maxDist + 1;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    let rowMin = maxDist + 1;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let val = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        val = Math.min(val, dp[i - 2][j - 2] + cost);
      }
      dp[i][j] = val;
      if (val < rowMin) rowMin = val;
    }
    if (rowMin > maxDist) return maxDist + 1;
  }
  return dp[m][n];
}

/**
 * Scores an ordered character subsequence match (0 = no match).
 */
function subsequenceScore(token: string, target: string): number {
  if (!token || !target || token.length > target.length) return 0;
  let ti = 0;
  let firstIdx = -1;
  let lastIdx = -1;
  let consecutive = 0;
  let boundaryHits = 0;

  for (let qi = 0; qi < token.length; qi++) {
    const ch = token[qi];
    let found = false;
    while (ti < target.length) {
      if (target[ti] === ch) {
        if (firstIdx === -1) firstIdx = ti;
        if (lastIdx !== -1 && ti === lastIdx + 1) consecutive++;
        if (ti === 0 || /[\s\-_/.,]/.test(target[ti - 1])) boundaryHits++;
        lastIdx = ti;
        ti++;
        found = true;
        break;
      }
      ti++;
    }
    if (!found) return 0;
  }

  const span = lastIdx - firstIdx + 1;
  // Prevent overly sparse noise matches on multi-char queries
  if (token.length >= 3 && span > token.length * 3.5 + 4) {
    return 0;
  }

  const compactness = token.length / span;
  return Math.round(280 + compactness * 160 + consecutive * 18 + boundaryHits * 25);
}

/**
 * Scores a single normalized query token against a single normalized target field.
 */
function scoreSingleToken(token: string, target: string, compactTarget: string): number {
  if (!token || !target) return 0;

  if (target === token) return 1000;
  if (target.startsWith(token)) return 900;

  const words = target.split(/[\s\-_/.,()]+/).filter(Boolean);
  for (let i = 0; i < words.length; i++) {
    if (words[i] === token) return 870 - i * 4;
    if (words[i].startsWith(token)) return 820 - i * 4;
  }

  const subIdx = target.indexOf(token);
  if (subIdx !== -1) {
    return Math.max(660, 760 - subIdx * 2);
  }

  const compactToken = token.replace(/[-/.,:_()\s]+/g, '');
  if (compactToken.length >= 2) {
    const compactIdx = compactTarget.indexOf(compactToken);
    if (compactIdx !== -1) {
      return Math.max(600, 700 - compactIdx);
    }
  }

  // Edit-distance fuzzy matching for typos/transpositions on tokens >= 3 chars
  if (token.length >= 3) {
    const maxDist = token.length <= 5 ? 1 : 2;
    let bestEditScore = 0;

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      if (w.length < 2) continue;
      // Compare against full word OR prefix slice of word (for partial typing with typo)
      const candidates =
        w.length > token.length + 1
          ? [w, w.slice(0, token.length), w.slice(0, token.length + 1)]
          : [w];

      for (const cand of candidates) {
        const dist = damerauLevenshtein(token, cand, maxDist);
        if (dist <= maxDist) {
          const s = 540 - dist * 105 - i * 4;
          if (s > bestEditScore) bestEditScore = s;
        }
      }
    }

    if (bestEditScore > 0) return bestEditScore;
  }

  // Fallback: ordered subsequence
  return subsequenceScore(token, target);
}

/**
 * Computes a fuzzy relevance score for an item represented by multiple string fields.
 * Returns 0 when the query does not match. Higher scores = stronger match.
 */
export function fuzzyScoreItem(
  query: string,
  fields: Array<string | undefined | null>
): number {
  const nq = normalizeFuzzyText(query);
  if (!nq) return 1;

  const preparedFields = fields
    .filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
    .map((f, index) => {
      const norm = normalizeFuzzyText(f);
      return {
        norm,
        compact: stripFuzzyPunctuation(f),
        // Slight priority boost for primary fields (index 0, 1)
        fieldWeight: index === 0 ? 1.08 : index === 1 ? 1.03 : 1,
      };
    });

  if (preparedFields.length === 0) return 0;

  // Full query match against any single field
  let bestFullScore = 0;
  for (const field of preparedFields) {
    const s = scoreSingleToken(nq, field.norm, field.compact) * field.fieldWeight;
    if (s > bestFullScore) bestFullScore = s;
  }

  const tokens = nq.split(' ').filter(Boolean);
  if (tokens.length <= 1) {
    return Math.round(bestFullScore);
  }

  // Multi-token match: EVERY token must match at least one field (supports cross-field queries)
  let tokenScoreSum = 0;
  for (const tok of tokens) {
    let bestForToken = 0;
    for (const field of preparedFields) {
      const s = scoreSingleToken(tok, field.norm, field.compact) * field.fieldWeight;
      if (s > bestForToken) bestForToken = s;
    }
    if (bestForToken === 0) {
      return Math.round(bestFullScore);
    }
    tokenScoreSum += bestForToken;
  }

  const multiTokenScore = Math.round(tokenScoreSum / tokens.length) + 40;
  return Math.round(Math.max(bestFullScore, multiTokenScore));
}

export function fuzzyFilterAndRank<T>(
  items: T[],
  query: string,
  getFields: (item: T) => Array<string | undefined | null>
): T[] {
  const nq = normalizeFuzzyText(query);
  if (!nq) return items;

  const scored: Array<{ item: T; score: number; index: number }> = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const score = fuzzyScoreItem(nq, getFields(item));
    if (score > 0) {
      scored.push({ item, score, index: i });
    }
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.index - b.index;
  });

  return scored.map((entry) => entry.item);
}

/**
 * Produces grapheme-safe highlight segments for Devanagari/Marathi & Latin text.
 */
export function getFuzzyHighlightSegments(text: string, query: string): HighlightSegment[] {
  if (!text) return [];
  const normalizedDisplay = text.normalize('NFC');
  const nq = normalizeFuzzyText(query);
  if (!nq) return [{ text: normalizedDisplay, match: false }];

  const lowerDisplay = normalizedDisplay.toLowerCase();
  const len = normalizedDisplay.length;
  const matched = new Array<boolean>(len).fill(false);

  const tokens = Array.from(new Set([nq, ...nq.split(' ').filter((t) => t.length >= 1)])).sort(
    (a, b) => b.length - a.length
  );

  let anyHit = false;
  for (const tok of tokens) {
    if (!tok) continue;
    let from = 0;
    while (from < len) {
      const idx = lowerDisplay.indexOf(tok, from);
      if (idx === -1) break;
      anyHit = true;
      for (let k = idx; k < idx + tok.length && k < len; k++) {
        matched[k] = true;
      }
      from = idx + tok.length;
    }
  }

  // Fallback: ordered subsequence highlight if no contiguous token matched
  if (!anyHit) {
    const compactQ = nq.replace(/\s+/g, '');
    let ti = 0;
    const indices: number[] = [];
    for (let qi = 0; qi < compactQ.length; qi++) {
      const ch = compactQ[qi];
      let found = false;
      while (ti < len) {
        if (lowerDisplay[ti] === ch) {
          indices.push(ti);
          ti++;
          found = true;
          break;
        }
        ti++;
      }
      if (!found) break;
    }
    if (indices.length === compactQ.length) {
      for (const idx of indices) {
        matched[idx] = true;
      }
    }
  }

  // Expand highlights across Devanagari/Unicode combining marks so matras aren't split
  for (let i = 0; i < len; i++) {
    if (matched[i]) {
      let next = i + 1;
      while (next < len && COMBINING_MARK_RE.test(normalizedDisplay[next])) {
        matched[next] = true;
        next++;
      }
    }
  }

  const segments: HighlightSegment[] = [];
  let start = 0;
  let currentMatch = matched[0];
  for (let i = 1; i < len; i++) {
    if (matched[i] !== currentMatch) {
      segments.push({ text: normalizedDisplay.slice(start, i), match: currentMatch });
      start = i;
      currentMatch = matched[i];
    }
  }
  segments.push({ text: normalizedDisplay.slice(start), match: currentMatch });
  return segments;
}
