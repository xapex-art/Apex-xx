const { cmd } = require('../command');
const axios = require('axios');

const API = 'https://dumiyh-ofc-anime-club2-api.vercel.app';

// =========================
// TEMP STORAGE
// =========================
const searchStore = new Map();
const episodeStore = new Map();
const qualityStore = new Map();

cmd({
    pattern: "anime",
    desc: "Anime Search & Download",
    category: "anime",
    react: "🎌",
    filename: __filename
},
async (conn, mek, m, {
    from,
    args,
    reply,
    sender
}) => {

    try {

        const query = args.join(" ");

        if (!query) {
            return reply(
`╭━━〔 *ANIME SEARCH* 〕━━⬣
┃ ❌ Please provide anime name
┃
┃ 📌 Example:
┃ .anime naruto
╰━━━━━━━━━━━━━━⬣`
            );
        }

        await conn.sendMessage(from, {
            react: {
                text: "🔍",
                key: mek.key
            }
        });

        // =========================
        // SEARCH
        // =========================
        const res = await axios.get(
            `${API}/api/search?q=${encodeURIComponent(query)}`
        );

        const results = res.data.result || [];

        if (results.length < 1) {
            return reply(
`╭━━〔 *ANIME SEARCH* 〕━━⬣
┃ ❌ No results found.
╰━━━━━━━━━━━━━━⬣`
            );
        }

        searchStore.set(sender, results);

        let txt = `╭━━〔 *ANIME SEARCH LIST* 〕━━⬣\n`;

        results.slice(0, 15).forEach((v, i) => {
            txt += `┃ ${i + 1}. ${v.title}\n`;
        });

        txt += `╰━━━━━━━━━━━━━━⬣\n\n`;
        txt += `📌 Reply with a number`;

        const listMsg = await conn.sendMessage(from, {
            text: txt
        }, {
            quoted: mek
        });

        // =========================
        // MESSAGE LISTENER
        // =========================
        const mainHandler = async(chatUpdate) => {

            try {

                const msg = chatUpdate.messages[0];

                if (!msg.message) return;

                const body =
                    msg.message.conversation ||
                    msg.message.extendedTextMessage?.text;

                if (!body) return;

                const replyId =
                    msg.message?.extendedTextMessage?.contextInfo?.stanzaId;

                // =========================
                // SELECT ANIME
                // =========================
                if (replyId === listMsg.key.id) {

                    const num = parseInt(body);

                    if (isNaN(num)) return;

                    const selected = searchStore.get(sender)?.[num - 1];

                    if (!selected) {
                        return conn.sendMessage(from, {
                            text: "❌ Invalid number"
                        }, {
                            quoted: msg
                        });
                    }

                    await conn.sendMessage(from, {
                        react: {
                            text: "⏳",
                            key: msg.key
                        }
                    });

                    const details = await axios.get(
                        `${API}/api/details?url=${encodeURIComponent(selected.url)}`
                    );

                    const info = details.data.result;

                    // =========================
                    // TV SERIES
                    // =========================
                    if (info.episodes && info.episodes.length > 0) {

                        episodeStore.set(sender, info.episodes);

                        let epText =
`╭━━〔 *${info.title}* 〕━━⬣
┃ 📺 Type : TV Series
┃ 🎬 Episodes : ${info.episodes.length}
╰━━━━━━━━━━━━━━⬣

📌 Reply with episode number

`;

                        info.episodes
                            .slice(0, 50)
                            .forEach((ep, i) => {

                            epText += `${i + 1}. ${ep.title || `Episode ${i + 1}`}\n`;

                        });

                        const epMsg = await conn.sendMessage(from, {
                            text: epText
                        }, {
                            quoted: msg
                        });

                        // =========================
                        // EPISODE HANDLER
                        // =========================
                        const episodeHandler = async(epUpdate) => {

                            try {

                                const epData = epUpdate.messages[0];

                                if (!epData.message) return;

                                const epBody =
                                    epData.message.conversation ||
                                    epData.message.extendedTextMessage?.text;

                                if (!epBody) return;

                                const epReply =
                                    epData.message?.extendedTextMessage
                                        ?.contextInfo?.stanzaId;

                                if (epReply !== epMsg.key.id) return;

                                const epNum = parseInt(epBody);

                                if (isNaN(epNum)) return;

                                const selectedEp =
                                    episodeStore.get(sender)?.[epNum - 1];

                                if (!selectedEp) {
                                    return reply("❌ Invalid episode number");
                                }

                                await conn.sendMessage(from, {
                                    react: {
                                        text: "📥",
                                        key: epData.key
                                    }
                                });

                                const epDetails = await axios.get(
                                    `${API}/api/details?url=${encodeURIComponent(selectedEp.url)}`
                                );

                                const epInfo = epDetails.data.result;

                                const downloads = epInfo.downloads || {};

                                if (Object.keys(downloads).length < 1) {
                                    return reply("❌ No download links found");
                                }

                                qualityStore.set(sender, downloads);

                                let qText =
`╭━━〔 *SELECT QUALITY* 〕━━⬣
`;

                                Object.keys(downloads).forEach((q, i) => {

                                    qText += `┃ ${i + 1}. ${q}\n`;

                                });

                                qText += `╰━━━━━━━━━━━━━━⬣\n\n`;
                                qText += `📌 Reply with quality number`;

                                const qMsg = await conn.sendMessage(from, {
                                    text: qText
                                }, {
                                    quoted: epData
                                });

                                // =========================
                                // QUALITY HANDLER
                                // =========================
                                const qualityHandler = async(qUpdate) => {

                                    try {

                                        const qData = qUpdate.messages[0];

                                        if (!qData.message) return;

                                        const qBody =
                                            qData.message.conversation ||
                                            qData.message.extendedTextMessage?.text;

                                        if (!qBody) return;

                                        const qReply =
                                            qData.message?.extendedTextMessage
                                                ?.contextInfo?.stanzaId;

                                        if (qReply !== qMsg.key.id) return;

                                        const qNum = parseInt(qBody);

                                        if (isNaN(qNum)) return;

                                        const qualities = Object.keys(
                                            qualityStore.get(sender)
                                        );

                                        const selectedQuality =
                                            qualities[qNum - 1];

                                        if (!selectedQuality) {
                                            return reply("❌ Invalid quality");
                                        }

                                        const links =
                                            qualityStore
                                                .get(sender)[selectedQuality];

                                        const dl =
                                            links[0]?.url || links[0];

                                        if (!dl) {
                                            return reply(
                                                "❌ Download link not found"
                                            );
                                        }

                                        await conn.sendMessage(from, {
                                            react: {
                                                text: "⬇️",
                                                key: qData.key
                                            }
                                        });

                                        // =========================
                                        // STREAM VIDEO
                                        // =========================
                                        const stream = await axios({
                                            method: 'get',
                                            url: dl,
                                            responseType: 'stream'
                                        });

                                        await conn.sendMessage(from, {
                                            video: stream.data,
                                            mimetype: 'video/mp4',
                                            fileName:
`${info.title}_${selectedQuality}.mp4`,
                                            caption:
`╭━━〔 *ANIME DOWNLOAD* 〕━━⬣
┃ 🎬 ${info.title}
┃ 📥 Quality : ${selectedQuality}
╰━━━━━━━━━━━━━━⬣`
                                        }, {
                                            quoted: qData
                                        });

                                        conn.ev.off(
                                            'messages.upsert',
                                            qualityHandler
                                        );

                                    } catch (e) {
                                        console.log(e);
                                    }

                                };

                                conn.ev.on(
                                    'messages.upsert',
                                    qualityHandler
                                );

                                conn.ev.off(
                                    'messages.upsert',
                                    episodeHandler
                                );

                            } catch (e) {
                                console.log(e);
                            }

                        };

                        conn.ev.on(
                            'messages.upsert',
                            episodeHandler
                        );

                    }

                    // =========================
                    // MOVIE
                    // =========================
                    else {

                        const downloads = info.downloads || {};

                        if (Object.keys(downloads).length < 1) {
                            return reply("❌ No download links found");
                        }

                        qualityStore.set(sender, downloads);

                        let qText =
`╭━━〔 *${info.title}* 〕━━⬣
┃ 🎥 Type : Movie
╰━━━━━━━━━━━━━━⬣

`;

                        Object.keys(downloads).forEach((q, i) => {

                            qText += `┃ ${i + 1}. ${q}\n`;

                        });

                        qText += `╰━━━━━━━━━━━━━━⬣\n\n`;
                        qText += `📌 Reply with quality number`;

                        const qMsg = await conn.sendMessage(from, {
                            text: qText
                        }, {
                            quoted: msg
                        });

                        // =========================
                        // MOVIE QUALITY HANDLER
                        // =========================
                        const movieHandler = async(qUpdate) => {

                            try {

                                const qData = qUpdate.messages[0];

                                if (!qData.message) return;

                                const qBody =
                                    qData.message.conversation ||
                                    qData.message.extendedTextMessage?.text;

                                if (!qBody) return;

                                const qReply =
                                    qData.message?.extendedTextMessage
                                        ?.contextInfo?.stanzaId;

                                if (qReply !== qMsg.key.id) return;

                                const qNum = parseInt(qBody);

                                if (isNaN(qNum)) return;

                                const qualities = Object.keys(
                                    qualityStore.get(sender)
                                );

                                const selectedQuality =
                                    qualities[qNum - 1];

                                if (!selectedQuality) {
                                    return reply("❌ Invalid quality");
                                }

                                const links =
                                    qualityStore
                                        .get(sender)[selectedQuality];

                                const dl =
                                    links[0]?.url || links[0];

                                if (!dl) {
                                    return reply(
                                        "❌ Download link not found"
                                    );
                                }

                                await conn.sendMessage(from, {
                                    react: {
                                        text: "⬇️",
                                        key: qData.key
                                    }
                                });

                                // =========================
                                // STREAM VIDEO
                                // =========================
                                const stream = await axios({
                                    method: 'get',
                                    url: dl,
                                    responseType: 'stream'
                                });

                                await conn.sendMessage(from, {
                                    video: stream.data,
                                    mimetype: 'video/mp4',
                                    fileName:
`${info.title}_${selectedQuality}.mp4`,
                                    caption:
`╭━━〔 *ANIME DOWNLOAD* 〕━━⬣
┃ 🎬 ${info.title}
┃ 📥 Quality : ${selectedQuality}
╰━━━━━━━━━━━━━━⬣`
                                }, {
                                    quoted: qData
                                });

                                conn.ev.off(
                                    'messages.upsert',
                                    movieHandler
                                );

                            } catch (e) {
                                console.log(e);
                            }

                        };

                        conn.ev.on(
                            'messages.upsert',
                            movieHandler
                        );

                    }

                    conn.ev.off(
                        'messages.upsert',
                        mainHandler
                    );

                }

            } catch (e) {
                console.log(e);
            }

        };

        conn.ev.on(
            'messages.upsert',
            mainHandler
        );

    } catch (e) {

        console.log("anime error =>", e);

        reply(
`╭━━〔 *ANIME ERROR* 〕━━⬣
┃ ❌ ${e.message}
╰━━━━━━━━━━━━━━⬣`
        );
    }
});
