const { cmd } = require('../command');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_KEY = "ec6c9505fa330141f4b3f458a9c72158";
const BASE_URL = "https://apis.sadas.dev/api/v1/movie/cinesubz";

global.cinesubzSession = global.cinesubzSession || {};

// ==========================================
// 1. MAIN COMMAND (SEARCH MOVIE)
// ==========================================
cmd({
    pattern: "cinesubz",
    desc: "Search and download movies from CineSubz.",
    category: "download",
    react: "🎬",
    filename: __filename
},
async (conn, mek, m, { from, q, reply, sender }) => {
    try {
        if (!q) return reply("උදාහරණය: .cinesubz Spiderman");

        await conn.sendMessage(from, { react: { text: '🔍', key: mek.key } });

        const searchUrl = `${BASE_URL}/search?q=${encodeURIComponent(q)}&apiKey=${API_KEY}`;
        const searchRes = await axios.get(searchUrl);
        const results = searchRes.data.result || searchRes.data.data || [];

        if (!results || results.length === 0) return reply("චිත්‍රපට සොයාගත නොහැකි විය.");

        // බොට් එවූ මැසේජ් එකේ ID එක ලබා ගනිමු
        const sentMsg = await conn.sendMessage(from, { 
            image: { url: results[0].image || results[0].img || "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba" }, 
            caption: `🎬 *CINESUBZ SEARCH*\n\nQuery: ${q}\n\n${results.map((m, i) => `*${i + 1}* - ${m.title}`).join('\n')}\n\n> *චිත්‍රපටයක් තෝරා ගැනීමට එහි අංකය Reply කරන්න.*`
        }, { quoted: mek });

        // Session එක සේව් කරමු (මෙම මැසේජ් එකට Reply කළ විට පමණක් වැඩ කිරීමට ID එක වැදගත් වේ)
        global.cinesubzSession[sender] = {
            step: 1,
            results: results,
            messageId: sentMsg.key.id 
        };

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
    } catch (e) {
        reply(`Error: ${e.message}`);
    }
});

// ==========================================
// 2. REPLY HANDLER
// ==========================================
cmd({ on: "text" }, async (conn, mek, m, { from, body, reply, sender }) => {
    try {
        const session = global.cinesubzSession[sender];
        if (!session) return;

        // පරිශීලකයා Reply කරන්නේ බොට්ගේ කලින් මැසේජ් එකටදැයි බලමු
        if (!m.quoted || m.quoted.id !== session.messageId) return;

        const num = parseInt(body.trim());
        if (isNaN(num)) return;

        // --- STEP 1: SELECT MOVIE ---
        if (session.step === 1) {
            const index = num - 1;
            if (index < 0 || index >= session.results.length) return reply("වැරදි අංකයකි.");

            await conn.sendMessage(from, { react: { text: '🔍', key: mek.key } });
            
            const selectedMovie = session.results[index];
            const infoRes = await axios.get(`${BASE_URL}/info?q=${encodeURIComponent(selectedMovie.url || selectedMovie.link)}&apiKey=${API_KEY}`);
            const infoData = infoRes.data.result || infoRes.data.data;

            if (!infoData) return reply("විස්තර ලබා ගත නොහැක.");

            const dlLinks = infoData.dl_links || infoData.links || [];
            
            const sentMsg = await conn.sendMessage(from, { 
                image: { url: selectedMovie.image || infoData.image }, 
                caption: `🎬 ${selectedMovie.title}\n\n*Download Quality:* \n${dlLinks.map((l, i) => `*${i + 1}* - ${l.quality || 'Download'}`).join('\n')}\n\n> *අංකය Reply කර බාගන්න.*`
            }, { quoted: mek });

            // Session යාවත්කාලීන කරන්න
            global.cinesubzSession[sender] = {
                step: 2,
                movieTitle: selectedMovie.title,
                dlLinks: dlLinks,
                messageId: sentMsg.key.id
            };
        } 
        
        // --- STEP 2: DOWNLOAD MOVIE ---
        else if (session.step === 2) {
            const index = num - 1;
            const links = session.dlLinks;
            if (!links || index < 0 || index >= links.length) return reply("වැරදි අංකයකි.");

            const finalDlUrl = links[index].url || links[index].link;
            await reply(`📥 බාගත වෙමින් පවතී: *${session.movieTitle}*\n\n> ⚡ Powered by ApEx MINI`);

            // Direct API Download URL
            const dlRes = await axios.get(`${BASE_URL}/dl?q=${encodeURIComponent(finalDlUrl)}&apiKey=${API_KEY}`);
            const directLink = dlRes.data.result?.url || dlRes.data.data?.url || finalDlUrl;

            const tempFilePath = path.join(__dirname, `../${Date.now()}.mp4`);
            const writer = fs.createWriteStream(tempFilePath);
            const response = await axios({ method: 'get', url: directLink, responseType: 'stream' });
            
            response.data.pipe(writer);

            await new Promise((resolve) => writer.on('finish', resolve));

            // SEND FILE
            await conn.sendMessage(from, {
                document: { url: tempFilePath },
                mimetype: 'video/mp4',
                fileName: `${session.movieTitle.replace(/[^a-zA-Z0-9 ]/g, "").trim()} ApEx MINI.mp4`,
                caption: `🎬 ${session.movieTitle}\n\n> ⚡ Powered by ApEx MINI`
            }, { quoted: mek });

            // Clean
            if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
            delete global.cinesubzSession[sender];
        }
    } catch (e) {
        console.log(e);
        reply(`Error: ${e.message}`);
    }
});

