import fs from "fs";
import path from "path";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
const officeParser = require("officeparser");

export async function parseFileLocal(fileUrl) {
    // URL looks like /uploads/123-file.pdf
    const filename = fileUrl.split("/uploads/")[1];
    if (!filename) return null;

    const filePath = path.join(process.cwd(), "uploads", filename);
    if (!fs.existsSync(filePath)) return null;

    const ext = path.extname(filePath).toLowerCase();
    
    try {
        if (ext === ".pdf") {
            const dataBuffer = fs.readFileSync(filePath);
            const data = await pdfParse(dataBuffer);
            return data.text;
        } else if (ext === ".txt" || ext === ".md" || ext === ".json" || ext === ".csv") {
            return fs.readFileSync(filePath, "utf-8");
        } else if (ext === ".doc" || ext === ".docx" || ext === ".ppt" || ext === ".pptx") {
            const data = await officeParser.parseOfficeAsync(filePath);
            return data;
        } else {
            // Unhandled binary type or image
            return `[File attached: ${filename}. Content could not be parsed as text.]`;
        }
    } catch (err) {
        console.error(`[FILE PARSER ERROR] ${err.message}`);
        return `[Error parsing file: ${filename}]`;
    }
}
