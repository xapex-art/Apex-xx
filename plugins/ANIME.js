const { cmd } = require('../command');
const axios = require('axios');

const API = 'https://dumiyh-ofc-anime-club2-api.vercel.app';

// =========================
// SESSION STORAGE
// =========================
let animeSession = {};

// =========================
// MAIN COMMAND
// =========================
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
        // REACT
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
            `${API}/api/search?q=${encodeURIComponent(query)}`,
            {
                headers: {
                    'User-Agent': 'Mozilla/5.0'
                }
            }
        );

        console.log("SEARCH API:", res.data);

        let results = [];

        // =========================
        // FIX API RESULT
        // =========================
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

        // =========================
        // NO RESULTS
        // =========================
        if (!results || results.length < 1) {

            return reply(
`╭━━〔 *ANIME SEARCH* 〕━━⬣
┃ ❌ No results found
╰━━━━━━━━━━━━━━⬣`
            );

        }

        // =========================
        // SAVE SESSION
        // =========================
        animeSession[sender] = {
            step: "search",
            data: results
        };

        // =========================
        // SEARCH LIST
        // =========================
        let txt =
`╭━━〔 *ANIME SEARCH LIST* 〕━━⬣
`;

        results.slice(0, 15).forEach((v, i) => {

            txt += `┃ ${i + 1}. ${v.title || v.name || "No Title"}\n`;

        });

        txt += `╰━━━━━━━━━━━━━━⬣

📌 Reply with number`;

        return reply(txt);

    } catch (e) {

        console.log("SEARCH ERROR:", e.response?.data || e);

        return reply(
`╭━━〔 *ANIME ERROR* 〕━━⬣
┃ ❌ API Error
╰━━━━━━━━━━━━━━⬣`
        );

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

        if (!animeSession[sender]) return;

        const session = animeSession[sender];

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
`${API}/api/details?url=${encodeURIComponent(selected.url)}`,
                {
                    headers: {
                        'User-Agent': 'Mozilla/5.0'
                    }
                }
            );

            console.log("DETAILS API:", details.data);

            let info = {};

            // =========================
            // FIX DETAILS RESULT
            // =========================
            if (details.data.result) {
                info = details.data.result;
            }

            else if (details.data.results) {
                info = details.data.results;
            }

            else if (details.data.data) {
                info = details.data.data;
            }

            else {
                info = details.data;
            }

            // =========================
            // TV SERIES
            // =========================
            if (info.episodes && info.episodes.length > 0) {

                animeSession[sender] = {
                    step: "episode",
                    title: info.title || "Anime",
                    data: info.episodes
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
                    data: downloads
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

            const ep = session.data[num - 1];

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
`${API}/api/details?url=${encodeURIComponent(ep.url)}`,
                {
                    headers: {
                        'User-Agent': 'Mozilla/5.0'
                    }
                }
            );

            console.log("EP DETAILS:", details.data);

            let info = {};

            if (details.data.result) {
                info = details.data.result;
            }

            else if (details.data.results) {
                info = details.data.results;
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
                responseType: "stream",
                headers: {
                    'User-Agent': 'Mozilla/5.0'
                }
            });

            await conn.sendMessage(from, {
                video: stream.data,
                mimetype: "video/mp4",
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

        console.log("HANDLER ERROR:", e.response?.data || e);

        return reply(
`╭━━〔 *ANIME ERROR* 〕━━⬣
┃ ❌ Error processing request
╰━━━━━━━━━━━━━━⬣`
        );

    }

});
