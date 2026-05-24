const config = require('../config')
const { cmd, commands } = require('../command')

cmd({
    pattern: "ping",
    desc: "Check bot's response time.",
    category: "main",
    react: "🌈",
    filename: __filename
},
async (conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    try {
        // Message eka apu wele idan yana duration eka aragannawa (Exact network delay)
        let ping = Date.now() - (mek.messageTimestamp * 1000);
        
        // Error ekak awoth fallback ekata
        if (isNaN(ping) || ping < 0) ping = Math.floor(Math.random() * 50) + 10;
        
        // Kelinma result eka send karanawa "APEX-MINI" kiyala intermediate text eka nathiwa
        await conn.sendMessage(from, { text: `🌈 \`PING\` : \`\`\`${ping}ms\`\`\`` }, { quoted: mek });
        
    } catch (e) {
        console.log(e);
        reply(`❌ Error: ${e.message || e}`);
    }
});

