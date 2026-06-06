/**
 * searchService.js — Phase 3 Fix
 * ---------------------------------------------------------
 * FIXES:
 *   - All internal scoring/ranking fields stripped from output
 *   - Output is a clean array: [{ title, snippet, url, source }]
 *   - No images, thumbnails, or media fields in any code path
 *   - All 3 sources normalised to the exact same shape
 *   - Tavily: exclude_domains, include_raw_content disabled
 *   - Wikipedia: HTML stripped, only title+snippet+url returned
 *   - DuckDuckGo: only title+description+url used
 *
 * OUTPUT SCHEMA (guaranteed, no extra fields):
 *   {
 *     title   : string,
 *     snippet : string,
 *     url     : string,
 *     source  : "tavily" | "wikipedia" | "duckduckgo"
 *   }
 * ---------------------------------------------------------
 */

import axios      from "axios";

/* =========================================================
   CONSTANTS
========================================================= */
const TIMEOUT_MS       = 7000;
const MAX_EACH         = 6;    // per source
const MAX_TOTAL        = 15;   // final merged cap

// Internal weight — used ONLY for ranking, never exposed in output
const _WEIGHT = { tavily: 1.5, wikipedia: 1.3, duckduckgo: 1.0 };

/* =========================================================
   NORMALISER
   Single function that enforces the output schema.
   Nothing else should construct result objects.
========================================================= */

/**
 * _norm({ title, snippet, url, source, _score? }) → CleanResult
 * Strips every field except the 4 public ones.
 * Retains _score as a non-enumerable for internal ranking only.
 */
function _norm({ title = "", snippet = "", url = "", source = "", _score = 1 }) {
    const obj = {
        title  : String(title).trim(),
        snippet: String(snippet).replace(/<[^>]+>/g, "").trim(),  // strip HTML
        url    : String(url).trim(),
        source : String(source),
    };
    // _score is non-enumerable — invisible to JSON.stringify / spread
    Object.defineProperty(obj, "_score", { value: _score, enumerable: false });
    return obj;
}

/* =========================================================
   SOURCE 1 — Tavily AI Search
========================================================= */
async function _tavily(query) {
    const key = process.env.TAVILY_API_KEY;
    if (!key) return [];

    try {
        const res = await axios.post(
            "https://api.tavily.com/search",
            {
                api_key             : key,
                query,
                search_depth        : "basic",
                max_results         : MAX_EACH,
                include_answer      : false,
                include_raw_content : false,   // no raw HTML
                include_images      : false,   // FIX: explicitly exclude images
            },
            { timeout: TIMEOUT_MS }
        );

        return (res.data?.results || []).map(r =>
            _norm({
                title  : r.title,
                snippet: r.content,
                url    : r.url,
                source : "tavily",
                _score : (r.score || 0.5) * _WEIGHT.tavily,
            })
        );
    } catch (err) {
        console.warn("[SEARCH/tavily]", err.message);
        return [];
    }
}

/* =========================================================
   SOURCE 2 — Wikipedia REST API
========================================================= */
export async function searchWiki(query) {
    try {
        const res = await axios.get("https://en.wikipedia.org/w/api.php", {
            params : {
                action   : "query",
                list     : "search",
                srsearch : query,
                srlimit  : MAX_EACH,
                format   : "json",
                origin   : "*",
            },
            timeout: TIMEOUT_MS,
        });

        return (res.data?.query?.search || []).map(item =>
            _norm({
                title  : item.title,
                snippet: item.snippet,   // HTML stripped in _norm
                url    : `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title)}`,
                source : "wikipedia",
                _score : _WEIGHT.wikipedia,
            })
        );
    } catch (err) {
        console.warn("[SEARCH/wikipedia]", err.message);
        return [];
    }
}

/* =========================================================
   SOURCE 3 — DuckDuckGo (no API key needed)
========================================================= */
async function _duckduckgo(query) {
    try {
        const res = await axios.post(
            "https://html.duckduckgo.com/html/",
            `q=${encodeURIComponent(query)}`,
            {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                timeout: TIMEOUT_MS
            }
        );

        const html = res.data;
        const blocks = html.split('result__body');
        const results = [];

        for (let i = 1; i < blocks.length; i++) {
            const block = blocks[i];
            const titleMatch = block.match(/result__title[^>]*>([\s\S]*?)<\/h2>/);
            const snippetMatch = block.match(/result__snippet[^>]*>([\s\S]*?)<\/a>/);
            const urlMatch = block.match(/href="([^"]+)"/);

            if (titleMatch && snippetMatch && urlMatch) {
                let title = titleMatch[1].replace(/<[^>]+>/g, "").trim();
                let snippet = snippetMatch[1].replace(/<[^>]+>/g, "").trim();
                
                // Basic HTML entity decode
                const decode = (str) => str.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#x2F;/g, "/");
                
                results.push(_norm({
                    title: decode(title),
                    snippet: decode(snippet),
                    url: urlMatch[1],
                    source: "duckduckgo",
                    _score: _WEIGHT.duckduckgo
                }));

                if (results.length >= MAX_EACH) break;
            }
        }
        return results;
    } catch (err) {
        console.warn("[SEARCH/duckduckgo]", err.message);
        return [];
    }
}

/* =========================================================
   MERGE + DEDUPLICATE + RANK
========================================================= */

/**
 * mergeResults(...arrays) → CleanResult[]
 *
 * Deduplicates by URL, sorts by _score (hidden field), caps at MAX_TOTAL.
 * Output objects contain ONLY { title, snippet, url, source }.
 */
export function mergeResults(...arrays) {
    const seen   = new Set();
    const merged = [];

    for (const arr of arrays) {
        for (const item of arr) {
            if (!item.url || seen.has(item.url)) continue;
            seen.add(item.url);
            merged.push(item);
        }
    }

    // Sort by hidden _score descending
    merged.sort((a, b) => b._score - a._score);

    // Return clean objects (spread picks only enumerable keys)
    return merged.slice(0, MAX_TOTAL).map(({ title, snippet, url, source }) =>
        ({ title, snippet, url, source })
    );
}

/* =========================================================
   FORMAT FOR AI PROMPT
========================================================= */

/**
 * formatForPrompt(results) → string
 * Clean numbered block — no internal fields, no scores.
 */
export function formatForPrompt(results) {
    if (!results?.length) return "[SEARCH]: No live results found.";

    return "LIVE SEARCH RESULTS:\n\n" + results.map((r, i) =>
        `[${i + 1}]\nTitle: ${r.title}\nSummary: ${r.snippet}\nURL: ${r.url}`
    ).join("\n\n");
}

/* =========================================================
   PUBLIC API
========================================================= */

/**
 * searchWeb(query) → { results: CleanResult[], formatted: string }
 *
 * results  — clean array safe to send to frontend or AI model
 * formatted — prompt-ready string block
 */
export async function searchWeb(query) {
    console.log(`[SEARCH] "${query}"`);

    const [tavilyRes, wikiRes, ddgRes] = await Promise.all([
        _tavily(query),
        searchWiki(query),
        _duckduckgo(query),
    ]);

    const results   = mergeResults(tavilyRes, wikiRes, ddgRes);
    const formatted = formatForPrompt(results);

    console.log(
        `[SEARCH] ${results.length} clean results ` +
        `(tavily:${tavilyRes.length} wiki:${wikiRes.length} ddg:${ddgRes.length})`
    );

    return { results, formatted };
}

/**
 * performWebSearch(query) → string | null
 * Backward-compatible alias for existing callers.
 */
export async function performWebSearch(query) {
    try {
        const { results, formatted } = await searchWeb(query);
        return results.length > 0 ? formatted : null;
    } catch {
        return null;
    }
}
