const { cmd } = require('../command');
const axios = require('axios');

// In-memory sessions to trace replies
const cinesubzSearchSessions = {};
const cinesubzDownloadSessions = {};

// Default configurations
const API_KEY = "9ef976898391ecb281dc63cd40582342";
const BASE_URL = "https://apis.sadas.dev/api/v1/movie/cinesubz";

cmd({
    pattern: "cinesubz",
    alias: ["cinesub", "cinesearch"],
    desc: "Search and Get Movies from Cinesubz",
    category: "search",
    react: "🍿",
    filename: __filename
},
async (conn, mek, m, { from, q, sender, reply }) => {
    try {
        if (!q) return reply('━━━━━━━━━━━━━━━━━━━\n\n│ \n│ \`Example\`\n│ • \`.cinesubz venom\`\n\n━━━━━━━━━━━━━━━━━━━');
        
        await conn.sendMessage(from, { react: { text: "🔄", key: mek.key } });
        
        // 1. Fetch search results (FIX: Send API key in headers)
        const searchUrl = `${BASE_URL}/search?q=${encodeURIComponent(q)}`;
        const response = await axios.get(searchUrl, {
            headers: {
                'x-api-key': API_KEY
            }
        });
        const data = response.data;
        
        if (!data || !data.status || !data.data || data.data.length === 0) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply('❌ *Movie not found on Cinesubz! Please check the name and try again.*');
        }
        
        const results = data.data;
        const movies = results.slice(0, 10); 
        let listText = '*🍿 CINESUBZ SEARCH RESULTS*\n━━━━━━━━━━━━━━━━━━━\n\n';

        movies.forEach((movie, index) => {
            listText += `*[ ${index + 1} ]* ${movie.title}\n`;
            if(movie.year) listText += `↳ Year: ${movie.year}\n`;
            if(movie.quality) listText += `↳ Quality: ${movie.quality}\n`;
            listText += '\n';
        });
        
        listText += '━━━━━━━━━━━━━━━━━━━\n> \`Reply to this message with the number to select the movie.\`';

        let msgOptions = { caption: listText };
        if (movies[0].image || movies[0].thumb) {
            msgOptions.image = { url: movies[0].image || movies[0].thumb };
        }

        const sentMsg = await conn.sendMessage(from, msgOptions, { quoted: mek });
        
        cinesubzSearchSessions[sentMsg.key.id] = { user: sender, results: movies };
        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
        
    } catch (e) {
        console.error(e);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply(`❌ Error: ${e.response ? e.response.status + " " + e.response.statusText : e.message}`);
    }
});

cmd({ on: "body" }, async (conn, mek, m, { from, body, sender, reply }) => {
    try {
        // Robust extraction of Reply ID
        const quotedId = m.quoted?.id || m.msg?.contextInfo?.stanzaId || mek.message?.extendedTextMessage?.contextInfo?.stanzaId;
        if (!quotedId) return;

        // Robust extraction of Message Text
        const text = body || m.body || mek.message?.conversation || mek.message?.extendedTextMessage?.text || "";
        if (!text) return;

        // STEP 2: Movie Selection
        if (cinesubzSearchSessions[quotedId]) {
            const session = cinesubzSearchSessions[quotedId];
            
            const num = parseInt(text.trim());
            if (isNaN(num)) return; // Ignore if user replies with non-number text
            if (num < 1 || num > session.results.length) return reply('❌ *Invalid selection. Reply with a valid number.*');
            
            const selectedMovie = session.results[num - 1];
            await conn.sendMessage(from, { react: { text: "🔄", key: mek.key } });
            
            const urlQuery = encodeURIComponent(selectedMovie.link || selectedMovie.url);
            
            // FIX: Download Links are already provided in the info endpoint.
            const infoRes = await axios.get(`${BASE_URL}/info?q=${urlQuery}`, {
                headers: {
                    'x-api-key': API_KEY
                }
            });
            const infoDataWrapper = infoRes.data;

            if (!infoDataWrapper.status || !infoDataWrapper.data) {
                return reply('❌ *Failed to fetch movie details.*');
            }

            const infoData = infoDataWrapper.data;
            
            let detailsText = '*🍿 CINESUBZ MOVIE DETAILS*\n━━━━━━━━━━━━━━━━━━━\n';
            detailsText += `│ • \`TITLE\` : ${infoData.title || selectedMovie.title}\n`;
            if(infoData.year) detailsText += `│ • \`YEAR\` : ${infoData.year}\n`;
            if(infoData.imdb_rating) detailsText += `│ • \`IMDb\` : ⭐ ${infoData.imdb_rating}\n`;
            detailsText += '━━━━━━━━━━━━━━━━━━━\n\n';

            const downloads = infoData.download_links || [];
            
            if (Array.isArray(downloads) && downloads.length > 0) {
                detailsText += '*⬇️ DOWNLOAD OPTIONS*\n\n';
                downloads.forEach((dl, idx) => {
                    detailsText += `*[ ${idx + 1} ]* ${dl.quality} - ${dl.size || 'Unknown Size'}\n`;
                });
                detailsText += '\n━━━━━━━━━━━━━━━━━━━\n> \`Reply to this msg with the download number.\`';
            } else {
                detailsText += '*⚠️ Download Status:*\nNot Available or No Direct Links Found\n\n';
            }

            let msgOptions = { caption: detailsText };
            if (infoData.poster || selectedMovie.image) {
                msgOptions.image = { url: infoData.poster || selectedMovie.image };
            }

            const newMsg = await conn.sendMessage(from, msgOptions, { quoted: mek });
            
            if (downloads.length > 0) {
                cinesubzDownloadSessions[newMsg.key.id] = {
                    user: sender,
                    title: infoData.title || selectedMovie.title,
                    downloads: downloads
                };
            }
            
            delete cinesubzSearchSessions[quotedId];
            await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
            return;
        }

        // STEP 3: Download Selection with Heroku Stream Opt.
        if (cinesubzDownloadSessions[quotedId]) {
            const session = cinesubzDownloadSessions[quotedId];
            
            const num = parseInt(text.trim());
            if (isNaN(num)) return;
            if (num < 1 || num > session.downloads.length) return reply('❌ *Invalid selection. Reply with a valid number.*');
            
            const selectedDl = session.downloads[num - 1];
            // Extract final direct link from object
            const downloadLink = selectedDl.final_link || selectedDl.original_zt_link || selectedDl.url || selectedDl.link;
            
            await conn.sendMessage(from, { react: { text: "⬇️", key: mek.key } });
            reply(`*Downloading: ${session.title} - ${selectedDl.quality}*\n_Please wait, file is downloading..._\n\n> 🚀 \`\`\`Using Memory Stream. Heroku Safe!\`\`\``);
            
            try {
                // HERO-STREAMING: Avoid 512MB RAM Crash
                const streamResponse = await axios({
                    method: 'GET',
                    url: downloadLink,
                    responseType: 'stream' 
                });
                
                await conn.sendMessage(from, { 
                    document: { stream: streamResponse.data }, 
                    mimetype: "video/mp4",
                    fileName: `${session.title} - ${selectedDl.quality}.mp4`,
                    caption: `🎬 *${session.title}*\n✨ Quality: ${selectedDl.quality}\n\n> \`\`\`Downloaded via Cinesubz Plugin\`\`\``
                }, { quoted: mek });
                
                await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
            } catch (err) {
                console.error("Stream Error", err);
                reply(`❌ *Limit Exceeded.* Size might be too large for Whatsapp Server limits.\n\nHere is the manual download link:\n${downloadLink}`);
                await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            }
            
            delete cinesubzDownloadSessions[quotedId];
        }
    } catch (e) {
       console.log(e);
    }
});
