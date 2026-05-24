const config = require('../config')
const { cmd, commands } = require('../command')
const axios = require("axios");
const fs = require("fs");
const os = require("os");
const path = require("path");
const yts = require("yt-search");

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
            return await reply(
                "❌ *ꜰᴏʀᴍᴀᴛ:* `.ᴄꜱᴏɴɢ <ᴊɪᴅ> <ꜱᴏɴɢ ɴᴀᴍᴇ>`\n\n*ᴇxᴀᴍᴘʟᴇ:* `.ᴄꜱᴏɴɢ 123456789012345@newsletter ꜱᴏɴɢ ɴᴀᴍᴇ`"
            );
        }

        if (!targetJid.includes('@')) {
            return await reply(
                "❌ *ᴘʟᴇᴀꜱᴇ ꜱᴇɴᴅ ᴀ ᴄᴏʀʀᴇᴄᴛ ᴊɪᴅ.*\n*(ᴇx: 123456...789@newsletter & ...@g.us)*"
            );
        }

        await reply("🔎 *Searching song...*");

        const search = await yts(query);

        if (!search?.videos?.length) {
            return await reply("❌ *Song not found!*");
        }

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

        const tempMp3 = path.join(
            os.tmpdir(),
            `csong_${Date.now()}.mp3`
        );

        const mp3Res = await axios.get(mp3Url, {
            responseType: "arraybuffer"
        });

        fs.writeFileSync(
            tempMp3,
            Buffer.from(mp3Res.data)
        );

        if (!fs.existsSync(tempMp3)) {
            return await reply("❌ *MP3 file create failed!*");
        }

        let channelname = targetJid;

        try {

            const metadata = await conn.newsletterMetadata(
                "jid",
                targetJid
            );

            if (metadata?.name) {
                channelname = metadata.name;
            }

        } catch (err) {}

        const caption = `\`\`\`The song was uploaded by the owner:Gavishka Manidu 😘🇱🇰\`\`\`

*📃 Title:* ${result.title}

❒ *🎭 Views :* ${data.views}
❒ *⏱️ Duration :* ${data.timestamp}
❒ *📅 Release Date :* ${data.ago}

*00:00 ─❍────── ${data.timestamp}*

\`⇄   ◃◃   ⅠⅠ   ▹▹   ↻\`

*⊷ හිතෙ තියෙන සස්සන රිඇක්‍ට් එක ඕනී ලමයෝ 🥺💖🫶*

> _ᴍɪɴᴅ ʀᴇʟᴀx ꜱᴏɴɢ 💆‍♂️🎶_

*Use headphones for best experience 🎧*

> *${channelname}*`;

        try {

            console.log(`📤 Sending image to: ${targetJid}`);

            await conn.sendMessage(targetJid, {
                image: { url: data.thumbnail },
                caption: caption
            });

        } catch (err) {

            console.error("❌ Image Send Error:", err);

        }

        try {

            console.log(`📤 Sending audio to: ${targetJid}`);

            await conn.sendMessage(targetJid, {

                audio: fs.readFileSync(tempMp3),

                mimetype: "audio/mpeg",

                ptt: false,

                fileName: `${result.title}.mp3`

            });

            await reply(
                `✅ *${result.title}* ꜱᴜᴄᴄᴇꜱꜱꜰᴜʟʟʏ ꜱᴇɴᴅ ᴛᴏ *${channelname}* 🌝💗`
            );

        } catch (err) {

            console.error("❌ Audio Send Error:", err);

            await reply(
                `*ᴀᴜᴅɪᴏ ꜱᴇɴᴅɪɴɢ ᴇʀʀᴏʀ ❌*\n\n\`\`\`${err.message || err}\`\`\``
            );

        }

        if (fs.existsSync(tempMp3)) {
            fs.unlinkSync(tempMp3);
        }

    } catch (e) {

        console.error("CSong Fatal Error:", e);

        await reply(
            `*ᴇʀʀᴏʀ ᴛʀʏ ᴀɢᴀɪɴ ❌*\n\n\`\`\`${e.message}\`\`\``
        );

    }

})
