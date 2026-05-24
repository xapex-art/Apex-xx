const { cmd } = require('../command');
const axios = require('axios');

cmd({
    pattern: "lyrics",
    alias: ["lyric"],
    desc: "Get song lyrics",
    category: "search",
    react: "📝",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply(`━━━━━━━━━━━━━━━━━━━\n\n│ \`Example\`\n│ • \`.lyrics despacito\`\n\n━━━━━━━━━━━━━━━━━━━`);
        
        // React with 🔄 while searching
        await conn.sendMessage(from, { react: { text: "🔄", key: mek.key } });
        
        const apiUrl = `https://apis.xwolf.space/download/lyrics?q=${encodeURIComponent(q)}`;
        const response = await axios.get(apiUrl);
        const data = response.data;
        
        // If API doesn't return success or lyrics, send error
        if (!data || !data.success || !data.lyrics) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply(`❌ *Lyrics not found!*`);
        }
        
        let lyricsText = `*📝 LYRICS SEARCH*
━━━━━━━━━━━━━━━━━━━

│ • \`TITLE\` - ${data.title || q}
│ • \`ARTIST\` - ${data.author || 'Unknown'}
│ • \`ALBUM\` - ${data.album || 'Unknown'}

━━━━━━━━━━━━━━━━━━━

${data.lyrics}

━━━━━━━━━━━━━━━━━━━
> \`\`\`Developed by ChiraNx 🌸\`\`\``;

        // Send the formatted lyrics
        await conn.sendMessage(from, { text: lyricsText }, { quoted: mek });
        // React with ✅ when successfully sent
        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
        
    } catch (e) {
        console.log(e);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply(`❌ Error: ${e.response ? e.response.data.message || 'API Error' : e.message || e}`);
    }
});
