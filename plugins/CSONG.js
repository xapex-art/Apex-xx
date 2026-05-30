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

        // --- Aluth API eka saha Base Key eka ---
        const apiKey = "284e6933252b4206577bbc5f78bac1dd";
        const api = `https://apis.sadas.dev/api/v1/download/youtube?q=${encodeURIComponent(ytUrl)}&format=mp3&apiKey=${apiKey}`;  
        const { data: apiRes } = await axios.get(api);  

        // API structure eka wenas unath error nathiwa wada karanna hadala thiyenawa
        const result = apiRes?.result || apiRes?.data || apiRes;
        const mp3Url = result?.downloadUrl || result?.url || result?.download;

        if (!mp3Url) {  
            console.log("API Error Response:", apiRes);  
            return await reply("❌ *ගීතය බාගත කළ නොහැක!*");  
        }  

        // Title eka API eken awe naththam yt-search eken gannawa
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

        let channelname = targetJid;  
        try {  
            const metadata = await conn.newsletterMetadata("jid", targetJid);  
            if (metadata?.name) {  
                channelname = metadata.name;  
            }  
        } catch (err) {  
            // console.error("Newsletter metadata error:", err);  
        }  

                // --- CUSTOM CAPTION EKA GANA KOTASA ---
        let finalCaptionText = `*${result.title}*
📅 Rᴇʟᴇᴀꜱᴇ Dᴀᴛᴇ : ${data.ago}
⏱️ Dᴜʀᴀᴛɪᴏɴ : ${data.timestamp}
🎭 Vɪᴇᴡꜱ : ${data.views}
.ılılılllıılılıllllıılılllıllıılılllıllıılıll.
> ${channelname}`; // Meka default caption eka

        const captionFilePath = path.join(__dirname, 'csong_caption.json');
        
        try {
            if (fs.existsSync(captionFilePath)) {
                const savedData = JSON.parse(fs.readFileSync(captionFilePath));
                if (savedData.caption) {
                    finalCaptionText = savedData.caption
                        .replace(/{title}/g, result.title || data.title)
                        .replace(/{views}/g, data.views)
                        .replace(/{duration}/g, data.timestamp)
                        .replace(/{ago}/g, data.ago);
                }
            }
        } catch (err) {
            console.log("Caption read error:", err);
        }
        // --------------------------------------

        try {  
            console.log(`📤 Sending image & caption to: ${targetJid}`);  
            await conn.sendMessage(targetJid, {  
                image: { url: data.thumbnail },  
                caption: finalCaptionText, // <-- Methanata finalCaptionText danna
            });  
        } catch (err) {  
            console.error("❌ Thumbnail Send Error:", err);  
            await reply(`*Image යැවීමේදී දෝෂයක්!* \n\n\`\`\`${err.message || err}\`\`\``);  
        }  
  

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

    } catch (e) {  
        console.error("CSong Fatal Error:", e);  
        await reply(`*ඇතැම් දෝෂයකි! පසුව නැවත උත්සහ කරන්න.*\n\n\`\`\`${e.message}\`\`\``);  
    }
});

const fs = require("fs");
const path = require("path");

const captionFile = path.join(__dirname, 'csong_caption.json');

cmd({
    pattern: "setcsong",
    desc: "Set custom caption for csong",
    category: "owner",
    filename: __filename
},
async (conn, mek, m, { args, reply, isOwner }) => {
    if (!isOwner) return await reply("🚫 *Owner only command!*");
    
    const newCaption = args.join(" ");
    if (!newCaption) {
        return await reply(`❌ *Caption එකක් ලබා දෙන්න.*\n\n*උදාහරණ:* \n.setcsong > ꜱᴏɴɢ ᴜᴘʟᴏᴀᴅᴇᴅ ʙʏ ᴛʜᴇ ᴏᴡɴᴇʀ\n\n☘️ Title: {title}\n❐ 🚀 Vɪᴇᴡꜱ : {views}\n❐ ⏱️ Dᴜʀᴀᴛɪᴏɴ : {duration}\n❐ 📅 Rᴇʟᴇᴀꜱᴇ Dᴀᴛᴇ : {ago}`);
    }

    try {
        fs.writeFileSync(captionFile, JSON.stringify({ caption: newCaption }));
        await reply("✅ *Custom Caption එක සාර්ථකව Save කළා! මින් ඉදිරියට ගීත යවද්දී මේ Caption එක යාවි.*");
    } catch (e) {
        console.error("Caption Save Error:", e);
        await reply("❌ *Caption එක Save කිරීමේදී දෝෂයක්!*");
    }
});


