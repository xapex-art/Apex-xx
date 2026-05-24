const { cmd } = require('../command');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');

cmd({
    pattern: "stickertoimg",
    alias: ["stoimg", "s2i"],
    desc: "Convert Sticker to Image",
    category: "convert",
    react: "🖼️",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        // Check if the user has replied to a message
        const isQuoted = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const isSticker = isQuoted?.stickerMessage;
        
        if (!isSticker) {
            // React with ❌ if no sticker is quoted
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply(`━━━━━━━━━━━━━━━━━━━\n\n│ \`Example\`\n│ • \`.stoimg "Reply To a Sticker"\`\n\n━━━━━━━━━━━━━━━━━━━`);
        }

        // React with 🔄 while processing
        await conn.sendMessage(from, { react: { text: "🔄", key: mek.key } });

        // Download the sticker buffer
        const stream = await downloadContentFromMessage(isSticker, 'sticker');
        let buffer = Buffer.from([]);
        for await(const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }

        // Your specific text design
        let caption = `*🖼️ STICKER TO IMAGE*
━━━━━━━━━━━━━━━━━━━
✅ \`Successfully Converted!\`
━━━━━━━━━━━━━━━━━━━

> \`\`\`Developed by ChiraNx 🌸\`\`\``;

        // Send the buffer directly as an image
        await conn.sendMessage(from, { 
            image: buffer, 
            caption: caption 
        }, { quoted: mek });

        // React with ✅ when successfully sent
        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (e) {
        console.log(e);
        // Error react and message
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply(`*Error:* Cannot convert this sticker at the moment.`);
    }
});
