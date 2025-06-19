// gemini.js - THE ULTIMATE COMPATIBILITY VERSION
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { PassThrough } = require("stream");

exports.handler = (event, context, callback) => {
    // We create a PassThrough stream. We will write data into this,
    // and Netlify will read data from it.
    const stream = new PassThrough();

    // Tell Netlify we are starting a streamed response.
    // This is the classic callback method.
    callback(null, {
        statusCode: 200,
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
        },
        body: stream,
        isBase64Encoded: false,
    });

    // We define an async function to do the main work
    const processRequest = async () => {
        try {
            if (event.httpMethod !== 'POST') {
                throw new Error('Method Not Allowed');
            }

            const { prompt, history = [] } = JSON.parse(event.body);

            if (!prompt) {
                throw new Error('Prompt is required.');
            }

            const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const chat = model.startChat({ history });
            const result = await chat.sendMessageStream(prompt);

            // As we get chunks from Google, write them into our PassThrough stream
            for await (const chunk of result.stream) {
                // Ensure we only write valid text
                if (chunk && typeof chunk.text === 'function') {
                    stream.write(chunk.text());
                }
            }

        } catch (error) {
            console.error("ERROR IN STREAMING FUNCTION:", error);
            // If an error occurs, write the error message to the stream
            stream.write(`Error from server: ${error.message}`);
        } finally {
            // IMPORTANT: Close the stream to signal the end of the response.
            stream.end();
        }
    };
    
    // Execute the async function
    processRequest();
};
