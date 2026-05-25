const { cmd } = require('../command');
const axios = require('axios');

const API = 'https://dumiyh-ofc-anime-club2-api.vercel.app';

// =========================
// SESSION STORAGE
// =========================
let animeSession = {};

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

        // =========================
        // SEARCH REACT
        // =========================
        await conn.sendMessage(from, {
            react: {
                text: "🔍",
                key: mek.key
            }
        });

        // =========================
        // SEARCH API
        // =========================
        const res = await axios.get(
            `${API}/api/search?q=${encodeURIComponent(query)}`
        );

        console.log("SEARCH:", res.data);

        let results = [];

        if (Array.isArray(res.data)) {
            results = res.data;
        }

        else if (Array.isArray(res.data.result)) {
            results = res.data.result;
        }

        else if (Array.isArray(res.data.results)) {
            results = res.data.results;
        }

        else if (Array.isArray(res.data.data)) {
            results = res.data.data;
        }

        if (!results || results.length < 1) {
            return reply("❌ No results found");
        }

        // =========================
        // SAVE SEARCH SESSION
        // =========================
        animeSession[sender] = {
            step: "search",
            results: results
        };

        let txt =
`╭━━〔 *ANIME SEARCH LIST* 〕━━⬣
`;

        results.slice(0, 10).forEach((v, i) => {

            txt += `┃ ${i + 1}. ${v.title || v.name}\n`;

        });

        txt += `╰━━━━━━━━━━━━━━⬣

📌 Reply with number`;

        return reply(txt);

    } catch (e) {

        console.log(e);

        return reply("❌ Search failed");

    }

});

// =========================
// REPLY HANDLER
// =========================
cmd({
    on: "text"
},
async (conn, mek, m, {
    from,
    body,
    sender,
    reply
}) => {

    try {

        if (!animeSession[sender]) return;

        const session = animeSession[sender];

        const num = parseInt(body);

        if (isNaN(num)) return;

        // =========================
        // SEARCH SELECT
        // =========================
        if (session.step === "search") {

            const selected = session.results[num - 1];

            if (!selected) {
                return reply("❌ Invalid number");
            }

            await conn.sendMessage(from, {
                react: {
                    text: "⏳",
                    key: mek.key
                }
            });

            // =========================
            // DETAILS API
            // =========================
            const details = await axios.get(
`${API}/api/details?url=${encodeURIComponent(selected.url)}`
            );

            console.log("DETAILS:", details.data);

            let info = {};

            if (details.data.result) {
                info = details.data.result;
            }

            else if (details.data.data) {
                info = details.data.data;
            }

            else {
                info = details.data;
            }

            // =========================
            // SERIES
            // =========================
            if (info.episodes && info.episodes.length > 0) {

                animeSession[sender] = {
                    step: "episode",
                    title: info.title || "Anime",
                    episodes: info.episodes
                };

                let epText =
`╭━━〔 *${info.title || "Anime"}* 〕━━⬣
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

                if (Object.keys(downloads).length < 1) {
                    return reply("❌ No download links found");
                }

                animeSession[sender] = {
                    step: "quality",
                    title: info.title || "Anime",
                    downloads: downloads
                };

                let qText =
`╭━━〔 *${info.title || "Anime"}* 〕━━⬣
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

            const ep = session.episodes[num - 1];

            if (!ep) {
                return reply("❌ Invalid episode");
            }

            await conn.sendMessage(from, {
                react: {
                    text: "📥",
                    key: mek.key
                }
            });

            // =========================
            // EP DETAILS
            // =========================
            const details = await axios.get(
`${API}/api/details?url=${encodeURIComponent(ep.url)}`
            );

            console.log("EP DETAILS:", details.data);

            let info = {};

            if (details.data.result) {
                info = details.data.result;
            }

            else if (details.data.data) {
                info = details.data.data;
            }

            else {
                info = details.data;
            }

            const downloads = info.downloads || {};

            if (Object.keys(downloads).length < 1) {
                return reply("❌ No download links found");
            }

            animeSession[sender] = {
                step: "quality",
                title: session.title,
                downloads: downloads
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

            const qualities =
                Object.keys(session.downloads);

            const quality =
                qualities[num - 1];

            if (!quality) {
                return reply("❌ Invalid quality");
            }

            const links =
                session.downloads[quality];

            const dl =
                links[0]?.url || links[0];

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
                method: 'get',
                url: dl,
                responseType: 'stream'
            });

            await conn.sendMessage(from, {
                video: stream.data,
                mimetype: 'video/mp4',
                fileName:
`${session.title}_${quality}.mp4`,
                caption:
`╭━━〔 *ANIME DOWNLOAD* 〕━━⬣
┃ 🎬 ${session.title}
┃ 📥 ${quality}
╰━━━━━━━━━━━━━━⬣`
            }, {
                quoted: mek
            });

            // =========================
            // CLEAR SESSION
            // =========================
            delete animeSession[sender];

        }

    } catch (e) {

        console.log("HANDLER ERROR:", e);

        return reply("❌ Error processing request");

    }

});
