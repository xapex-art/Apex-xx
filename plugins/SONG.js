const { cmd } = require('../command');
const yts = require('yt-search');
const axios = require('axios');

// ================= 1. SONG COMMAND (.song) =================
cmd({
    pattern: "song",
    desc: "Download songs",
    category: "download",
    react: "🎧",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
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

        let caption = `🎵 *SONG DOWNLOADER* 🎵\n\n━━━━━━━━━━━━━━━━━━━\n│ • TITLE : ${data.title}\n│ • DATE : ${data.ago}\n│ • DURATION : ${data.timestamp}\n│ • VIEWS : ${data.views}\n│ • LINK : ${data.url}\n━━━━━━━━━━━━━━━━━━━\n\n1️⃣ AUDIO FILE\n2️⃣ DOCUMENT FILE\n3️⃣ VOICE NOTE\n\nDeveloped by ChiraNx 🌸`;

        await conn.sendMessage(from, {
            image: { url: data.thumbnail },
            caption: caption
        }, { quoted: mek });

    } catch (e) {
        console.log(e);
        reply(`❌ Error : ${e.message}`);
    }
});


// ================= 2. NUMBER REPLY HANDLER (1, 2, 3) =================
cmd({
    on: "body"
},
async (conn, mek, m, { from, body, reply }) => {
    try {
        // --- BULLETPROOF TEXT EXTRACTION ---
        // Framework එකෙන් body එක නැති වුණත් Raw Message එකෙන් Text එක ගන්නවා
        let rawInput = body || "";
        if (mek.message?.extendedTextMessage?.text) {
            rawInput = mek.message.extendedTextMessage.text;
        } else if (mek.message?.conversation) {
            rawInput = mek.message.conversation;
        } else if (m?.text) {
            rawInput = m.text;
        }

        const text = rawInput.trim();

        // 1, 2, හෝ 3 ද කියා පරීක්ෂා කිරීම
        if (text === "1" || text === "2" || text === "3") {

            // --- BULLETPROOF QUOTED EXTRACTION ---
            const quoted = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage || m?.quoted;
            if (!quoted) return;

            // Caption එක තියෙන හැම තැනක්ම පීරලා ගන්නවා
            let caption = "";
            if (quoted.imageMessage?.caption) caption = quoted.imageMessage.caption;
            else if (quoted.extendedTextMessage?.text) caption = quoted.extendedTextMessage.text;
            else if (quoted.conversation) caption = quoted.conversation;
            else if (m?.quoted?.caption) caption = m.quoted.caption;
            else if (m?.quoted?.text) caption = m.quoted.text;

            // අපේ Song Downloader මැසේජ් එකටමද Reply කරලා තියෙන්නේ කියලා බලනවා
            if (!caption || !caption.includes("SONG DOWNLOADER")) return;

            // Reply එක අහුවුණ ගමන් අනිවාර්යයෙන්ම React වෙනවා දැන්
            await conn.sendMessage(from, { react: { text: "⬇️", key: mek.key } });

            // Caption එක ඇතුලෙන් YouTube Link එක වෙන් කර ගැනීම
            const urlMatch = caption.match(/(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s]+)/i);
            if (!urlMatch) {
                return reply("❌ Caption එකෙන් YouTube URL එක හොයාගන්න බැරි වුණා.");
            }
            const ytUrl = urlMatch[0];

            // Title එක වෙන් කර ගැනීම
            let titleMatch = caption.match(/TITLE\s*:\s*(.*)/i);
            let title = titleMatch ? titleMatch[1].trim() : "Song";

            // --- API CALL (SADAS API) ---
            const apiKey = "a869fcb4f9ec52ac6ff45b17d0d98ccf";
            const apiEndpoint = `https://apis.sadas.dev/api/v1/download/youtube?q=${encodeURIComponent(ytUrl)}&format=mp3&apiKey=${apiKey}`;

            const res = await axios.get(apiEndpoint);

            // --- BULLETPROOF URL EXTRACTOR ---
            // API Response එකේ කොතන ලින්ක් එක තිබ්බත් හොයලා දෙන සිරාම Function එකක්
            function findDownloadUrl(obj) {
                if (typeof obj === 'string' && (obj.startsWith('http://') || obj.startsWith('https://'))) {
                    return obj;
                }
                if (typeof obj !== 'object' || obj === null) return null;
                for (let key in obj) {
                    let found = findDownloadUrl(obj[key]);
                    if (found) return found;
                }
                return null;
            }

            let dlUrl = res.data?.result?.downloadUrl || 
                        res.data?.data?.downloadUrl || 
                        res.data?.url || 
                        findDownloadUrl(res.data);

            if (!dlUrl) {
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                return reply("❌ API එකෙන් සින්දුවේ Download ලින්ක් එක ආවේ නැහැ බන්.");
            }

            // Uploading React
            await conn.sendMessage(from, { react: { text: "⬆️", key: mek.key } });

            // --- SEND MEDIA BASED ON USER CHOICE ---
            
            // 1️⃣ OPTION 1 : AUDIO FILE
            if (text === "1") {
                await conn.sendMessage(from, {
                    audio: { url: dlUrl },
                    mimetype: "audio/mpeg",
                    ptt: false
                }, { quoted: mek });
            } 
            
            // 2️⃣ OPTION 2 : DOCUMENT FILE
            else if (text === "2") {
                await conn.sendMessage(from, {
                    document: { url: dlUrl },
                    mimetype: "audio/mpeg",
                    fileName: `${title}.mp3`
                }, { quoted: mek });
            } 
            
            // 3️⃣ OPTION 3 : VOICE NOTE (PTT)
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
        console.error(e);
        reply(`❌ Reply Error: ${e.message}`);
    }
});
