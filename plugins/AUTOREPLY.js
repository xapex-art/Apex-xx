const { cmd } = require('../command');
const axios = require('axios');

cmd({
    on: "body"
},
async (conn, mek, m, { from, body }) => {

    try {

        // Ignore empty messages
        if (!body) return;

        // Ignore bot messages
        if (mek.key.fromMe) return;

        // Ignore commands
        if (body.startsWith(".")) return;

        // API Request
        const res = await axios.get(
            `https://auto-reply-api.vercel.app/api/chat?message=${encodeURIComponent(body)}`
        );

        const data = res.data;

        // Reply text
        const replyText = data.reply || data.message;

        // If no reply return
        if (!replyText) return;

        // Send auto reply
        await conn.sendMessage(from, {
            text: replyText
        }, {
            quoted: mek
        });

    } catch (e) {
        console.log("Auto Reply Error:", e);
    }
});
