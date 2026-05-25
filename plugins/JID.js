const { cmd } = require('../command');

cmd({
    pattern: "jid",
    desc: "Get JID from user, group, channel, or number.",
    category: "utility",
    react: "🆔",
    filename: __filename
},
async (conn, mek, m, { from, quoted, args, reply, isGroup }) => {

    try {

        // =========================
        // CHANNEL LINK CHECK
        // =========================
        const text = args.join(" ");

        if (text && text.includes("whatsapp.com/channel/")) {

            try {

                const inviteCode = text
                    .split("whatsapp.com/channel/")[1]
                    .split("/")[0]
                    .split("?")[0];

                if (!inviteCode) {
                    return reply("❌ Invalid WhatsApp channel link.");
                }

                const metadata = await conn.newsletterMetadata(
                    "invite",
                    inviteCode
                );

                if (!metadata || !metadata.id) {
                    return reply("❌ Unable to fetch channel JID.");
                }

                return reply(
`╭━━〔 *CHANNEL JID* 〕━━⬣
┃ 📢 *Name:* ${metadata.name || "Unknown"}
┃ 🆔 *JID:* 
┃ \`\`\`${metadata.id}\`\`\`
╰━━━━━━━━━━━━━━⬣`
                );

            } catch (e) {
                console.log(e);
                return reply("❌ Failed to get channel JID.");
            }
        }

        // =========================
        // REPLY USER JID
        // =========================
        if (quoted) {

            const qjid = quoted.sender;

            return reply(
`╭━━〔 *USER JID* 〕━━⬣
┃ 👤 *User:* @${qjid.split("@")[0]}
┃ 🆔 *JID:* 
┃ \`\`\`${qjid}\`\`\`
╰━━━━━━━━━━━━━━⬣`,
                { mentions: [qjid] }
            );
        }

        // =========================
        // MENTION USER JID
        // =========================
        const mentioned =
            mek.message?.extendedTextMessage?.contextInfo
                ?.mentionedJid?.[0];

        if (mentioned) {

            return reply(
`╭━━〔 *USER JID* 〕━━⬣
┃ 👤 *User:* @${mentioned.split("@")[0]}
┃ 🆔 *JID:* 
┃ \`\`\`${mentioned}\`\`\`
╰━━━━━━━━━━━━━━⬣`,
                { mentions: [mentioned] }
            );
        }

        // =========================
        // NUMBER TO JID
        // =========================
        if (args[0] && /^[0-9]+$/.test(args[0])) {

            const num = args[0].replace(/[^0-9]/g, "");
            const jid = num + "@s.whatsapp.net";

            return reply(
`╭━━〔 *NUMBER JID* 〕━━⬣
┃ 📱 *Number:* ${num}
┃ 🆔 *JID:* 
┃ \`\`\`${jid}\`\`\`
╰━━━━━━━━━━━━━━⬣`
            );
        }

        // =========================
        // GROUP JID
        // =========================
        if (isGroup) {

            return reply(
`╭━━〔 *GROUP JID* 〕━━⬣
┃ 👥 *Group:* ${m.pushName || "Group"}
┃ 🆔 *JID:* 
┃ \`\`\`${from}\`\`\`
╰━━━━━━━━━━━━━━⬣`
            );
        }

        // =========================
        // PERSONAL CHAT JID
        // =========================
        return reply(
`╭━━〔 *CHAT JID* 〕━━⬣
┃ 🆔 *JID:* 
┃ \`\`\`${from}\`\`\`
╰━━━━━━━━━━━━━━⬣`
        );

    } catch (e) {

        console.log("jid cmd error =>", e);

        reply(
`❌ Error Found

${e.message}`
        );
    }
});
