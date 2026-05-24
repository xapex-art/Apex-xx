const config = require('../config')
const { cmd, commands } = require('../command')
const axios = require("axios");
const fs = require("fs");
const os = require("os");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const yts = require("yt-search");

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

        if (!isOwner) {
            return await reply("🚫 *ᴏᴡɴᴇʀ ᴏɴʟʏ ᴄᴏᴍᴍᴀɴᴅ*");
        }

        const targetJid = args[0];
        const query = args.slice(1).join(" ");

        if (!targetJid || !query) {
            return await reply("❌ *ꜰᴏʀᴍᴀᴛ:* `.ᴄꜱᴏɴɢ <ᴊɪᴅ> <ꜱᴏɴɢ ɴᴀᴍᴇ>`\n\n*ᴇxᴀᴍᴘʟᴇ:* `.ᴄꜱᴏɴɢ 123456789012345@newsletter ꜱᴏɴɢ ɴᴀᴍᴇ`");
        }


        if (!targetJid.includes('@')) {
            return await reply("❌ *ᴘʟᴇᴀꜱᴇ ꜱᴇɴᴅ ᴀ ᴄᴏʀʀᴇᴄᴛ ᴊɪᴅ.*\n*(ᴇx: 123456...789@newsletter & ...@g.us)*");
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
            return await reply("*ᴀᴘɪ ᴇʀʀᴏʀ ❌*");
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

        const caption = `_The song was uploaded by the owner:Gavishka Manidu  ☘️💕_

*📃 Title: “ ${result.title} ”*
	
❒ *🎭 Vɪᴇᴡꜱ :* ${data.views}
❒ *⏱️ Dᴜʀᴀᴛɪᴏɴ :* ${data.timestamp}
❒ *📅 Rᴇʟᴇᴀꜱᴇ Dᴀᴛᴇ :*${data.ago} 

‎*00.00 ─〇─────  {data.timestamp} ⏳*

 ‎```🍃🌈volυмe : ▁▂▃▄▅▆▇▉```
      ‎    ‎ `⇄   ◃◃   ⅠⅠ   ▹▹   ↻`
‎
*⊷ ‎හිතෙ තියෙන සස්සන රිඇක්‍ට් එක ඕනී ලමයෝ 🥺💖🫶*
‎
> _ᴍᴀɪɴᴅ ʀᴇʟᴀx ꜱᴏɴɢ 💆‍♂️🎶_
‎
‎ ```Use headphones for best experience 🎧```

> *{channelname}*`;


        try {
            console.log(`📤 Sending image & caption to: ${targetJid}`);
            await conn.sendMessage(targetJid, {
                image: { url: data.thumbnail },
                caption: caption,
            });
        } catch (err) {
            console.error("❌ Thumbnail Send Error:", err);
            await reply(`*ɪᴍᴀɢᴇ ꜱᴇɴᴅɪɴɢ ᴇʀʀᴏʀ ❌* \n\n\`\`\`${err.message || err}\`\`\``);
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
            await reply(`✅ *${result.title}* ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ ꜱᴇɴᴅ ᴛᴏ *${channelname}* 🌝💗`);
        } catch (err) {
            console.error("❌ Audio Send Error:", err);
            await reply(`*ᴀᴜᴅɪᴏ ꜱᴇɴᴅɪɴɢ ᴇʀʀᴏʀ ❌* \n\n\`\`\`${err.message || err}\`\`\``);
        }


        if (fs.existsSync(tempMp3)) fs.unlinkSync(tempMp3);
        if (fs.existsSync(tempOpus)) fs.unlinkSync(tempOpus);

    } catch (e) {
        console.error("CSong Fatal Error:", e);
        await reply(`*ᴇʀʀᴏʀ ᴛʀʏ ᴀɢᴀɪɴ ❌*\n\n\`\`\`${e.message}\`\`\``);
    }
})

