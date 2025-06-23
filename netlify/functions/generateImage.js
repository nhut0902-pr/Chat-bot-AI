const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const os = require('os');
const path = require('path');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { prompt } = JSON.parse(event.body);
        if (!prompt) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Mô tả ảnh là bắt buộc.' }) };
        }

        const apiKey = process.env.STABILITY_API_KEY;
        if (!apiKey) {
            throw new Error("Stability AI API key chưa được thiết lập.");
        }
        
        const engineId = 'stable-diffusion-v1-6';
        const apiHost = 'https://api.stability.ai';
        
        const response = await axios.post(
            `${apiHost}/v1/generation/${engineId}/text-to-image`,
            {
                text_prompts: [{ text: prompt }],
                cfg_scale: 7,
                height: 512,
                width: 512,
                steps: 30,
                samples: 1,
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
            }
        );

        const artifacts = response.data.artifacts;
        if (!artifacts || artifacts.length === 0) {
            throw new Error('Không có hình ảnh nào được tạo ra từ API.');
        }

        const image = artifacts[0];
        // Thay vì lưu file, ta sẽ gửi thẳng dữ liệu base64 về client
        const imageUrl = `data:image/png;base64,${image.base64}`;

        return {
            statusCode: 200,
            body: JSON.stringify({ imageUrl: imageUrl }),
        };

    } catch (error) {
        console.error('Lỗi khi tạo ảnh:', error.response ? error.response.data : error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: `Lỗi từ server Stability AI: ${error.message}` }),
        };
    }
};
