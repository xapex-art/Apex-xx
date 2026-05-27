const { cmd } = require('../command');
const axios = require('axios');

cmd({
    on: "body"
},
async (conn, mek, m, { from, body }) => {

    try {

        if (!body) return;
        if (mek.key.fromMe) return;
        if (body.startsWith(".")) return;

        // User message lowercase
        const text = body.toLowerCase();

        // API Request
        const res = await axios.get(
            `https://auto-reply-api.vercel.app/api/chat?message=${encodeURIComponent(text)}`
        );

        const data = res.data;

        // API reply
        const replyText = data.reply || data.message;

        // If API has no matching reply stop
        if (!replyText || replyText === "No response found") return;

        // Send reply
        await conn.sendMessage(from, {
            text: replyText
        }, {
            quoted: mek
        });

    } catch (e) {
        console.log("Auto Reply Error:", e);
    }
});
