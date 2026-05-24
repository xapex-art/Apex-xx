const { cmd } = require('../command');
const axios = require('axios');

cmd({
    pattern: "gemini",
    alias: ["ai"],
    desc: "Chat with Gemini AI",
    category: "ai",
    react: "🤖",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply(`━━━━━━━━━━━━━━━━━━━\n\n│ \`Example\`\n│ • \`.gemini How are you !\`\n\n━━━━━━━━━━━━━━━━━━━`);
        }

        // React with 🔄 while processing
        await conn.sendMessage(from, { react: { text: "🔄", key: mek.key } });

        // Fetching data from the API
        let apiUrl = `https://apis.xwolf.space/api/ai/gemini?q=${encodeURIComponent(q)}`;
        let response = await axios.get(apiUrl);
        let data = response.data;
        
        // Checking if data result is present
        if (!data || !data.response) {
            // Adjust `.response` or `.result` based on the exact JSON output from that API
            let aiReply = data.result || data.message || data.response || data.data; 

            if (!aiReply) {
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                return reply(`*Error getting a response from Gemini AI. Please try again!*`);
            }
        }

        let textString = data.result || data.response || data.message || data.data || data;

        // Custom reply format
        let text = `*🤖 GEMINI AI*
━━━━━━━━━━━━━━━━━━━

${textString}

━━━━━━━━━━━━━━━━━━━
> \`\`\`Developed by ChiraNx 🌸\`\`\``;

        // Send the AI response to the user
        await conn.sendMessage(from, { text: text }, { quoted: mek });

        // React with ✅ when successfully sent
        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (e) {
        console.log(e);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply(`*Error:* Cannot connect to Gemini AI at the moment.`);
    }
});
