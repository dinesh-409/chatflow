import axios from "axios";

async function testDDG() {
    try {
        const res = await axios.post(
            "https://html.duckduckgo.com/html/",
            `q=who+is+the+cm+of+tamilnadu+now`,
            {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }
        );

        const html = res.data;
        const blocks = html.split('result__body');
        const results = [];

        for (let i = 1; i < blocks.length; i++) {
            const block = blocks[i];
            const titleMatch = block.match(/result__title[^>]*>([\s\S]*?)<\/h2>/);
            const snippetMatch = block.match(/result__snippet[^>]*>([\s\S]*?)<\/a>/);
            
            if (titleMatch && snippetMatch) {
                results.push({
                    title: titleMatch[1].replace(/<[^>]+>/g, "").trim(),
                    snippet: snippetMatch[1].replace(/<[^>]+>/g, "").trim()
                });
            }
        }
        console.log(results.slice(0, 3));
    } catch (e) {
        console.error(e.message);
    }
}
testDDG();
