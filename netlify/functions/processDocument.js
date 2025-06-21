// netlify/functions/processDocument.js

const API_URL_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=';

function getPromptForTask(task, text) {
    switch (task) {
        case 'summarize':
            return `Bạn là một chuyên gia tóm tắt tài liệu. Dựa vào văn bản sau đây, hãy viết một bản tóm tắt súc tích, nêu bật các ý chính, luận điểm quan trọng và kết luận. Văn bản: """${text}"""`;
        case 'quiz':
            return `Bạn là một giáo viên. Dựa vào nội dung tài liệu sau, hãy tạo một bài kiểm tra gồm 5 câu hỏi trắc nghiệm (với 4 đáp án A, B, C, D và đánh dấu đáp án đúng bằng dấu *) và 3 câu hỏi tự luận để đánh giá sự hiểu biết của người đọc. Tài liệu: """${text}"""`;
        case 'keywords':
            return `Bạn là một cỗ máy phân tích ngữ nghĩa. Từ văn bản được cung cấp, hãy trích xuất 10-15 từ khóa hoặc cụm từ khóa quan trọng nhất đại diện cho nội dung chính. Trả về dưới dạng danh sách gạch đầu dòng. Văn bản: """${text}"""`;
        default:
            return text; // Mặc định trả lại văn bản gốc nếu không có task
    }
}

exports.handler = async function (event) {
    if (event.httpMethod !== 'POST') return { statusCode: 405 };

    try {
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        if (!GEMINI_API_KEY) throw new Error("API key chưa được cấu hình.");

        const { text, task } = JSON.parse(event.body);
        if (!text || !task) return { statusCode: 400, body: JSON.stringify({ error: "Thiếu văn bản hoặc tác vụ." }) };

        const prompt = getPromptForTask(task, text);
        const contents = [{ parts: [{ text: prompt }] }];

        const response = await fetch(API_URL_BASE + GEMINI_API_KEY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error.message);
        }

        const data = await response.json();
        const resultText = data.candidates[0].content.parts[0].text;

        return {
            statusCode: 200,
            body: JSON.stringify({ result: resultText })
        };

    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }
};
