import fs from "fs";
import { parseFileLocal } from "./src/services/fileParser.js";

async function test() {
    // Create a dummy text file
    fs.writeFileSync("uploads/test.txt", "hello world");
    const resTxt = await parseFileLocal("/uploads/test.txt");
    console.log("TXT:", resTxt);

    // Create a dummy PDF? No, just call with something that throws
}
test();
