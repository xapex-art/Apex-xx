const { cmd } = require('../command');
const yts = require('yt-search');
const axios = require('axios');

// ================= SONG DOWNLOAD COMMAND =================

cmd({
    pattern: "song",
    desc: "Download songs",
    category: "download",
    react: "🎧",
    filename: __filename
},
async (conn, mek, m, {
    from,
    q,
    reply
}) => {
    try {
        if (!q) {
            return reply(
`━━━━━━━━━━━━━━━━━━━

│ Example
│ • .song waiwara

━━━━━━━━━━━━━━━━━━━`
            );
        }

        // Searching React
        await conn.sendMessage(from, { react: { text: "🔄", key: mek.key } });

        const search = await yts(q);
        const data = search.videos[0];

        if (!data) {
            return reply("❌ Song not found!");
        }

        let caption =
`🎵 *SONG DOWNLOADER*

━━━━━━━━━━━━━━━━━━━
│ • TITLE : ${data.title}
│ • DATE : ${data.ago}
│ • DURATION : ${data.timestamp}
│ • VIEWS : ${data.views}
│ • LINK : ${data.url}
━━━━━━━━━━━━━━━━━━━

1️⃣ AUDIO FILE
2️⃣ DOCUMENT FILE
3️⃣ VOICE NOTE

Developed by ChiraNx 🌸`;

        await conn.sendMessage(from, {
            image: { url: data.thumbnail },
            caption: caption
        }, {
            quoted: mek
        });

    } catch (e) {
        console.log(e);
        reply(`❌ Error : ${e.message}`);
    }
});


// ================= RESPONSE HANDLER (REPLY SENDER) =================

cmd({
    on: "body"
},
async (conn, mek, m, {
    from,
    body,
    reply
}) => {
    try {
        if (!body) return;

        const text = body.trim();

        if (text === "1" || text === "2" || text === "3") {

            // Quoted message එක ගන්න එක ගොඩක් strong කළා
            const quotedMsg = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            
            // Bot Framework එක අනුව caption එක එන තැන වෙනස් වෙන්න පුළුවන්, ඒ ඔක්කොම cover කළා
            const caption = quotedMsg?.imageMessage?.caption || 
                            m?.quoted?.text || 
                            m?.quoted?.msg?.caption || 
                            "";

            if (!caption.includes("SONG DOWNLOADER")) return;

            // Downloading React (මේක දැන් අනිවාර්යයෙන්ම එන්න ඕනේ)
            await conn.sendMessage(from, { react: { text: "⬇️", key: mek.key } });

            // Caption එක ඇතුලෙන් හරියටම LINK එකයි TITLE එකයි වෙන් කරගන්නවා
            const urlMatch = caption.match(/LINK : (https?:\/\/[^\s]+)/);
            if (!urlMatch) {
                return reply("❌ YouTube ලින්ක් එක හොයාගන්න බැරි වුණා.");
            }
            const ytUrl = urlMatch[1];

            const titleMatch = caption.match(/TITLE : (.*)/);
            const title = titleMatch ? titleMatch[1].trim() : "Apex_Song";

            // Sadas API එකට Call කරනවා
            const apiKey = "a869fcb4f9ec52ac6ff45b17d0d98ccf";
            const apiEndpoint = `https://apis.sadas.dev/api/v1/download/youtube?q=${encodeURIComponent(ytUrl)}&format=mp3&apiKey=${apiKey}`;

            const res = await axios.get(apiEndpoint);

            // API එකෙන් එන JSON එක මොන විදිහට ආවත් අල්ලගන්න පුළුවන් විදිහට හැදුවා
            const dlUrl = res.data?.data?.downloadUrl || 
                          res.data?.data?.download || 
                          res.data?.result?.downloadUrl || 
                          res.data?.result?.url || 
                          res.data?.url;

            if (!dlUrl) {
                return reply("❌ API එකෙන් Download ලින්ක් එකක් ආවේ නැහැ බන්.");
            }

            // Uploading React
            await conn.sendMessage(from, { react: { text: "⬆️", key: mek.key } });

            // OPTION 1 : AUDIO FILE
            if (text === "1") {
                await conn.sendMessage(from, {
                    audio: { url: dlUrl },
                    mimetype: "audio/mpeg",
                    ptt: false
                }, { quoted: mek });
            }

            // OPTION 2 : DOCUMENT FILE
            else if (text === "2") {
                await conn.sendMessage(from, {
                    document: { url: dlUrl },
                    mimetype: "audio/mpeg",
                    fileName: `${title}.mp3`
                }, { quoted: mek });
            }

            // OPTION 3 : VOICE NOTE (PTT)
            else if (text === "3") {
                await conn.sendMessage(from, {
                    audio: { url: dlUrl },
                    mimetype: "audio/mpeg",
                    ptt: true
                }, { quoted: mek });
            }

            // Success React
            await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
        }

    } catch (e) {
        console.log(e);
        // Error එකක් ආවොත් මොකක්ද අවුල කියලා අපිටම බලාගන්න Error Reply එකක් දැම්මා
        if (reply) reply(`❌ අඩෝ අවුලක් ගියා බන්: ${e.message}`);
    }
});
