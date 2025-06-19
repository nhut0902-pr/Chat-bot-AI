// gemini.js - PHIÊN BẢN GỠ LỖI
const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async function (event, context) {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const { prompt, history = [] } = JSON.parse(event.body);

        if (!prompt) { throw new Error("Prompt is missing from the request body."); }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const chat = model.startChat({ history: history });
        const result = await chat.sendMessageStream(prompt);

        const stream = new ReadableStream({
            async start(controller) {
                for await (const chunk of result.stream) {
                    controller.enqueue(new TextEncoder().encode(chunk.text()));
                }
                controller.close();
            }
        });
        return new Response(stream, { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    } catch (error) {
        // QUAN TRỌNG: Gửi thông tin lỗi chi tiết về cho frontend
        console.error("!!! LOI BEN TRONG FUNCTION !!!", error);
        const errorBody = `Error Name: ${error.name}\nMessage: ${error.message}\nStack: ${error.stack}`;
        return {
            statusCode: 500,
            body: errorBody
        };
    }
};
