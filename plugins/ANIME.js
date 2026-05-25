const { cmd } = require('../command');
const axios = require('axios');

const API = "https://dumiyh-ofc-anime-club2-api.vercel.app";

let sessions = {};

cmd({
    pattern: "anime",
    desc: "Anime Downloader",
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
┃ ❌ Give anime name
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

        const res = await axios.get(
            `${API}/api/search?q=${encodeURIComponent(query)}`
        );

        const results = res.data.result || [];

        if (results.length < 1) {
            return reply("❌ No results found");
        }

        sessions[sender] = {
            step: "search",
            data: results
        };

        let text = `╭━━〔 *ANIME SEARCH LIST* 〕━━⬣\n`;

        results.slice(0, 10).forEach((v, i) => {
            text += `┃ ${i + 1}. ${v.title}\n`;
        });

        text += `╰━━━━━━━━━━━━━━⬣\n\n`;
        text += `📌 Reply with number`;

        return reply(text);

    } catch (e) {
        console.log(e);
        reply("❌ Error");
    }
});

// =========================
// REPLY HANDLER
// =========================
cmd({
    on: "body"
},
async (conn, mek, m, {
    from,
    body,
    sender,
    reply
}) => {

    try {

        if (!sessions[sender]) return;

        const session = sessions[sender];

        const num = parseInt(body);

        if (isNaN(num)) return;

        // =========================
        // SEARCH SELECT
        // =========================
        if (session.step === "search") {

            const selected = session.data[num - 1];

            if (!selected) {
                return reply("❌ Invalid number");
            }

            const details = await axios.get(
                `${API}/api/details?url=${encodeURIComponent(selected.url)}`
            );

            const info = details.data.result;

            // =========================
            // TV SERIES
            // =========================
            if (info.episodes && info.episodes.length > 0) {

                sessions[sender] = {
                    step: "episode",
                    title: info.title,
                    data: info.episodes
                };

                let epText =
`╭━━〔 *${info.title}* 〕━━⬣
┃ 📺 TV Series
┃ 🎬 Episodes : ${info.episodes.length}
╰━━━━━━━━━━━━━━⬣

`;

                info.episodes
                    .slice(0, 50)
                    .forEach((ep, i) => {

                    epText += `${i + 1}. ${ep.title || `Episode ${i + 1}`}\n`;

                });

                epText += `\n📌 Reply with episode number`;

                return reply(epText);

            }

            // =========================
            // MOVIE
            // =========================
            else {

                const downloads = info.downloads || {};

                sessions[sender] = {
                    step: "quality",
                    title: info.title,
                    data: downloads
                };

                let qText =
`╭━━〔 *${info.title}* 〕━━⬣
┃ 🎥 Movie
╰━━━━━━━━━━━━━━⬣

`;

                Object.keys(downloads).forEach((q, i) => {
                    qText += `${i + 1}. ${q}\n`;
                });

                qText += `\n📌 Reply with quality number`;

                return reply(qText);

            }

        }

        // =========================
        // EPISODE SELECT
        // =========================
        if (session.step === "episode") {

            const ep = session.data[num - 1];

            if (!ep) {
                return reply("❌ Invalid episode");
            }

            const details = await axios.get(
                `${API}/api/details?url=${encodeURIComponent(ep.url)}`
            );

            const info = details.data.result;

            const downloads = info.downloads || {};

            sessions[sender] = {
                step: "quality",
                title: session.title,
                data: downloads
            };

            let qText =
`╭━━〔 *SELECT QUALITY* 〕━━⬣

`;

            Object.keys(downloads).forEach((q, i) => {
                qText += `${i + 1}. ${q}\n`;
            });

            qText += `\n📌 Reply with quality number`;

            return reply(qText);

        }

        // =========================
        // QUALITY SELECT
        // =========================
        if (session.step === "quality") {

            const qualities = Object.keys(session.data);

            const quality = qualities[num - 1];

            if (!quality) {
                return reply("❌ Invalid quality");
            }

            const links = session.data[quality];

            const dl = links[0]?.url || links[0];

            if (!dl) {
                return reply("❌ Download link not found");
            }

            await conn.sendMessage(from, {
                react: {
                    text: "⬇️",
                    key: mek.key
                }
            });

            // =========================
            // STREAM VIDEO
            // =========================
            const stream = await axios({
                method: "get",
                url: dl,
                responseType: "stream"
            });

            await conn.sendMessage(from, {
                video: stream.data,
                mimetype: "video/mp4",
                fileName: `${session.title}_${quality}.mp4`,
                caption:
`╭━━〔 *ANIME DOWNLOAD* 〕━━⬣
┃ 🎬 ${session.title}
┃ 📥 ${quality}
╰━━━━━━━━━━━━━━⬣`
            }, {
                quoted: mek
            });

            delete sessions[sender];

        }

    } catch (e) {

        console.log(e);

        reply("❌ Error processing request");

    }

});
