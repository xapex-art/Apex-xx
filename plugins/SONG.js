const { cmd } = require('../command');
const yts = require('yt-search');
const axios = require('axios');

// ================= MAIN COMMAND (.song) =================
cmd({
    pattern: "song",
    react: "🎧",
    desc: "Download songs from YouTube",
    category: "download",
    use: '.song <name>',
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) {
            return reply("❗ කරුණාකර සිංදුවක නමක් දෙන්න.\n(උදා: .song manike mage hithe)");
        }

        // Searching React
        await conn.sendMessage(from, { react: { text: "🔄", key: mek.key } });

        const search = await yts(q);
        const data = search.videos[0];
        
        if (!data) return reply("❌ Song not found!");

        // New Clean Caption Structure
        let desc = `🎵 *SONG DOWNLOADER* 🎵\n\n> 📌 *Title:* ${data.title}\n> ⏱️ *Duration:* ${data.timestamp}\n> 👁️ *Views:* ${data.views}\n> 📅 *Uploaded:* ${data.ago}\n> 🔗 *Link:* ${data.url}\n\n*Reply this message with the number:*\n1️⃣ Audio File\n2️⃣ Document File\n3️⃣ Voice Note (PTT)\n\n_🌸 Developed by ChiraNx_`;

        // Send Image with Caption
        await conn.sendMessage(from, {
            image: { url: data.thumbnail },
            caption: desc
        }, { quoted: mek });

    } catch (e) {
        console.log(e);
        reply(`❌ Error: ${e.message}`);
    }
});

// ================= REPLY LISTENER (1, 2, 3) =================
cmd({
    on: "body"
},
async (conn, mek, m, { from, body, reply }) => {
    try {
        if (!body) return;
        const text = body.trim();

        // 1, 2, හෝ 3 විතරක් අල්ලගන්නවා
        if (text === "1" || text === "2" || text === "3") {
            
            // === BULLETPROOF QUOTED MESSAGE EXTRACTION ===
            // මේකෙන් අනිවාර්යයෙන්ම reply කරපු එක අල්ලගන්නවා
            const quotedMessage = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quotedMessage) return;

            // Caption එක තියෙන තැන කොහේ වුණත් හොයාගන්නවා
            const caption = quotedMessage?.imageMessage?.caption || 
                            quotedMessage?.conversation || 
                            quotedMessage?.extendedTextMessage?.text || 
                            m.quoted?.text || 
                            m.quoted?.caption || 
                            "";

            // අපේ Song Downloader මැසේජ් එකද කියලා චෙක් කරනවා
            if (!caption.includes("SONG DOWNLOADER")) return;

            // Reply එක අහුවුණා කියන්න React කරනවා
            await conn.sendMessage(from, { react: { text: "⬇️", key: mek.key } });

            // Caption එකෙන් Regex දාලා අනිවාර්යයෙන් ලින්ක් එක වෙන් කරනවා
            const urlMatch = caption.match(/(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s]+)/);
            if (!urlMatch) return reply("❌ Caption එකේ ලින්ක් එක හොයාගන්න බැරි වුණා.");
            
            const ytUrl = urlMatch[0];

            // Document නමට දාන්න Title එක ගන්නවා
            const titleMatch = caption.match(/\*Title:\* (.*)/);
            const title = titleMatch ? titleMatch[1].trim() : "Apex_Song";

            // === API CALL (SADAS API) ===
            const apiKey = "a869fcb4f9ec52ac6ff45b17d0d98ccf";
            const apiEndpoint = `https://apis.sadas.dev/api/v1/download/youtube?q=${encodeURIComponent(ytUrl)}&format=mp3&apiKey=${apiKey}`;

            const res = await axios.get(apiEndpoint);

            // API Response එකේ Data අල්ලගන්නවා (ඕනෑම JSON හැඩයකට වැඩ)
            const dlUrl = res.data?.data?.downloadUrl || 
                          res.data?.data?.url || 
                          res.data?.result?.downloadUrl || 
                          res.data?.result?.url || 
                          res.data?.downloadUrl;

            if (!dlUrl) {
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                return reply("❌ API එකෙන් සින්දුව ඩවුන්ලෝඩ් ලින්ක් එක ආවේ නැහැ.");
            }

            // Uploading React
            await conn.sendMessage(from, { react: { text: "⬆️", key: mek.key } });

            // === SEND MEDIA BASED ON USER CHOICE ===
            if (text === "1") {
                // Audio File
                await conn.sendMessage(from, {
                    audio: { url: dlUrl },
                    mimetype: "audio/mpeg",
                    ptt: false
                }, { quoted: mek });
            } 
            else if (text === "2") {
                // Document File
                await conn.sendMessage(from, {
                    document: { url: dlUrl },
                    mimetype: "audio/mpeg",
                    fileName: `${title}.mp3`,
                    caption: `🎵 ${title}`
                }, { quoted: mek });
            } 
            else if (text === "3") {
                // Voice Note (PTT)
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
        reply(`❌ Reply Error: ${e.message}`);
    }
});
