const { cmd } = require('../command');

cmd({
    pattern: "menu",
    alias: ["help", "list"],
    desc: "Show the bot menu",
    category: "main",
    react: "📜",
    filename: __filename
},
async (conn, mek, m, { from, pushname, reply }) => {
    try {
        // Menu text with the custom styling
        let menuText = `*📜 ChiRaN x BOT MENU*
━━━━━━━━━━━━━━━━━━━

│ • \`.song\` - Download songs
│ • \`.csong\` - Send songs to channels
│ • \`.lyrics\` - To get song lyrics
│ • \`.stoimg\` - Convert sticker to image
│ • \`.stoe\` - Sinhala to English
│ • \`.etos\` - English to Sinhala
│ • \`.gemini\` - Chat with AI
│ • \`.weather\` - Get weather information
│ • \`.quoteimg\` - Make quote logo

━━━━━━━━━━━━━━━━━━━

> *Total Commands: 8*
> *Prefix:* \`.\`
> *Version:* 1.0.0

> \`\`\`Developed by ChiraNx 🌸\`\`\``;

        // Image URL provided
        const imageUrl = "https://www.image2url.com/r2/default/images/1776791779484-e3237c59-d668-4a9d-ba98-95f2ff7ccc71.png";

        // Sending the menu image with the custom caption
        await conn.sendMessage(from, { 
            image: { url: imageUrl }, 
            caption: menuText 
        }, { quoted: mek });

    } catch (e) {
        console.log(e);
        // React with ❌ on error
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply(`*Error:* Cannot display the menu at the moment.`);
    }
});
