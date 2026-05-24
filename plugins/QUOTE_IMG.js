const { cmd } = require('../command');
const axios = require('axios');

cmd({
    pattern: "quoteimg",
    alias: ["imgquote", "makerquote"],
    desc: "Generate quote/logo image",
    category: "main",
    react: "☄️",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q || !q.includes(",")) {
            return reply(`━━━━━━━━━━━━━━━━━━━

│ \`Example\`
│ • \`.quoteimg Text 1, Text 2, (Put img url here)\`

━━━━━━━━━━━━━━━━━━━`);
        }

        // Split the input into text1, text2, and the image link
        let args = q.split(',');
        if (args.length < 3) {
            return reply(`❌ *Invalid format!*
Please provide Text, Name, and Image URL separated by commas.

*Example:*
\`.quoteimg ChiRaN xDev here, Owner LAnKa, https://files.catbox.moe/xwh1kh.jpeg\``);
        }

        let text1 = args[0].trim();
        let text2 = args[1].trim();
        // In case the image link itself contained commas, join the rest cleanly
        let sourceImg = args.slice(2).join(',').trim();

        if (!sourceImg.startsWith('http')) {
            return reply(`❌ *Invalid Image URL!*
Please provide a valid image link starting with http:// or https://`);
        }

        // Initial react with ☄️
        await conn.sendMessage(from, { react: { text: "☄️", key: mek.key } });

        // Add a slight delay so the reaction change is noticeable
        await new Promise(r => setTimeout(r, 1000));

        // React with 🔄 while generating
        await conn.sendMessage(from, { react: { text: "🔄", key: mek.key } });

        const apiUrl = `https://www.movanest.xyz/v2/quote-image?text=${encodeURIComponent(text1)}&name=${encodeURIComponent(text2)}&image=${encodeURIComponent(sourceImg)}`;

        // Check the API response. Some APIs return standard JSON, some return the image buffer directly. 
        // We handle both scenarios safely here.
        const response = await axios.get(apiUrl, { validateStatus: () => true });
        
        let finalImageUrl = apiUrl;

        if (response.headers['content-type'] && response.headers['content-type'].includes('application/json')) {
            const data = response.data;
            if (!data.status) {
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                return reply(`❌ *API Error:* Failed to generate logo.`);
            }
            finalImageUrl = data.result || data.url || apiUrl;
        }

        // Send the generated image to WhatsApp
        const logoCaption = `*☄️ QUOTE IMAGE*
━━━━━━━━━━━━━━━━━━━
✅ \`Successfully Created!\`
━━━━━━━━━━━━━━━━━━━

> \`\`\`Developed by ChiraNx 🌸\`\`\``;
        
        await conn.sendMessage(from, { 
            image: { url: finalImageUrl }, 
            caption: logoCaption 
        }, { quoted: mek });

        // React with ✅ when successfully sent
        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (e) {
        console.log(e);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply(`❌ Error: ${e.response && e.response.data ? e.response.data.message || 'API Error' : e.message}`);
    }
});
