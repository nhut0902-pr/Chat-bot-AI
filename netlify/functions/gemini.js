// netlify/functions/gemini.js - PHIÊN BẢN GỠ LỖI CHI TIẾT
const { GoogleGenerativeAI } = require("@google/generative-ai");

exports.handler = async function (event, context) {
    console.log("--- Function gemini.js bat dau thuc thi. ---");

    if (event.httpMethod !== 'POST') {
        console.log("Loi: Phuong thuc khong phai POST.");
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error("LOI NGHIEM TRONG: Khong tim thay GEMINI_API_KEY trong bien moi truong!");
            throw new Error("API Key for Gemini is not configured.");
        }
        
        const genAI = new GoogleGenerativeAI(apiKey);
        
        console.log("Da khoi tao GoogleGenerativeAI thanh cong.");

        const { prompt, history } = JSON.parse(event.body);
        console.log("Da nhan duoc prompt: ", JSON.stringify(prompt));

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const chat = model.startChat({
            history: history || [],
            generationConfig: { maxOutputTokens: 2048 },
        });
        
        console.log("Chuan bi goi chat.sendMessageStream...");

        const result = await chat.sendMessageStream(prompt);
        
        console.log("Goi API thanh cong, bat dau stream ket qua.");

        const stream = new ReadableStream({
            async start(controller) {
                for await (const chunk of result.stream) {
                    const chunkText = chunk.text();
                    controller.enqueue(new TextEncoder().encode(chunkText));
                }
                controller.close();
            }
        });

        console.log("--- Function ket thuc thanh cong. ---");
        return new Response(stream, {
            status: 200,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
        });

    } catch (error) {
        // Dòng này là quan trọng nhất để chúng ta thấy lỗi
        console.error("!!! DA XAY RA LOI TRONG KHOI TRY-CATCH !!!");
        console.error("Ten loi:", error.name);
        console.error("Thong bao loi:", error.message);
        console.error("Stack trace:", error.stack);
        
        return {
            statusCode: 500,
            // Trả về thông báo lỗi thật sự để dễ debug hơn
            body: JSON.stringify({ 
                error: "Loi tu function cua Netlify.",
                details: error.message 
            }),
        };
    }
};
