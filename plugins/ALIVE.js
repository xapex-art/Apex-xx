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
        const aliveImage = "https://www.image2url.com/r2/default/images/1776791779484-e3237c59-d668-4a9d-ba98-95f2ff7ccc71.png";
        
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
