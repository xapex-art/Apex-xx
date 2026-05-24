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
}, async (conn, mek, m, { from, args, reply, isOwner }) => {
    try {

        if (!isOwner) {
            return await reply("🚫 *ᴏᴡɴᴇʀ ᴏɴʟʏ ᴄᴏᴍᴍᴀɴᴅ*");
        }

        const targetJid = args[0];
        const query = args.slice(1).join(" ");

        if (!targetJid || !query) {
            return await reply("❌ *ꜰᴏʀᴍᴀᴛ:* `.csong <jid> <song name>`\n\n*ᴇxᴀᴍᴘʟᴇ:* `.csong 123456789012345@newsletter song name`");
        }

        if (!targetJid.includes('@')) {
            return await reply("❌ *ᴘʟᴇᴀꜱᴇ ꜱᴇɴᴅ ᴀ ᴄᴏʀʀᴇᴄᴛ ᴊɪᴅ.*\n*(ᴇx: 123456...789@newsletter & ...@g.us)*");
        }

        const isChannel = targetJid.endsWith('@newsletter');

        // ── Search YouTube ──────────────────────────────────────────────────────
        const search = await yts(query);
        if (!search?.videos?.length) return await reply("❌ *ගීතය හමුනොවුණා!*");

        const data = search.videos[0];
        const ytUrl = data.url;
        console.log("🎬 YouTube:", ytUrl);

        // ── Download from API ───────────────────────────────────────────────────
        const api = `https://www.movanest.xyz/v2/ytmp3?url=${encodeURIComponent(ytUrl)}`;
        const { data: apiRes } = await axios.get(api);

        if (!apiRes?.status || !apiRes?.result?.downloadUrl) {
            console.log("API Error Response:", apiRes);
            return await reply("*ᴀᴘɪ ᴇʀʀᴏʀ ❌*");
        }

        const result = apiRes.result;
        const mp3Url = result.downloadUrl;
        console.log("🎧 Download URL:", mp3Url);

        // ── Download MP3 to temp ────────────────────────────────────────────────
        const ts = Date.now();
        const tempMp3 = path.join(os.tmpdir(), `csong_${ts}.mp3`);
        const tempOpus = path.join(os.tmpdir(), `csong_${ts}.opus`);

        const mp3Res = await axios.get(mp3Url, { responseType: "arraybuffer" });
        fs.writeFileSync(tempMp3, Buffer.from(mp3Res.data));

        if (!fs.existsSync(tempMp3)) return await reply("❌ *MP3 ගොනුව සාදන ලදි නැහැ!*");

        // ── Convert MP3 → Opus (required for WA audio) ─────────────────────────
        let opusReady = false;
        try {
            await new Promise((resolve, reject) => {
                ffmpeg(tempMp3)
                    .audioCodec("libopus")
                    .audioFrequency(48000)
                    .audioChannels(2)
                    .audioBitrate("128k")
                    .format("opus")
                    .on("end", () => {
                        if (fs.existsSync(tempOpus)) { opusReady = true; resolve(); }
                        else reject(new Error("No opus file"));
                    })
                    .on("error", reject)
                    .save(tempOpus);
            });
        } catch (err) {
            console.warn("⚠️ Opus failed, using MP3:", err.message);
        }

        // ── Get channel name ────────────────────────────────────────────────────
        let channelname = targetJid;
        try {
            const metadata = await conn.newsletterMetadata("jid", targetJid);
            if (metadata?.name) channelname = metadata.name;
        } catch (_) {}

        // ── Caption ─────────────────────────────────────────────────────────────
        const caption = `\`\`\`The song was uploaded by the owner: Gavishka Manidu 😘🇱🇰\`\`\`

*📃 Title: " ${result.title} "*

❒ *🎭 Vɪᴇᴡꜱ :* ${data.views}
❒ *⏱️ Dᴜʀᴀᴛɪᴏɴ :* ${data.timestamp}
❒ *📅 Rᴇʟᴇᴀꜱᴇ Dᴀᴛᴇ :* ${data.ago}

‎*00.00 ─〇─────  ${data.timestamp} ⏳*

\`⇄   ◃◃   ⅠⅠ   ▹▹   ↻\`
‎
*⊷ ‎හිතෙ තියෙන සස්සන රිඇක්‍ට් එක ඕනී ලමයෝ 🥺💖🫶*
‎
> _ᴍᴀɪɴᴅ ʀᴇʟᴀx ꜱᴏɴɢ 💆‍♂️🎶_
‎
*‎ Use headphones for best experience 🎧*

> *${channelname}*`;

        // ── Send thumbnail image ─────────────────────────────────────────────────
        try {
            if (isChannel) {
                await conn.newsletterSendMessage(targetJid, {
                    image: { url: data.thumbnail },
                    caption: caption,
                });
            } else {
                await conn.sendMessage(targetJid, {
                    image: { url: data.thumbnail },
                    caption: caption,
                });
            }
        } catch (err) {
            console.error("❌ Image Send Error:", err);
            await reply(`*ɪᴍᴀɢᴇ ꜱᴇɴᴅɪɴɢ ᴇʀʀᴏʀ ❌*\n\n\`\`\`${err.message || err}\`\`\``);
        }

        // ── Send Audio ───────────────────────────────────────────────────────────
        try {
            const audioBuffer = opusReady && fs.existsSync(tempOpus)
                ? fs.readFileSync(tempOpus)
                : fs.readFileSync(tempMp3);

            const mimetype = opusReady
                ? "audio/ogg; codecs=opus"
                : "audio/mpeg";

            if (isChannel) {
                // ✅ Channel ekata newsletterSendMessage use karanna ONLY
                await conn.newsletterSendMessage(targetJid, {
                    audio: audioBuffer,
                    mimetype: mimetype,
                    ptt: false,
                });
            } else {
                // Groups / DM
                await conn.sendMessage(targetJid, {
                    audio: audioBuffer,
                    mimetype: mimetype,
                    ptt: false,
                });
            }

            await reply(`✅ *${result.title}* ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ ꜱᴇɴᴅ ᴛᴏ *${channelname}* 🌝💗`);

        } catch (err) {
            console.error("❌ Audio Send Error:", err);
            await reply(`*ᴀᴜᴅɪᴏ ꜱᴇɴᴅɪɴɢ ᴇʀʀᴏʀ ❌*\n\n\`\`\`${err.message || err}\`\`\``);
        }

        // ── Cleanup ──────────────────────────────────────────────────────────────
        if (fs.existsSync(tempMp3)) fs.unlinkSync(tempMp3);
        if (fs.existsSync(tempOpus)) fs.unlinkSync(tempOpus);

    } catch (e) {
        console.error("CSong Fatal Error:", e);
        await reply(`*ᴇʀʀᴏʀ ᴛʀʏ ᴀɢᴀɪɴ ❌*\n\n\`\`\`${e.message}\`\`\``);
    }
})

