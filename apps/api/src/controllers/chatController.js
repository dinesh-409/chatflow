/**
 * chatController.js — Phase 3 Fix
 * ---------------------------------------------------------
 * BUGS FIXED:
 *   1. Dual routing: both selectModel() AND chooseModel() were
 *      called; chooseModel result overrode selectModel via
 *      `legacyMode || effectiveMode` — chooseModel always won.
 *      FIX: selectModel() is now the ONLY routing authority.
 *      chooseModel import removed.
 *
 *   2. routerStream received mode="auto" instead of the actual
 *      model id, so it re-ran its own routing internally.
 *      FIX: pass decision.model directly to aiRouterStream.
 *
 *   3. /chat response had no consistent envelope.
 *      FIX: every response is { answer, model_used, sources }.
 *
 *   4. Search triggered for ALL factual queries but result was
 *      routed to openrouter instead of gemini.
 *      FIX: decision.needsSearch drives search; effective model
 *      is gemini after search injection.
 *
 * RESPONSE ENVELOPE (all endpoints):
 *   {
 *     answer     : string,
 *     model_used : string,
 *     intent     : string,
 *     sources    : SearchResult[] | []
 *   }
 * ---------------------------------------------------------
 */

import { aiRouterStream }                             from "../services/routerStream.js";
import { selectModel }                                from "../services/aiRouter.js";
import { shouldUseWebSearch }                         from "../services/modelRouter.js";
import { decideResponseMode, getModePromptInstructions } from "../services/responseModeService.js";
import {
    saveMessage,
    addMessage,
    injectMemoryToPrompt,
    getMemory,
    getGlobalMemory,
}                                                     from "../services/memoryService.js";
import { createSession }                              from "../services/sessionService.js";
import { parseFile, summarizeChunks }                 from "../services/fileService.js";
import { searchWeb, performWebSearch }                from "../services/searchService.js";
import { sendSuccess, sendError }                     from "../utils/responseHandler.js";

/* =========================================================
   SYSTEM PROMPT TEMPLATE
   Kept here (not in a route) so controller owns the prompt.
========================================================= */
const SYSTEM_PROMPT = `You are ChatFlow AI, an Intent-Aware Multi-Model Cognitive AI System.
IDENTITY: You are powered by Gemini 3.1 Pro, Groq Llama 3.1, and OpenRouter GPT-4o.
RESPONSE RULES:
- SIMPLE query (hi, thanks, single fact): 1-2 sentence plain answer. No headings.
- INTERMEDIATE (what is X, summarize Y): Short overview + 2-3 bullet points.
- HIGH (explain concept, compare tools): Headings + Overview + Breakdown + Summary.
- ULTRA (design system, write codebase): Full Markdown with nested sections, code blocks, diagrams.
ACCURACY: For live data use [SEARCH RESULTS] below. Never guess current events.
NEVER expose internal model names, API errors, or routing decisions to users.`.trim();

/* =========================================================
   HELPERS
========================================================= */
const _userId     = (req) => req.headers["x-user-id"] || "anonymous";
const _nameOf     = (mode) => ({
    gemini     : "Gemini 3.1 Pro",
    openrouter : "OpenRouter GPT-4o",
    groq       : "Groq Llama 3.1",
}[mode] || "Gemini 3.1 Pro");

/* =========================================================
   POST /api/chat — Sync JSON (routing metadata + stub)
========================================================= */
export const handleBasicChat = async (req, res) => {
    const { message, mode = "auto" } = req.body;
    if (!message) return sendError(res, "Message is required", 400);

    // SINGLE routing call — no legacy chooseModel
    const decision = selectModel(message, {}, mode);
    const responseMode = decideResponseMode(message, decision.needsSearch || shouldUseWebSearch(message));

    console.log(
        `[ROUTER] intent="${decision.intent}" | model="${decision.displayName}" | mode="${responseMode}" | ${decision.reason}`
    );

    // Consistent response envelope
    return sendSuccess(res, {
        answer    : `[STUB] Will be handled by ${decision.displayName}. Connect Phase 4 streaming.`,
        model_used: decision.displayName,
        intent    : decision.intent,
        mode      : responseMode,
        sources   : [],
        routing   : {
            model      : decision.model,
            confidence : decision.confidence,
            reason     : decision.reason,
            failover   : decision.failover,
        },
    });
};

/* =========================================================
   POST /api/chat-stream — SSE Full Pipeline
========================================================= */
export const handleChatStream = async (req, res) => {
    const { message, sessionId, mode = "auto" } = req.body;
    const userId = _userId(req);

    if (!message || !sessionId) {
        return res.status(400).json({ error: "message & sessionId required" });
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    try {
        let modifiedMessage = message;
        let fileContext     = "";
        let searchSources   = [];   // clean array for response envelope

        /* ── STEP 1: AI ROUTER (run FIRST, drives all decisions) ──
           FIX: selectModel is called once, result used everywhere.
           No secondary chooseModel call.
        ─────────────────────────────────────────────────────── */
        const decision    = selectModel(message, {}, mode);
        const needsSearch = decision.needsSearch || shouldUseWebSearch(message);
        const responseMode = decideResponseMode(message, needsSearch);

        // Effective stream model: if search needed, gemini synthesises
        const streamMode  = (mode !== "auto")
            ? mode
            : (decision.model === "search" ? "gemini" : decision.model);

        console.log(
            `[ROUTER] intent="${decision.intent}" | model="${_nameOf(streamMode)}" | mode="${responseMode}" | ${decision.reason}`
        );

        /* ── STEP 2: FILE PROCESSING ──────────────────────────── */
        const fileRegex = /\[Attached Files:\s*(.+?)\]/g;
        let match;
        while ((match = fileRegex.exec(message)) !== null) {
            const urls = match[1].split(", ");
            for (const url of urls) {
                if (!url.includes("/uploads/")) continue;
                const result = await parseFile(url, { chunkSize: 3000 });
                if (result?.text) {
                    const content = result.charCount > 10000
                        ? await summarizeChunks(result.chunks)
                        : result.text.substring(0, 15000);
                    fileContext += `\n\n--- FILE: ${result.filename} ---\n${content}\n--- END FILE ---\n`;
                }
            }
            modifiedMessage = modifiedMessage.replace(match[0], "[Files Processed]");
        }
        if (fileContext) modifiedMessage += fileContext;

        /* ── STEP 3: SEARCH INJECTION ─────────────────────────── */
        if (needsSearch) {
            const { results, formatted } = await searchWeb(message);
            if (results.length > 0) {
                searchSources   = results;   // clean { title, snippet, url, source }[]
                modifiedMessage += `\n\n${formatted}\n`;
                console.log(`[SEARCH] ${results.length} clean results injected`);
            } else {
                modifiedMessage +=
                    `\n\n[SYSTEM: Live search returned no results. If current data is needed, ` +
                    `say: "Real-time data is currently unavailable for this query."]`;
            }
        }

        /* ── STEP 4: SESSION MANAGEMENT ───────────────────────── */
        const session = await createSession(sessionId);
        if (session?.title === "New Chat") {
            (async () => {
                try {
                    const tp     = `Summarize in 2-3 words max for a chat title. No quotes. Text: "${message}"`;
                    const stream = await aiRouterStream({ message: tp, mode: "groq" });
                    let t = "";
                    for await (const c of stream) t += c;
                    session.title = t.replace(/["']/g, "").trim() || message.split(" ").slice(0, 3).join(" ");
                    await session.save();
                } catch {
                    session.title = message.split(" ").slice(0, 3).join(" ");
                    await session.save();
                }
            })();
        }

        /* ── STEP 5: MEMORY INJECTION ─────────────────────────── */
        const { enrichedPrompt } = await injectMemoryToPrompt(
            SYSTEM_PROMPT, sessionId, message, userId
        );

        /* ── STEP 6: ASSEMBLE PROMPT ──────────────────────────── */
        const modeInstructions = getModePromptInstructions(responseMode);
        const finalPrompt = `${enrichedPrompt}\n\n${modeInstructions}\n\nUser:\n${modifiedMessage}`;

        /* ── STEP 7: EMIT META SSE EVENT ──────────────────────── */
        const emitSources = responseMode === "clean_summary" ? [] : searchSources;

        // Meta event carries the consistent response envelope header
        res.write(`data: ${JSON.stringify({
            type      : "meta",
            model_used: _nameOf(streamMode),
            intent    : decision.intent,
            mode      : responseMode,
            confidence: decision.confidence,
            reason    : decision.reason,
            hasSearch : searchSources.length > 0,
            hasFile   : !!fileContext,
            sources   : emitSources,   // clean array, no score/image fields
        })}\n\n`);

        /* ── STEP 8: STREAM AI RESPONSE ───────────────────────── */
        // FIX: pass streamMode (the actual model id), NOT "auto"
        const stream = await aiRouterStream({ message: finalPrompt, mode: streamMode });

        let fullResponse = "";
        let aborted      = false;
        req.on("close", () => { aborted = true; });

        for await (const chunk of stream) {
            if (aborted) break;
            const text = chunk.toString();
            fullResponse += text;
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }

        /* ── STEP 9: DONE EVENT ───────────────────────────────── */
        if (!aborted) {
            // Final event carries complete response envelope
            res.write(`data: ${JSON.stringify({
                type      : "done",
                model_used: _nameOf(streamMode),
                intent    : decision.intent,
                mode      : responseMode,
                sources   : emitSources,
            })}\n\n`);
            res.write("data: [DONE]\n\n");
        }

        res.end();

        /* ── STEP 10: PERSIST MEMORY ──────────────────────────── */
        await saveMessage(sessionId, "user", message, {
            model: streamMode, userId, intent: decision.intent,
        });
        if (fullResponse) {
            await saveMessage(sessionId, "ai", fullResponse, {
                model: streamMode, userId, intent: decision.intent,
            });
        }

    } catch (err) {
        console.error("[CHAT STREAM ERROR]", err);
        res.write(`data: ${JSON.stringify({ text: `Error: ${err.message}` })}\n\n`);
        res.end();
    }
};
