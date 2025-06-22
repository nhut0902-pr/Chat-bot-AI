const { YoutubeTranscript } = require('youtube-transcript');

exports.handler = async (event) => {
    try {
        const { url } = JSON.parse(event.body);
        const transcriptData = await YoutubeTranscript.fetchTranscript(url);
        const fullTranscript = transcriptData.map(item => item.text).join(' ');
        return {
            statusCode: 200,
            body: JSON.stringify({ content: fullTranscript }),
        };
    } catch (error) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Không thể lấy phụ đề. Video có thể không có phụ đề hoặc link không hợp lệ.' })};
    }
};
