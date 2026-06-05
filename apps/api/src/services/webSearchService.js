import { search } from "duck-duck-scrape";

export async function performWebSearch(query) {
    try {
        console.log(`[WEB SEARCH] Triggered for query: "${query}"`);
        const searchResults = await search(query, {
            safeSearch: "moderate",
            time: "y" // Last year to ensure recency
        });

        if (!searchResults.results || searchResults.results.length === 0) {
            return null;
        }

        // Take the top 3 results and format them into a neat string
        const topResults = searchResults.results.slice(0, 3);
        
        let formattedData = "LIVE SEARCH RESULTS:\n\n";
        topResults.forEach((res, index) => {
            formattedData += `[Result ${index + 1}]\n`;
            formattedData += `Title: ${res.title}\n`;
            formattedData += `Snippet: ${res.description}\n`;
            formattedData += `Source: ${res.url}\n\n`;
        });

        return formattedData.trim();
    } catch (error) {
        console.error("[WEB SEARCH ERROR]", error);
        return null; // Fail gracefully
    }
}
