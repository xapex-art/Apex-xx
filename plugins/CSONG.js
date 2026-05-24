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
        const tempM4a = path.join(os.tmpdir(), `csong_temp_${Date.now()}.m4a`);

        // Download MP3
        const mp3Res = await axios.get(mp3Url, { responseType: "arraybuffer" });
        fs.writeFileSync(tempMp3, Buffer.from(mp3Res.data));

        if (!fs.existsSync(tempMp3)) return await reply("❌ *MP3 ගොනුව සාදන ලදි නැහැ!*");

        // ─── Convert to M4A (AAC) - works best for channels ───────────────────
        let m4aReady = false;
        try {
            await new Promise((resolve, reject) => {
                ffmpeg(tempMp3)
                    .audioCodec("aac")
                    .audioBitrate("128k")
                    .format("ipod") // m4a container
                    .on("end", () => {
                        if (fs.existsSync(tempM4a)) {
                            m4aReady = true;
                            resolve();
                        } else reject(new Error("No m4a file created"));
                    })
                    .on("error", (err) => {
                        console.error("❌ FFmpeg M4A Error:", err.message);
                        reject(err);
                    })
                    .save(tempM4a);
            });
        } catch (err) {
            console.warn("⚠️ M4A conversion failed. Will use MP3 fallback.");
        }

        // ─── Get channel name ───────────────────────────────────────────────────
        let channelname = targetJid;
        try {
            const metadata = await conn.newsletterMetadata("jid", targetJid);
            if (metadata?.name) channelname = metadata.name;
        } catch (_) {}

        // ─── Caption ────────────────────────────────────────────────────────────
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

        // ─── Send thumbnail + caption ───────────────────────────────────────────
        try {
            console.log(`📤 Sending image & caption to: ${targetJid}`);
            await conn.sendMessage(targetJid, {
                image: { url: data.thumbnail },
                caption: caption,
            });
        } catch (err) {
            console.error("❌ Thumbnail Send Error:", err);
            await reply(`*ɪᴍᴀɢᴇ ꜱᴇɴᴅɪɴɢ ᴇʀʀᴏʀ ❌*\n\n\`\`\`${err.message || err}\`\`\``);
        }

        // ─── Send Audio ─────────────────────────────────────────────────────────
        // For channels (@newsletter): use audio/mp4 mimetype (NOT ogg/opus, NOT ptt)
        // For groups/DMs: can use ptt or audio/mpeg
        try {
            console.log(`📤 Sending Audio to: ${targetJid}`);

            if (isChannel) {
                // ── Channel: send as audio document (mp4/aac works best) ──────
                const audioBuffer = m4aReady && fs.existsSync(tempM4a)
                    ? fs.readFileSync(tempM4a)
                    : fs.readFileSync(tempMp3);

                const mimetype = m4aReady ? "audio/mp4" : "audio/mpeg";

                await conn.sendMessage(targetJid, {
                    audio: audioBuffer,
                    mimetype: mimetype,
                    ptt: false,
                    fileName: `${result.title}.${m4aReady ? 'm4a' : 'mp3'}`,
                });

            } else {
                // ── Group / DM: send as voice or audio ───────────────────────
                if (m4aReady && fs.existsSync(tempM4a)) {
                    await conn.sendMessage(targetJid, {
                        audio: fs.readFileSync(tempM4a),
                        mimetype: "audio/mp4",
                        ptt: false,
                        fileName: `${result.title}.m4a`,
                    });
                } else {
                    await conn.sendMessage(targetJid, {
                        audio: fs.readFileSync(tempMp3),
                        mimetype: "audio/mpeg",
                        ptt: false,
                        fileName: `${result.title}.mp3`,
                    });
                }
            }

            await reply(`✅ *${result.title}* ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ ꜱᴇɴᴅ ᴛᴏ *${channelname}* 🌝💗`);

        } catch (err) {
            console.error("❌ Audio Send Error:", err);
            await reply(`*ᴀᴜᴅɪᴏ ꜱᴇɴᴅɪɴɢ ᴇʀʀᴏʀ ❌*\n\n\`\`\`${err.message || err}\`\`\``);
        }

        // ─── Cleanup ─────────────────────────────────────────────────────────────
        if (fs.existsSync(tempMp3)) fs.unlinkSync(tempMp3);
        if (fs.existsSync(tempM4a)) fs.unlinkSync(tempM4a);

    } catch (e) {
        console.error("CSong Fatal Error:", e);
        await reply(`*ᴇʀʀᴏʀ ᴛʀʏ ᴀɢᴀɪɴ ❌*\n\n\`\`\`${e.message}\`\`\``);
    }
})
