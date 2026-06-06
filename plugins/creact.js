const { cmd } = require('../command');

cmd({
    pattern: "creact",
    desc: "React to a specific channel message using link",
    category: "owner",
    filename: __filename
},
async (conn, mek, m, { args, reply }) => {
    if (!args[0] || !args[1]) return reply("Format: .creact [link] [emoji1,emoji2]\nExample: .creact [link] ❤️,🔥");

    const link = args[0]; // Link eka
    const emojis = args[1].split(','); // Emojis tika
    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

    // Link eken channel ID ekayi Message ID ekayi ganna
    // WhatsApp channel links: https://whatsapp.com/channel/[ChannelID]/[MessageID]
    const parts = link.split('/');
    const messageId = parts[parts.length - 1]; // Message ID eka
    const channelId = parts[parts.length - 2]; // Channel ID (Meeka newsletter format ekata convert karanna oni)

    // Newsletter JID eka (Samanayen channel ID + @newsletter)
    // Note: Oya bots la follow karala inna channel ekak nam aniwa ID eka match wenawa.
    const channelJid = channelId.startsWith('0029') ? channelId + '@newsletter' : channelId;

    try {
        // activeSockets global karapu nisa methanin access karanna puluwan
        let successCount = 0;
        
        for (const sessionId in global.activeSockets) {
            const bot = global.activeSockets[sessionId];
            
            try {
                // Reaction eka yawanna Message Key eka hadaganna oni
                // Channel messages wala key eka: remoteJid, fromMe: false, id: messageId
                await bot.sendMessage(channelJid, {
                    react: { 
                        text: randomEmoji, 
                        key: { 
                            remoteJid: channelJid, 
                            fromMe: false, 
                            id: messageId 
                        } 
                    }
                });
                successCount++;
            } catch (e) {
                console.log(`Failed for session ${sessionId}: ${e.message}`);
            }
        }
        
        reply(`✅ Reacted to the message using ${successCount} active sessions!`);
    } catch (e) {
        reply("❌ Error: " + e.message);
    }
});

