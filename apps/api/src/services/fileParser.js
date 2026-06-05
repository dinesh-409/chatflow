import fs from "fs";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const pdfParse = require("pdf-parse");
const WordExtractor = require("word-extractor");
const mammoth = require("mammoth");
const PDFParser = require("pdf2json");

// Helper function for pdf2json fallback
function parsePDFjson(filePath) {
    return new Promise((resolve, reject) => {
        const pdfParser = new PDFParser(this, 1);
        pdfParser.on("pdfParser_dataError", errData => reject(errData.parserError));
        pdfParser.on("pdfParser_dataReady", pdfData => resolve(pdfParser.getRawTextContent()));
        pdfParser.loadPDF(filePath);
    });
}

export async function parseFileLocal(fileUrl) {
    const filename = fileUrl.split("/uploads/")[1];
    if (!filename) return null;

    const filePath = path.join(process.cwd(), "uploads", filename);
    if (!fs.existsSync(filePath)) return null;

    const ext = path.extname(filePath).toLowerCase();
    
    try {
        if (ext === ".pdf") {
            try {
                // Primary: pdf-parse
                const dataBuffer = fs.readFileSync(filePath);
                const data = await pdfParse(dataBuffer);
                if (data && data.text && data.text.trim().length > 0) {
                    return data.text;
                }
                throw new Error("pdf-parse returned empty");
            } catch (e) {
                // Fallback: pdf2json
                console.log(`[FILE PARSER] pdf-parse failed, falling back to pdf2json for ${filename}`);
                const text = await parsePDFjson(filePath);
                return text;
            }
        } else if (ext === ".txt" || ext === ".md" || ext === ".json" || ext === ".csv") {
            return fs.readFileSync(filePath, "utf-8");
        } else if (ext === ".doc") {
            const extractor = new WordExtractor();
            const extracted = await extractor.extract(filePath);
            return extracted.getBody();
        } else if (ext === ".docx") {
            const result = await mammoth.extractRawText({ path: filePath });
            return result.value;
        } else {
            return `[SYSTEM NOTE: The file ${filename} has an unsupported extension (${ext}). Inform the user politely.]`;
        }
    } catch (err) {
        console.error(`[FILE PARSER ERROR] ${err.message}`);
        return `[Error parsing file: ${filename}]`;
    }
}
