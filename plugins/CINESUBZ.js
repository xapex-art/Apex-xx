const { cmd } = require('../command');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// API Configurations
const API_KEY = "ec6c9505fa330141f4b3f458a9c72158";
const BASE_URL = "https://apis.sadas.dev/api/v1/movie/cinesubz";

// Global Session Store (Temporary tracking for steps)
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
        if (!q) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
            return reply("━━━━━━━━━━━━━━━━━━━\n\n│ *Example:*\n│ • `.cinesubz Spiderman`\n\n━━━━━━━━━━━━━━━━━━━");
        }

        await conn.sendMessage(from, { react: { text: '🔍', key: mek.key } });

        // Fetch Search Results
        const searchUrl = `${BASE_URL}/search?q=${encodeURIComponent(q)}&apiKey=${API_KEY}`;
        const searchRes = await axios.get(searchUrl);
        const results = searchRes.data.result || searchRes.data.data || [];

        if (!results || results.length === 0) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
            return reply("❌ චිත්‍රපට සොයාගත නොහැකි විය. කරුණාකර වෙනත් නමකින් උත්සාහ කරන්න.");
        }

        // Store Session for Step 1 (Search Results)
        global.cinesubzSession[sender] = {
            step: 1,
            results: results
        };

        // Construct Message
        let listMsg = `🎬 *CINESUBZ MOVIE SEARCH* 🎬\n\n🔎 *Search Query:* \`${q}\`\n━━━━━━━━━━━━━━━━━━━\n\n`;

        results.forEach((movie, i) => {
            listMsg += `│ *${i + 1}* - ${movie.title || movie.name}\n`;
        });

        listMsg += `\n━━━━━━━━━━━━━━━━━━━\n> *අදාළ චිත්‍රපටයේ විස්තර බැලීමට එහි අංකය පමණක් ටයිප් කර එවන්න (උදා: 1)*`;

        // Get the first movie's image for the header
        const mainImage = results[0].image || results[0].img || "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba";

        await conn.sendMessage(from, { 
            image: { url: mainImage }, 
            caption: listMsg 
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

    } catch (e) {
        console.log(e);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply(`*Error:* ${e.message}`);
    }
});

// ==========================================
// 2. DIRECT NUMBER REPLY LISTENER (NO QUOTE NEEDED)
// ==========================================
cmd({
    on: "text"
},
async (conn, mek, m, { from, body, reply, sender }) => {
    try {
        // Check if this specific user has an active session
        const session = global.cinesubzSession[sender];
        if (!session) return; 

        // Extract and clean the input text
        const textInput = body || m.text || "";
        const num = parseInt(textInput.trim());
        
        // If the user didn't type a valid number, ignore it and let other commands work
        if (isNaN(num)) return;

        // ------------------------------------------
        // STEP 1: MOVIE SELECTION -> SHOW INFO & QUALITY
        // ------------------------------------------
        if (session.step === 1) {
            const index = num - 1;
            
            if (index < 0 || index >= session.results.length) {
                return reply("❌ වලංගු නොවන අංකයකි. ලැයිස්තුවේ ඇති අංකයක් ලබා දෙන්න.");
            }

            await conn.sendMessage(from, { react: { text: '🔍', key: mek.key } });
            const selectedMovie = session.results[index];
            const movieUrl = selectedMovie.url || selectedMovie.link;

            // Fetch Movie Info from API
            const infoUrl = `${BASE_URL}/info?q=${encodeURIComponent(movieUrl)}&apiKey=${API_KEY}`;
            const infoRes = await axios.get(infoUrl);
            const infoData = infoRes.data.result || infoRes.data.data;

            if (!infoData) {
                return reply("❌ චිත්‍රපටයේ විස්තර ලබා ගැනීමට නොහැකි විය.");
            }

            const dlLinks = infoData.dl_links || infoData.links || [];

            // Update Session to Step 2 (Quality Selection)
            global.cinesubzSession[sender] = {
                step: 2,
                movieTitle: selectedMovie.title || infoData.title || "Movie",
                dlLinks: dlLinks
            };

            let infoMsg = `🎬 *${global.cinesubzSession[sender].movieTitle}*\n\n`;
            if (infoData.description) infoMsg += `ℹ️ *Description:* ${infoData.description}\n\n`;
            infoMsg += `━━━━━━━━━━━━━━━━━━━\n\n📥 *SELECT QUALITY TO DOWNLOAD:*\n\n`;
            
            if (dlLinks.length > 0) {
                dlLinks.forEach((link, i) => {
                    infoMsg += `│ *${i + 1}* - ${link.quality || link.name || 'Download (480p)'}\n`;
                });
            } else {
                infoMsg += `│ *1* - Download Movie (480p Quality)\n`;
            }
            infoMsg += `\n━━━━━━━━━━━━━━━━━━━\n> *Download කිරීමට අවශ්‍ය Quality එකෙහි අංකය පමණක් ටයිප් කර එවන්න (උදා: 1)*`;

            const movieImg = selectedMovie.image || infoData.image || "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba";

            await conn.sendMessage(from, { 
                image: { url: movieImg }, 
                caption: infoMsg 
            }, { quoted: mek });

            await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
            return;
        }

        // ------------------------------------------
        // STEP 2: QUALITY SELECTION -> STREAM & DOWNLOAD FILE
        // ------------------------------------------
        if (session.step === 2) {
            const index = num - 1;
            const links = session.dlLinks;
            
            if (links && links.length > 0 && (index < 0 || index >= links.length)) {
                return reply("❌ වලංගු නොවන අංකයකි. කරුණාකර නිවැරදි Quality අංකයක් ලබා දෙන්න.");
            }

            let finalDlUrl = links.length > 0 ? (links[index].url || links[index].link) : "";
            if (!finalDlUrl) return reply("❌ බාගත කිරීමේ ලින්ක් එක සොයාගත නොහැකි විය.");

            await reply(`📥 *${session.movieTitle}* චිත්‍රපටය බාගත වෙමින් පවතී...\n\n> ⚡ *Heroku Crash වීම වැළැක්වීම සඳහා මෙය සෘජුවම Stream වෙමින් පවතී. කරුණාකර රැඳී සිටින්න.*`);
            await conn.sendMessage(from, { react: { text: '⚡', key: mek.key } });

            // Call Download API for the Direct Link
            const dlApiUrl = `${BASE_URL}/dl?q=${encodeURIComponent(finalDlUrl)}&apiKey=${API_KEY}`;
            let directLink = finalDlUrl;
            
            try {
                const dlRes = await axios.get(dlApiUrl);
                if (dlRes.data && (dlRes.data.result || dlRes.data.data)) {
                    directLink = dlRes.data.result?.url || dlRes.data.data?.url || directLink;
                }
            } catch (err) {
                console.log("Download API Error, trying direct link flow...");
            }

            // Clean Title for Filename & Setup Temp File Path
            const cleanTitle = session.movieTitle.replace(/[^a-zA-Z0-9 ]/g, "").trim();
            const fileName = `${cleanTitle} ApEx MINI.mp4`;
            const tempFilePath = path.join(__dirname, `../${Date.now()}.mp4`);

            // Safe Streaming Download (Writes directly to Local Disk chunk-by-chunk to save RAM)
            const writer = fs.createWriteStream(tempFilePath);
            const streamResponse = await axios({
                method: 'get',
                url: directLink,
                responseType: 'stream'
            });

            streamResponse.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            // Send Document via Baileys Stream (Reads directly from temp path)
            await conn.sendMessage(from, {
                document: { url: tempFilePath },
                mimetype: 'video/mp4',
                fileName: fileName,
                caption: `🎬 *${session.movieTitle}*\n\n> *⚡ Powered by ApEx MINI*`
            }, { quoted: mek });

            // Clean up: Delete Temp File from Disk
            if (fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }

            // Clear User Session after successful download
            delete global.cinesubzSession[sender];
            await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
        }

    } catch (e) {
        console.log(e);
        reply(`*Error:* ${e.message}`);
    }
});

