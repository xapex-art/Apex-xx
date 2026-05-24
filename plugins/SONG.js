const { cmd } = require('../command');
const yts = require('yt-search');
const axios = require('axios');

cmd({
    pattern: "song",
    desc: "Download songs",
    category: "download",
    react: "🎧",
    filename: __filename
},
async (conn, mek, m, { from, quoted, body, isCmd, command, args, q, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply }) => {
    try {
        if (!q) return reply(`━━━━━━━━━━━━━━━━━━━\n\n│ \`Example\`\n│ • \`.song waiwara\`\n\n━━━━━━━━━━━━━━━━━━━`);
        
        // React with 🔄 while searching
        await conn.sendMessage(from, { react: { text: "🔄", key: mek.key } });
        
        const search = await yts(q);
        const data = search.videos[0];
        
        if (!data) return reply(`❌ *Song not found!*`);
        
        let caption = `*🎵 SONG DOWNLOADER*
━━━━━━━━━━━━━━━━━━━

│ • \`TITLE\` - ${data.title}
│ • \`DATE\` - ${data.ago}
│ • \`DURATION\` - ${data.timestamp}
│ • \`VIEWS\` - ${data.views}
│ • \`LINK\` - ${data.url}

━━━━━━━━━━━━━━━━━━━

\`1️⃣ : 🎧 AUDIO FILE\`
\`2️⃣ : 📁 DOCUMENT FILE\`
\`3️⃣ : 🎤 VOICE NOTE\`

> \`\`\`Developed by ChiraNx 🌸\`\`\``;

        await conn.sendMessage(from, { image: { url: data.thumbnail }, caption: caption }, { quoted: mek });
    } catch (e) {
        console.log(e);
        reply(`❌ Error: ${e.message || e}`);
    }
});

cmd({
    on: "body"
},
async (conn, mek, m, { from, body, pushname, reply }) => {
    try {
        if (!body) return;
        const replyMatch = body.trim();
        
        if (replyMatch === "1" || replyMatch === "2" || replyMatch === "3") {
            if (mek.message && mek.message.extendedTextMessage && mek.message.extendedTextMessage.contextInfo && mek.message.extendedTextMessage.contextInfo.quotedMessage) {
                const quotedMsg = mek.message.extendedTextMessage.contextInfo.quotedMessage;
                const caption = quotedMsg.imageMessage ? quotedMsg.imageMessage.caption : "";
                
                if (caption.includes("SONG DOWNLOADER") && caption.includes("ChiraNx")) {
                    await conn.sendMessage(from, { react: { text: "⬇️", key: mek.key } });
                    
                    const urlMatch = caption.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=)?([a-zA-Z0-9_-]{11})/);
                    if (!urlMatch) return;
                    const vUrl = "https://www.youtube.com/watch?v=" + urlMatch[1];
                    
                    let titleMatch = caption.match(/`TITLE` - (.+)/);
                    let title = titleMatch ? titleMatch[1].trim() : "Song";
                    
                    let apiUrl = `https://ytdl-new-dxz.vercel.app/api/ytmp3?url=${encodeURIComponent(vUrl)}`;
                    let response = await axios.get(apiUrl);
                    let dlUrl = response.data.result.downloadUrl;
                    
                    await conn.sendMessage(from, { react: { text: "⬆️", key: mek.key } });
                    
                    if (replyMatch === "1") {
                        await conn.sendMessage(from, { audio: { url: dlUrl }, mimetype: "audio/mpeg" }, { quoted: mek });
                    } else if (replyMatch === "2") {
                        await conn.sendMessage(from, { document: { url: dlUrl }, mimetype: "audio/mpeg", fileName: title + ".mp3" }, { quoted: mek });
                    } else if (replyMatch === "3") {
                        await conn.sendMessage(from, { audio: { url: dlUrl }, mimetype: "audio/mpeg", ptt: true }, { quoted: mek });
                    }
                    
                    await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
                }
            }
        }
    } catch (e) {
        console.log(e);
    }
});
