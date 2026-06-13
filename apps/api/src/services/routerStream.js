async function callGemini(message) {
    try {
        const url =
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

        console.log("=================================");
        console.log("GEMINI DEBUG");
        console.log("=================================");
        console.log("KEY EXISTS:", !!process.env.GEMINI_API_KEY);
        console.log(
            "KEY PREFIX:",
            process.env.GEMINI_API_KEY
                ? process.env.GEMINI_API_KEY.substring(0, 10)
                : "NO_KEY"
        );
        console.log(
            "ENDPOINT:",
            url.split("?")[0]
        );

        const res = await axios.post(
            url,
            {
                contents: [
                    {
                        parts: [
                            {
                                text: message
                            }
                        ]
                    }
                ]
            },
            {
                timeout: 20000,
                headers: {
                    "Content-Type": "application/json"
                }
            }
        );

        return (
            res.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
            ""
        );

    } catch (err) {

        console.error("=================================");
        console.error("GEMINI FULL ERROR");
        console.error("=================================");
        console.error(
            "STATUS:",
            err.response?.status
        );
        console.error(
            "DATA:",
            JSON.stringify(
                err.response?.data,
                null,
                2
            )
        );
        console.error(
            "MESSAGE:",
            err.message
        );
        console.error("=================================");

        throw err;
    }
}