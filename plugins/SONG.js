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

        // Searching reaction
        await conn.sendMessage(from, {
            react: {
                text: "🔄",
                key: mek.key
            }
        });

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
            image: {
                url: data.thumbnail
            },
            caption: caption
        }, {
            quoted: mek
        });

    } catch (e) {
        console.log(e);
        reply(`❌ Error : ${e.message}`);
    }
});


// ================= RESPONSE HANDLER (NUMBER REPLY) =================

cmd({
    on: "body"
},
async (conn, mek, m, {
    from,
    body
}) => {
    try {
        if (!body) return;

        const text = body.trim();

        // 1, 2, හෝ 3 ද කියා පරීක්ෂා කිරීම
        if (text === "1" || text === "2" || text === "3") {

            // Reply කරපු message එකේ විස්තර ලබා ගැනීම
            const quoted = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            if (!quoted) return;

            // Image caption එකක් තියෙනවද සහ ඒක අපේම Song Downloader එකක්ද කියා බැලීම
            const caption = quoted?.imageMessage?.caption || "";
            if (!caption.includes("SONG DOWNLOADER")) return;

            // Downloading reaction
            await conn.sendMessage(from, {
                react: {
                    text: "⬇️",
                    key: mek.key
                }
            });

            // Extract YouTube URL from the caption
            const urlMatch = caption.match(/(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s]+)/gi);
            if (!urlMatch) return;
            const ytUrl = urlMatch[0];

            // Extract Title from the caption
            let titleMatch = caption.match(/TITLE : (.*)/);
            let title = titleMatch ? titleMatch[1].trim() : "Song";

            // --- NEW API IMPLEMENTATION ---
            const apiKey = "a869fcb4f9ec52ac6ff45b17d0d98ccf";
            const apiEndpoint = `https://apis.sadas.dev/api/v1/download/youtube?q=${encodeURIComponent(ytUrl)}&format=mp3&apiKey=${apiKey}`;

            const res = await axios.get(apiEndpoint);
            
            // Response එකෙන් download link එක හරියටම වෙන් කර ගැනීම
            const resultData = res.data?.result || res.data?.data || res.data;
            const dlUrl = resultData?.downloadUrl || resultData?.url || resultData?.download;

            if (!dlUrl) {
                return conn.sendMessage(from, {
                    text: "❌ Download link generation failed from API."
                }, {
                    quoted: mek
                });
            }

            // Uploading reaction
            await conn.sendMessage(from, {
                react: {
                    text: "⬆️",
                    key: mek.key
                }
            });

            // 1️⃣ OPTION 1: AUDIO FILE
            if (text === "1") {
                await conn.sendMessage(from, {
                    audio: {
                        url: dlUrl
                    },
                    mimetype: "audio/mpeg",
                    ptt: false
                }, {
                    quoted: mek
                });
            }

            // 2️⃣ OPTION 2: DOCUMENT FILE
            else if (text === "2") {
                await conn.sendMessage(from, {
                    document: {
                        url: dlUrl
                    },
                    mimetype: "audio/mpeg",
                    fileName: `${title}.mp3`
                }, {
                    quoted: mek
                });
            }

            // 3️⃣ OPTION 3: VOICE NOTE (PTT)
            else if (text === "3") {
                await conn.sendMessage(from, {
                    audio: {
                        url: dlUrl
                    },
                    mimetype: "audio/mpeg",
                    ptt: true
                }, {
                    quoted: mek
                });
            }

            // Success reaction
            await conn.sendMessage(from, {
                react: {
                    text: "✅",
                    key: mek.key
                }
            });
        }

    } catch (e) {
        console.log(e);
        // Error එකක් ආවොත් React එක අයින් කිරීමට හෝ පෙන්වීමට හැක
    }
});
