// netlify/functions/gemini.js

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

        // Gửi prompt đa phương tiện (văn bản + ảnh) và nhận về stream
        const result = await chat.sendMessageStream(prompt);

        // Tạo một ReadableStream để gửi lại cho client
        const stream = new ReadableStream({
            async start(controller) {
                for await (const chunk of result.stream) {
                    const chunkText = chunk.text();
                    // Gửi từng phần dữ liệu tới client
                    controller.enqueue(new TextEncoder().encode(chunkText));
                }
                controller.close();
            }
        });

        // Trả về stream cho Netlify
        return new Response(stream, {
            status: 200,
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
            },
        });

    } catch (error) {
        console.error("Gemini API Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to call Gemini API.' }),
        };
    }
};
