const { cmd } = require('../command');
const axios = require('axios');

cmd({
    pattern: "englishtosinhala",
    alias: ["etos"],
    desc: "Translate English to Sinhala",
    category: "convert",
    react: "🔄",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply(`*Please provide English text to translate!*`);
        }
        
        await conn.sendMessage(from, { react: { text: "🔄", key: mek.key } });

        // Using safe Google Translate API
        let url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=si&dt=t&q=${encodeURIComponent(q)}`;
        let response = await axios.get(url);
        
        // Joining translated sentences beautifully
        let translatedText = response.data[0].map(item => item[0]).join('');

        let msg = `*🔄 ENGLISH TO SINHALA*
━━━━━━━━━━━━━━━━━━━

│ • \`Translated ✅\` :

${translatedText}

━━━━━━━━━━━━━━━━━━━

> \`\`\`Developed by ChiraNx 🌸\`\`\``;

        await conn.sendMessage(from, { text: msg }, { quoted: mek });
        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (e) {
        console.log(e);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply(`*Error:* Cannot translate at the moment.`);
    }
});

cmd({
    pattern: "sinhalatoenglish",
    alias: ["stoe"],
    desc: "Translate Sinhala to English",
    category: "convert",
    react: "🔄",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply(`*Please provide Sinhala text to translate!*`);
        }
        
        await conn.sendMessage(from, { react: { text: "🔄", key: mek.key } });

        // Using safe Google Translate API
        let url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=si&tl=en&dt=t&q=${encodeURIComponent(q)}`;
        let response = await axios.get(url);
        
        // Joining translated sentences beautifully
        let translatedText = response.data[0].map(item => item[0]).join('');

        let msg = `*🔄 SINHALA TO ENGLISH*
━━━━━━━━━━━━━━━━━━━

│ • \`Translated ✅\` :

${translatedText}

━━━━━━━━━━━━━━━━━━━

> \`\`\`Developed by ChiraNx 🌸\`\`\``;

        await conn.sendMessage(from, { text: msg }, { quoted: mek });
        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (e) {
        console.log(e);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply(`*Error:* Cannot translate at the moment.`);
    }
});
