const axios = require("axios");
const fs = require("fs");
const os = require("os");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const yts = require("yt-search");
const { cmd, commands } = require('../command');

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

cmd({
    pattern: "csong",  
    alias: ["csend"],  
    react: "🎧",  
    desc: "Download and send a song to a specific JID/Channel",  
    category: "owner",  
    use: ".csong <jid> <song name>",  
    filename: __filename
},
async (conn, mek, m, { from, args, reply, isOwner }) => {
    try {  

        const targetJid = args[0];  
        const query = args.slice(1).join(" ");  

        if (!targetJid || !query) {  
            return await reply("❌ *Format:* `.csong <jid> <song name>`\n\n*උදාහරණ:* `.csong 123456789012345@newsletter ගීතයේ නම`");  
        }  

        if (!targetJid.includes('@')) {  
            return await reply("❌ *කරුණාකර නිවැරදි JID එකක් ලබා දෙන්න.*\n*(උදා: 123456...789@newsletter හෝ ...@g.us)*");  
        }  

        const search = await yts(query);  
        if (!search?.videos?.length) return await reply("❌ *ගීතය හමුනොවුණා!*");  

        const data = search.videos[0];  
        const ytUrl = data.url;  
        console.log("🎬 YouTube:", ytUrl);  

        let channelname = targetJid;  
        try {  
            const metadata = await conn.newsletterMetadata("jid", targetJid);  
            if (metadata?.name) {  
                channelname = metadata.name;  
            }  
        } catch (err) {  
            // console.error("Newsletter metadata error:", err);  
        }  

        // --- OPTION SELECTION CARD ---
        const choiceText = `\`🎵 *CSONG SEND MANAGER*\`\n\n` +
            `\`Tɪᴛʟᴇ :\` ${data.title}\n` +
            `\`Dᴜʀᴀᴛɪᴏɴ :\` ${data.timestamp}\n` +
            `\`Tᴀʀɢᴇᴛ:\` ${channelname}\n\n` +
            `🌈 *කරුණාකර (Reply) අංකය ලබාදෙන්න:* \n\n` +
            `\`1️⃣ Wɪᴛʜ Cᴀᴘᴛɪᴏɴ\` (Tʜᴜʙɴᴀɪʟ + Cᴀᴘᴛɪᴏɴ + Aᴜᴅɪᴏ)\n` +
            `\`2️⃣ Nᴏ Cᴀᴘᴛɪᴏɴ\` (Aᴜᴅɪᴏ Oɴʟʏ)`;

        // Option Menu එක Image එකත් එක්කම යැවීම
        const sentMsg = await conn.sendMessage(from, { 
            image: { url: data.thumbnail }, 
            caption: choiceText 
        }, { quoted: mek });

        // Listener to capture user's reply number
        const messageListener = async (update) => {
            try {
                if (!update.messages || !update.messages[0]) return;
                const msg = update.messages[0];
                if (!msg.message) return;

                const type = Object.keys(msg.message)[0];
                const contextInfo = msg.message[type]?.contextInfo;
                const quotedMsgId = contextInfo?.stanzaId;
                const sender = msg.key.participant || msg.key.remoteJid;
                const originalSender = mek.key.participant || mek.key.remoteJid;

                // Check if the reply is for our option card and from the correct user
                if (quotedMsgId === sentMsg.key.id && sender === originalSender) {
                    const userChoice = (msg.message.conversation || msg.message.extendedTextMessage?.text || "").trim();

                    if (userChoice === "1" || userChoice === "2") {
                        // Unregister listener and clear timeout
                        conn.ev.off("messages.upsert", messageListener);
                        clearTimeout(choiceTimeout);

                        await reply(`⏳ *Processing Option ${userChoice}... Please wait!*`);

                        // --- Aluth API eka saha Base Key eka ---
                        const apiKey = "ec6c9505fa330141f4b3f458a9c72158";
                        const api = `https://apis.sadas.dev/api/v1/download/youtube?q=${encodeURIComponent(ytUrl)}&format=mp3&apiKey=${apiKey}`;  
                        const { data: apiRes } = await axios.get(api);  

                        const result = apiRes?.result || apiRes?.data || apiRes;
                        const mp3Url = result?.downloadUrl || result?.url || result?.download;

                        if (!mp3Url) {  
                            console.log("API Error Response:", apiRes);  
                            return await reply("❌ *ගීතය බාගත කළ නොහැක!*");  
                        }  

                        if (!result.title) result.title = data.title;

                        console.log("🎧 Download URL:", mp3Url);  

                        const tempMp3 = path.join(os.tmpdir(), `csong_temp_${Date.now()}.mp3`);  
                        const tempOpus = path.join(os.tmpdir(), `csong_temp_${Date.now()}.opus`);  

                        const mp3Res = await axios.get(mp3Url, { responseType: "arraybuffer" });  
                        fs.writeFileSync(tempMp3, Buffer.from(mp3Res.data));  

                        if (!fs.existsSync(tempMp3)) return await reply("❌ *MP3 ගොනුව සාදන ලදි නැහැ!*");  

                        let opusReady = false;  
                        try {  
                            await new Promise((resolve, reject) => {  
                                ffmpeg(tempMp3)  
                                    .audioCodec("libopus")  
                                    .format("opus")  
                                    .on("end", () => {  
                                        if (fs.existsSync(tempOpus)) {  
                                            opusReady = true;  
                                            resolve();  
                                        } else reject(new Error("No opus file created"));  
                                    })  
                                    .on("error", (err) => {  
                                        console.error("❌ FFmpeg Error:", err.message);  
                                        reject(err);  
                                    })  
                                    .save(tempOpus);  
                            });  
                        } catch (err) {  
                            console.warn("⚠️ Opus conversion failed. Fallback to MP3.");  
                        }  

                        // --- SEND IMAGE & CAPTION ONLY IF OPTION 1 IS SELECTED ---
                        if (userChoice === "1") {
                            let finalCaptionText = `> ꜱᴏɴɢ ᴜᴘʟᴏᴀᴅᴇᴅ ʙʏ ᴛʜᴇ ᴏᴡɴᴇʀ : Gavishka Manidu

*☘️🎶 Title: ${result.title}*

❐ *🎭 Vɪᴇᴡꜱ : ${data.views}*
❐ *⏱️ Dᴜʀᴀᴛɪᴏɴ : ${data.timestamp}*
❐ *📅 Rᴇʟᴇᴀꜱᴇ Dᴀᴛᴇ : ${data.ago}*

*0:00 ─〇───── ${data.timestamp} ⏳*

*• නිහතමානී රියැක්ට් එකක් ඕනී ❤️😘🍃*

\`ඔයා ආසම සින්දු අහන්න චැනල් එකෙ දිගටම ඉන්න 💖🍃😉\`
‎
*_Mind Relax Song Use headphones for_*
*_best experience 🎧🙇_*`;

                            const captionFilePath = path.join(__dirname, 'csong_caption.json');
                            
                            try {
                                if (fs.existsSync(captionFilePath)) {
                                    const savedData = JSON.parse(fs.readFileSync(captionFilePath, 'utf-8'));
                                    // කමාන්ඩ් එක පාවිච්චි කරන යූසර්ට (originalSender) අදාළව Caption එකක් තියෙනවද බලනවා
                                    if (savedData && savedData[originalSender]) {
                                        finalCaptionText = savedData[originalSender]
                                            .replace(/{title}/g, result.title || data.title)
                                            .replace(/{views}/g, data.views)
                                            .replace(/{duration}/g, data.timestamp)
                                            .replace(/{ago}/g, data.ago)
                                            .replace(/{channelname}/g, channelname);
                                    }
                                }
                            } catch (err) {
                                console.log("Caption read error:", err);
                            }

                            try {  
                                console.log(`📤 Sending image & caption to: ${targetJid}`);  
                                await conn.sendMessage(targetJid, {  
                                    image: { url: data.thumbnail },  
                                    caption: finalCaptionText, 
                                });  
                            } catch (err) {  
                                console.error("❌ Thumbnail Send Error:", err);  
                                await reply(`*Image යැවීමේදී දෝෂයක්!* \n\n\`\`\`${err.message || err}\`\`\``);  
                            }  
                        }  

                        // --- AUDIO SENDING (FOR BOTH OPTIONS) ---
                        try {  
                            console.log(`📤 Sending Audio to: ${targetJid}`);  
                            if (opusReady && fs.existsSync(tempOpus)) {  
                                const opusBuffer = fs.readFileSync(tempOpus);  
                                await conn.sendMessage(targetJid, {  
                                    audio: opusBuffer,  
                                    mimetype: "audio/ogg; codecs=opus",  
                                    ptt: false,   
                                });  
                            } else {  
                                await conn.sendMessage(targetJid, {  
                                    audio: fs.readFileSync(tempMp3),  
                                    mimetype: "audio/mpeg",  
                                    ptt: false,  
                                });  
                            }  
                            await reply(`✅ *${result.title}* successfully sent to *${channelname}* 😎🎶`);  
                        } catch (err) {  
                            console.error("❌ Audio Send Error:", err);  
                            await reply(`*Audio යැවීමේදී දෝෂයක්!* \n\n\`\`\`${err.message || err}\`\`\``);  
                        }  

                        if (fs.existsSync(tempMp3)) fs.unlinkSync(tempMp3);  
                        if (fs.existsSync(tempOpus)) fs.unlinkSync(tempOpus);  
                    }
                }
            } catch (err) {
                console.error("Error in selection listener:", err);
            }
        };

        // 2 Minutes timeout if user does not reply to the card
        const choiceTimeout = setTimeout(() => {
            conn.ev.off("messages.upsert", messageListener);
            reply("❌ *කාලය ඉකුත් විය! කරුණාකර නැවත උත්සාහ කරන්න.*");
        }, 120000);

        conn.ev.on("messages.upsert", messageListener);

    } catch (e) {  
        console.error("CSong Fatal Error:", e);  
        await reply(`*ඇතැම් දෝෂයකි! පසුව නැවත උත්සහ කරන්න.*\n\n\`\`\`${e.message}\`\`\``);  
    }
});

cmd({
    pattern: "setcsong",
    desc: "Set custom caption for csong (Per-User)",
    category: "owner",
    filename: __filename
},
async (conn, mek, m, { args, reply, isOwner }) => {
    
    const newCaption = args.join(" ");
    if (!newCaption) {
        return await reply(`❌ *Caption එකක් ලබා දෙන්න.*\n\n*උදාහරණ:* \n.setcsong Title: {title}\nVɪᴇᴡꜱ : {views}\nDᴜʀᴀᴛɪᴏɴ : {duration}\n Rᴇʟᴇᴀꜱᴇ Dᴀᴛᴇ : {ago}`);
    }

    try {
        const sender = mek.key.participant || mek.key.remoteJid; // කමාන්ඩ් එක දාපු යූසර්ව හඳුනා ගැනීම
        const captionFile = path.join(__dirname, 'csong_caption.json');
        
        let savedData = {};
        if (fs.existsSync(captionFile)) {
            try {
                const fileContent = fs.readFileSync(captionFile, 'utf-8');
                savedData = fileContent ? JSON.parse(fileContent) : {};
            } catch (e) {
                savedData = {};
            }
        }

        // යූසර්ගේ JID එක යටතේ විතරක් Caption එක සේව් කරනවා
        savedData[sender] = newCaption;
        
        fs.writeFileSync(captionFile, JSON.stringify(savedData, null, 2));
        await reply("✅ *Custom Caption එක සාර්ථකව Save කළා!*");
    } catch (e) {
        console.error("Caption Save Error:", e);
        await reply(`❌ *Caption එක Save කිරීමේදී දෝෂයක්!* \n\n\`\`\`${e.message}\`\`\``);
    }
});

