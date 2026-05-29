const { cmd } = require('../command');

cmd({
    pattern: "alive",
    desc: "Check if the bot is online",
    category: "main",
    react: "📊",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        const aliveImage = "https://files.catbox.moe/78oacy.jpeg";
        
        const aliveText = `*📊 ALIVE INFO*
━━━━━━━━━━━━━━━━━━━

│ • \`PING\` - Get Bot Speed
│ • \`MENU\` - Get All Commands
│ • \`ALIVE\` - Check Bot Alive

━━━━━━━━━━━━━━━━━━━

> *Total Commands: 7*
> *Prefix:* \`.\`
> *Version:* 1.0.0

> \`\`\`Developed by ChiraNx 🌸\`\`\``;

        await conn.sendMessage(from, { 
            image: { url: aliveImage }, 
            caption: aliveText 
        }, { quoted: mek });

    } catch (e) {
        console.log("Alive command error: ", e);
        reply(`Error: ${e.message}`);
    }
});
