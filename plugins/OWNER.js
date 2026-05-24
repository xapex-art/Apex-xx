const { cmd } = require('../command');

cmd({
    pattern: "owner",
    desc: "Get bot owner details",
    category: "main",
    react: "👤",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        // Explicitly send the reaction first
        await conn.sendMessage(from, { react: { text: "👤", key: mek.key } });

        const ownerInfo = `*📊 OWNER INFO*
━━━━━━━━━━━━━━━━━━━

│ • \`OWNER NAME\` - ChiRaN D L
│ • \`AGE\` - 15+
│ • \`OWNER NB\` - XxX

━━━━━━━━━━━━━━━━━━━

> \`\`\`Developed by ChiraNx 🌸\`\`\``;

        // Then send the detailed message
        await conn.sendMessage(from, { text: ownerInfo }, { quoted: mek });

    } catch (e) {
        console.log(e);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply(`❌ Error: ${e.message || e}`);
    }
});
