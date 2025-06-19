const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async function (event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const { prompt, history } = JSON.parse(event.body);

        if (!prompt) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Prompt is required' }) };
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const chat = model.startChat({
            history: history || [],
            generationConfig: { maxOutputTokens: 2048 },
        });

        const result = await chat.sendMessageStream(prompt);

        const stream = new ReadableStream({
            async start(controller) {
                for await (const chunk of result.stream) {
                    const chunkText = chunk.text();
                    controller.enqueue(new TextEncoder().encode(chunkText));
                }
                controller.close();
            }
        });

        return new Response(stream, {
            status: 200,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
        });

    } catch (error) {
        // Dòng này rất quan trọng để chúng ta thấy lỗi chi tiết
        console.error("CHI TIET LOI GEMINI:", error); 
        
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to call Gemini API. See function logs for details.' }),
        };
    }
};
