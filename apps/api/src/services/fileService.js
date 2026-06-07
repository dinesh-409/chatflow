/**
 * fileService.js
 * ---------------------------------------------------------
 * ChatFlow Phase 3 — File Processing & Document Intelligence
 *
 * Provides:
 *   parseFile(fileUrl)             — detect type + extract text
 *   extractText(filePath, ext)     — per-format text extraction
 *   chunkText(text, chunkSize?)    — split large docs into chunks
 *   summarizeChunks(chunks, model) — AI summarise each chunk, merge
 *
 * Supported formats: PDF, DOCX, DOC, TXT, MD, JSON, CSV
 *
 * This replaces the inline logic in fileParser.js.
 * fileParser.js is kept for backward compatibility —
 * its parseFileLocal() now delegates here.
 * ---------------------------------------------------------
 */

import fs   from "fs";
import path from "path";
import { createRequire } from "module";
import axios from "axios";

const require = createRequire(import.meta.url);
const pdfParse      = require("pdf-parse");
const WordExtractor  = require("word-extractor");
const mammoth        = require("mammoth");
const PDFParser      = require("pdf2json");
const xlsx           = require("xlsx");
const tesseract      = require("tesseract.js");

/* =========================================================
   CONSTANTS
========================================================= */
const DEFAULT_CHUNK_SIZE    = 3000;   // chars per chunk
const DEFAULT_CHUNK_OVERLAP = 200;    // overlap between chunks
const MAX_FILE_CHARS        = 60000;  // hard cap on extracted text
const UPLOAD_DIR            = path.join(process.cwd(), "uploads");

/* =========================================================
   HELPERS — pdf2json fallback
========================================================= */
function _parsePDFJson(filePath) {
    return new Promise((resolve, reject) => {
        const parser = new PDFParser(null, 1);
        parser.on("pdfParser_dataError", e => reject(e.parserError));
        parser.on("pdfParser_dataReady", () => resolve(parser.getRawTextContent()));
        parser.loadPDF(filePath);
    });
}

/* =========================================================
   extractText(filePath, ext) -> string
========================================================= */

/**
 * Extract raw text from a file given its absolute path and extension.
 *
 * @param {string} filePath — absolute path on disk
 * @param {string} ext      — lowercase extension including dot, e.g. ".pdf"
 * @returns {string}
 */
export async function extractText(filePath, ext) {
    switch (ext) {
        case ".pdf": {
            try {
                const buf  = fs.readFileSync(filePath);
                const data = await pdfParse(buf);
                if (data?.text?.trim()) return data.text;
                throw new Error("pdf-parse empty");
            } catch {
                console.log("[FILE SERVICE] Falling back to pdf2json");
                return await _parsePDFJson(filePath);
            }
        }

        case ".txt":
        case ".md":
        case ".json":
        case ".csv":
            return fs.readFileSync(filePath, "utf-8");

        case ".doc": {
            const extractor = new WordExtractor();
            const extracted = await extractor.extract(filePath);
            return extracted.getBody();
        }

        case ".docx": {
            const result = await mammoth.extractRawText({ path: filePath });
            return result.value;
        }

        case ".xlsx":
        case ".xls": {
            const workbook = xlsx.readFile(filePath);
            let combinedText = "";
            for (const sheetName of workbook.SheetNames) {
                const sheet = workbook.Sheets[sheetName];
                const csv = xlsx.utils.sheet_to_csv(sheet);
                combinedText += `\n--- Sheet: ${sheetName} ---\n${csv}`;
            }
            return combinedText;
        }

        case ".png":
        case ".jpg":
        case ".jpeg": {
            console.log(`[FILE SERVICE] Running OCR on ${filePath}`);
            const { data: { text } } = await tesseract.recognize(filePath, "eng", { logger: m => {} });
            return text;
        }

        case ".js": case ".ts": case ".py": case ".java": case ".cpp": case ".c": case ".cs": case ".html": case ".css": case ".php": case ".rb": case ".go": case ".rs":
            return `--- Code File: ${path.basename(filePath)} ---\n\n${fs.readFileSync(filePath, "utf-8")}`;

        default:
            return `[SYSTEM: Unsupported file type "${ext}". Please upload PDF, DOCX, DOC, TXT, MD, JSON, CSV, XLSX, Image, or Code files.]`;
    }
}

/* =========================================================
   chunkText(text, chunkSize?, overlap?) -> string[]
========================================================= */

/**
 * Split a large text string into overlapping chunks.
 *
 * Tries to split on paragraph boundaries first, then
 * falls back to hard character splitting.
 *
 * @param {string} text
 * @param {number} chunkSize    — target chars per chunk
 * @param {number} overlap      — chars shared between chunks
 * @returns {string[]}
 */
export function chunkText(
    text,
    chunkSize = DEFAULT_CHUNK_SIZE,
    overlap   = DEFAULT_CHUNK_OVERLAP
) {
    if (!text || text.length <= chunkSize) return [text];

    const chunks = [];
    // Try paragraph-boundary splitting first
    const paragraphs = text.split(/\n{2,}/);
    let current = "";

    for (const para of paragraphs) {
        if ((current + para).length > chunkSize) {
            if (current) chunks.push(current.trim());
            // If a single paragraph is too long, hard-split it
            if (para.length > chunkSize) {
                for (let i = 0; i < para.length; i += chunkSize - overlap) {
                    chunks.push(para.slice(i, i + chunkSize).trim());
                }
                current = "";
            } else {
                current = para;
            }
        } else {
            current += (current ? "\n\n" : "") + para;
        }
    }
    if (current.trim()) chunks.push(current.trim());

    return chunks.filter(c => c.length > 0);
}

/* =========================================================
   summarizeChunks(chunks, modelMode?) -> string
========================================================= */

/**
 * Send each chunk to a fast AI model for summarisation,
 * then merge all chunk summaries into a final document summary.
 *
 * Uses Groq (fast) for chunk passes, then Gemini for final merge.
 * Falls back to raw concatenation if API unavailable.
 *
 * @param {string[]} chunks
 * @param {string}   modelMode — "groq" | "gemini" (default: "groq")
 * @returns {string}  — final merged summary
 */
export async function summarizeChunks(chunks, modelMode = "groq") {
    if (!chunks || chunks.length === 0) return "";
    if (chunks.length === 1) return chunks[0];   // no summarisation needed

    const chunkSummaries = [];

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        try {
            const summary = await _callAI(
                `Summarize this section of a document concisely. Keep all key facts:\n\n${chunk}`,
                modelMode
            );
            chunkSummaries.push(summary);
            console.log(`[FILE SERVICE] Chunk ${i + 1}/${chunks.length} summarised`);
        } catch (err) {
            // If AI fails on a chunk, use raw text (truncated)
            chunkSummaries.push(chunk.substring(0, 500) + "...[truncated]");
            console.warn(`[FILE SERVICE] Chunk ${i + 1} summarisation failed: ${err.message}`);
        }
    }

    // Final merge pass
    const merged = chunkSummaries.join("\n\n---\n\n");
    if (chunkSummaries.length === 1) return merged;

    try {
        const finalSummary = await _callAI(
            `You have been given summaries of multiple sections of a document. ` +
            `Write a single coherent summary that captures all key points:\n\n${merged}`,
            "gemini"   // use Gemini for final merge (better coherence)
        );
        return finalSummary;
    } catch {
        return merged;   // return chunk summaries joined if final merge fails
    }
}

/* =========================================================
   parseFile(fileUrl) -> { text, chunks, summary, filename, ext }
========================================================= */

/**
 * Full document processing pipeline.
 * Accepts either a URL path like "/uploads/file.pdf"
 * or an absolute file path.
 *
 * @param {string} fileUrl
 * @param {{ summarize?: boolean, chunkSize?: number }} opts
 * @returns {{ text, chunks, summary, filename, ext, charCount }}
 */
export async function parseFile(fileUrl, opts = {}) {
    const { summarize = false, chunkSize = DEFAULT_CHUNK_SIZE } = opts;

    // Resolve file path
    let filePath;
    if (fileUrl.includes("/uploads/")) {
        const filename = fileUrl.split("/uploads/")[1];
        filePath = path.join(UPLOAD_DIR, filename);
    } else {
        filePath = fileUrl;
    }

    const filename = path.basename(filePath);
    const ext      = path.extname(filePath).toLowerCase();

    if (!fs.existsSync(filePath)) {
        return {
            text     : `[FILE NOT FOUND: ${filename}]`,
            chunks   : [],
            summary  : "",
            filename,
            ext,
            charCount: 0,
        };
    }

    // Extract text
    let text;
    try {
        text = await extractText(filePath, ext);
    } catch (err) {
        console.error(`[FILE SERVICE] extractText error for ${filename}:`, err.message);
        text = `[ERROR extracting ${filename}: ${err.message}]`;
    }

    // Hard cap
    if (text.length > MAX_FILE_CHARS) {
        text = text.substring(0, MAX_FILE_CHARS) + "\n...[Document truncated at 60,000 chars]";
    }

    // Chunk
    const chunks = chunkText(text, chunkSize);

    // Optional AI summarisation
    let summary = "";
    if (summarize && chunks.length > 1) {
        try {
            summary = await summarizeChunks(chunks);
        } catch (err) {
            console.warn("[FILE SERVICE] summarizeChunks failed:", err.message);
        }
    }

    console.log(
        `[FILE SERVICE] Parsed "${filename}" | ${text.length} chars | ` +
        `${chunks.length} chunks${summary ? " | summarised" : ""}`
    );

    return { text, chunks, summary, filename, ext, charCount: text.length };
}

/**
 * Backward-compatible shim for fileParser.js callers.
 * Returns just the text string (or null).
 */
export async function parseFileLocal(fileUrl) {
    try {
        const result = await parseFile(fileUrl);
        return result.text || null;
    } catch {
        return null;
    }
}

/* =========================================================
   PRIVATE — AI call helper
========================================================= */
async function _callAI(prompt, model = "groq") {
    if (model === "groq") {
        const res = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                model    : "llama-3.1-8b-instant",
                messages : [{ role: "user", content: prompt }],
            },
            {
                headers : {
                    Authorization  : `Bearer ${process.env.GROQ_API_KEY}`,
                    "Content-Type" : "application/json",
                },
                timeout: 15000,
            }
        );
        return res.data.choices[0].message.content;
    }

    // gemini fallback
    const res = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { contents: [{ parts: [{ text: prompt }] }] },
        { timeout: 15000 }
    );
    return res.data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}
