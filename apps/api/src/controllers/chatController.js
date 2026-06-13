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
import { buildSystemPrompt }                          from "../services/systemPromptService.js";
import {
    saveMessage,
    addMessage,
    injectMemoryToPrompt,
    getMemory,
    getGlobalMemory,
    truncateHistory,
}                                                     from "../services/memoryService.js";
import { createSession }                              from "../services/sessionService.js";
import { parseFile, summarizeChunks }                 from "../services/fileService.js";
import { searchWeb, performWebSearch }                from "../services/searchService.js";
import { sendSuccess, sendError }                     from "../utils/responseHandler.js";
import { GEMINI_DISPLAY_NAME }                        from "../config/modelConfig.js";
import FileDocument                                   from "../models/FileDocument.js";
import { retrieveSemanticChunks }                     from "../services/ragService.js";

/* =========================================================
   HELPERS
========================================================= */
const _userId     = (req) => req.user?.id || "anonymous";
const _nameOf     = (mode) => ({
    gemini     : GEMINI_DISPLAY_NAME,
    openrouter : "OpenRouter GPT-4o",
    groq       : "Groq Llama 3.1",
}[mode] || GEMINI_DISPLAY_NAME);

/* =========================================================
   POST /api/chat — Sync JSON (routing metadata + stub)
========================================================= */
export const handleBasicChat = async (req, res) => {
    const { message, mode = "auto" } = req.body;
    if (!message) return sendError(res, "Message is required", 400);

    // SINGLE routing call — no legacy chooseModel
    const decision = selectModel(message, {}, mode);

    console.log(
        `[ROUTER] intent="${decision.intent}" | model="${decision.displayName}" | isLive="${decision.isLiveQuery}" | ${decision.reason}`
    );

    // Consistent response envelope
    return sendSuccess(res, {
        answer    : `[STUB] Will be handled by ${decision.displayName}. Connect Phase 4 streaming.`,
        model_used: decision.displayName,
        intent    : decision.intent,
        sources   : [],
    });
};

/* =========================================================
   POST /api/chat-stream — SSE Full Pipeline
========================================================= */
export const handleChatStream = async (req, res) => {
    const { message, sessionId, mode = "auto", truncateAfterIndex } = req.body;
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

        /* ── STEP 0: HISTORY TRUNCATION ───────────────────────── */
        if (truncateAfterIndex !== undefined && truncateAfterIndex !== null) {
            await truncateHistory(sessionId, truncateAfterIndex);
        }

        /* ── STEP 1: AI ROUTER (run FIRST, drives all decisions) ──
           FIX: selectModel is called once, result used everywhere.
           No secondary chooseModel call.
        ─────────────────────────────────────────────────────── */
        const decision    = selectModel(message, {}, mode);
        const needsSearch = decision.needsSearch;

        // Effective stream model: if search needed, gemini synthesises
        const streamMode  = (mode !== "auto")
            ? mode
            : (decision.model === "search" ? "gemini" : decision.model);

        console.log(
            `[ROUTER] intent="${decision.intent}" | model="${_nameOf(streamMode)}" | isLive="${decision.isLiveQuery}" | ${decision.reason}`
        );

        /* ── STEP 2: FILE PROCESSING ──────────────────────────── */
        const fileRegex = /\[Attached Files:\s*(.+?)\]/g;
        let match;
        while ((match = fileRegex.exec(message)) !== null) {
            const urls = match[1].split(", ");
            for (const url of urls) {
                if (!url.includes("/uploads/")) continue;
                // Avoid heavy re-parsing. Fetch the already processed document from MongoDB
                const fileDoc = await FileDocument.findOne({ url, sessionId, userId });
                if (fileDoc) {
                    const content = fileDoc.summary || fileDoc.chunks.join("\n\n").substring(0, 10000);
                    fileContext += `\n<document filename="${fileDoc.filename}">\n${content}\n</document>\n`;
                }
            }
            modifiedMessage = modifiedMessage.replace(match[0], "[Files Processed]");
        }
        if (fileContext) {
            modifiedMessage = `<attached_files>\n${fileContext}</attached_files>\n\n` + modifiedMessage;
        }

        /* ── STEP 2.5: DOCUMENT RETRIEVAL ─────────────────────── */
        // Search historical files uploaded in this session for context
        if (!fileContext && !decision.isLiveQuery) {
             const relevantChunks = await retrieveSemanticChunks(userId, message, 5);
             if (relevantChunks.length > 0) {
                 let retrievedContext = "";
                 for (let i = 0; i < relevantChunks.length; i++) {
                     const chunk = relevantChunks[i];
                     retrievedContext += `<retrieved_chunk id="${i+1}" filename="${chunk.filename}">\n${chunk.text}\n</retrieved_chunk>\n\n`;
                 }
                 modifiedMessage = `<knowledge_base_context>\nThe user has previously uploaded files containing this relevant information. You MUST cite them using [filename] if you use this information:\n${retrievedContext}</knowledge_base_context>\n\n` + modifiedMessage;
                 console.log(`[RAG] Injected ${relevantChunks.length} semantic chunks from Pinecone`);
             }
        }

        /* ── STEP 3: SEARCH INJECTION ─────────────────────────── */
        if (needsSearch) {
            const { results, formatted } = await searchWeb(message);
            if (results.length > 0) {
                searchSources   = results;   // clean { title, snippet, url, source }[]
                // formatted string normally looks like "Source 1...", wrap it in XML
                modifiedMessage = `<live_search_results>\n${formatted}\n</live_search_results>\n\n` + modifiedMessage;
                console.log(`[SEARCH] ${results.length} clean results injected`);
            } else {
                if (decision.isLiveQuery) {
                    // Search Validation Failure for Live Queries
                    modifiedMessage = `<search_validation>\nSearch failed. DO NOT GUESS. State explicitly that real-time information is unavailable.\n</search_validation>\n\n` + modifiedMessage;
                } else {
                    modifiedMessage = `<live_search_results>\nLive search returned no results.\n</live_search_results>\n\n` + modifiedMessage;
                }
            }
        }

        /* ── STEP 4: SESSION MANAGEMENT ───────────────────────── */
        const session = await createSession(sessionId, userId);
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
        let contextSummary = "";
        // Prevent memory injection if this is a live factual query to strictly ground the model
        if (!decision.isLiveQuery) {
            const memoryResult = await injectMemoryToPrompt("", sessionId, message, userId);
            contextSummary = memoryResult.contextSummary;
        } else {
            console.log(`[MEMORY] Bypassed injection due to isLiveQuery Anti-Hallucination rules`);
        }

        /* ── STEP 7: ASSEMBLE PROMPT ──────────────────────────── */
        const systemPrompt = buildSystemPrompt({ 
            intent: decision.intent, 
            responseType: decision.responseType,
            complexity: decision.complexity, 
            isLiveQuery: decision.isLiveQuery,
            isFollowUp: decision.isFollowUp 
        });
        
        const finalPrompt = `${systemPrompt}\n\n${contextSummary}\n\n<current_message>\nUser: ${modifiedMessage}\n</current_message>`;

        // (Metadata is no longer sent via SSE stream to prevent leakage.
        // It is saved to the DB below and can be fetched via standard JSON API)

        /* ── STEP 8: STREAM AI RESPONSE ───────────────────────── */
        // FIX: pass streamMode (the actual model id) and complexity
        const stream = await aiRouterStream({ message: finalPrompt, mode: streamMode, complexity: decision.complexity });

        let fullResponse = "";
        let aborted      = false;
        req.on("close", () => { aborted = true; });

        for await (const chunk of stream) {
            if (aborted) break;
            const text = chunk.toString();
            fullResponse += text;
            res.write(`data: ${JSON.stringify({ type: "token", text })}\n\n`);
        }

        /* ── STEP 9: DONE EVENT ───────────────────────────────── */
        if (!aborted) {
            // Append model used to the text explicitly per user request
            const modelBadge = `\n\n**Model Used:** ${_nameOf(streamMode)}`;
            fullResponse += modelBadge;
            res.write(`data: ${JSON.stringify({ type: "token", text: modelBadge })}\n\n`);
            
            // Only send standard [DONE] to close stream, omitting {type: "done"} object to prevent UI text leakage
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
