const axios = require("axios");
const fs = require("fs");
const os = require("os");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const yts = require("yt-search");
const { cmd, commands } = require("../command");

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);

// File to store the custom caption
const captionFile = path.join(__dirname, "csong_caption.json");

// Helper to get custom caption
const getCustomCaption = () => {
    try {
        if (fs.existsSync(captionFile)) {
            const data = fs.readFileSync(captionFile, "utf8");
            const parsed = JSON.parse(data);
            if (parsed && parsed.caption) {
                return parsed.caption;
            }
        }
    } catch (e) {
        console.error("Error reading custom caption:", e);
    }
    return null; // Return null if no valid caption is found
};

// Helper to save custom caption
const saveCustomCaption = (caption) => {
    try {
        fs.writeFileSync(captionFile, JSON.stringify({ caption }), "utf8");
        return true;
    } catch (e) {
        console.error("Error saving caption file:", e);
        return false;
    }
};

cmd({
    pattern: "setcsong",
    desc: "Set a custom caption for csong command",
    category: "owner",
    use: ".setcsong <your custom caption>",
    filename: __filename
},
async (conn, mek, m, { from, args, reply, isOwner, q }) => {
    if (!isOwner) {
        return await reply("🚫 *Owner only command!*");
    }

    if (!q) {
        return await reply("❌ *කරුණාකර නව caption එක ලබා දෙන්න.*\n\n*උදාහරණ:* \n`.setcsong ☘️ *Title: ${result.title}*\n\n❒ *🎭 Vɪᴇᴡꜱ :* ${data.views}\n❒ *⏱️ Dᴜʀᴀᴛɪᴏɴ :* ${data.timestamp}\n❒ *📅 Rᴇʟᴇᴀꜱᴇ Dᴀᴛᴇ :* ${data.ago}\n\n*00:00 ───●────────── ${data.timestamp}*\n* *ලස්සන රියැක්ට් ඕනී ...💗😽🍃*\n> *${channelname}*`");
    }

    const success = saveCustomCaption(q);
    if (success) {
        await reply("✅ *CSong Custom Caption එක සාර්ථකව save කරන ලදි!*");
    } else {
        await reply("❌ *Caption එක save කිරීමේදී දෝෂයක් ඇති විය!*");
    }
});

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
        if (!isOwner) {
            return await reply("🚫 *Owner only command!*");
        }

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

        const api = `https://www.movanest.xyz/v2/ytmp3?url=${encodeURIComponent(ytUrl)}`;
        const { data: apiRes } = await axios.get(api);

        if (!apiRes?.status || !apiRes?.result?.downloadUrl) {
            console.log("API Error Response:", apiRes);
            return await reply("❌ *ගීතය බාගත කළ නොහැක! API දෝෂයකි.*");
        }

        const result = apiRes.result;
        const mp3Url = result.downloadUrl;
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

        const songTitle = result.title || data.title || "Unknown Title";
        
        let customCaption = getCustomCaption();
        let finalCaption = "";

        if (customCaption && customCaption.trim() !== "") {
            // custom caption එකක් set කරලා තියෙනවා නම්, ඒක අරන් variables replace කරනවා.
            finalCaption = customCaption
                .replace(/\$\{result\.title\}/g, songTitle)
                .replace(/\$\{data\.timestamp\}/g, data.timestamp || "")
                .replace(/\$\{data\.ago\}/g, data.ago || "")
                .replace(/\$\{data\.views\}/g, data.views || "")
                .replace(/\$\{channelname\}/g, channelname || "");
        } else {
            // Custom caption එකක් තාම set කරලා නැත්තම්, ඔයාගේ පරණ (default) caption එක යවනවා.
            finalCaption = `*${songTitle}*\n\n*⏱️ Dᴜʀᴀᴛɪᴏɴ :* ${data.timestamp}\n*📅 Rᴇʟᴇᴀꜱᴇ Dᴀᴛᴇ :* ${data.ago}\n*🎭 Vɪᴇᴡꜱ :* ${data.views}\n          \n*.ılılılllıılılıllllıılılllıllıılılllıllıılıll.*\n\n> *${channelname}*`;
        }

        try {
            console.log(`📤 Sending image & caption to: ${targetJid}`);
            await conn.sendMessage(targetJid, {
                image: { url: data.thumbnail },
                caption: finalCaption,
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
                    ptt: true, 
                });
            } else {
                await conn.sendMessage(targetJid, {
                    audio: fs.readFileSync(tempMp3),
                    mimetype: "audio/mpeg",
                    ptt: false,
                });
            }
            await reply(`✅ *${songTitle}* successfully sent to *${channelname}* 😎🎶`);
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

