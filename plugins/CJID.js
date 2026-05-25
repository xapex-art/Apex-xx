const { cmd } = require('../command');

cmd({
    pattern: "cjid",
    desc: "Get WhatsApp Channel JID.",
    category: "utility",
    react: "📢",
    filename: __filename
},
async (conn, mek, m, { args, reply }) => {

    try {

        const link = args[0];

        // =========================
        // CHECK LINK
        // =========================
        if (!link || !link.includes("whatsapp.com/channel/")) {

            return reply(
`╭━━〔 *CHANNEL JID* 〕━━⬣
┃ ❌ Please provide a valid
┃ WhatsApp channel link.
┃
┃ 📌 *Example:*
┃ .cjid https://whatsapp.com/channel/xxxxx
╰━━━━━━━━━━━━━━⬣`
            );
        }

        // =========================
        // EXTRACT INVITE CODE
        // =========================
        const inviteCode = link
            .split("whatsapp.com/channel/")[1]
            .split("/")[0]
            .split("?")[0];

        if (!inviteCode) {

            return reply(
`╭━━〔 *CHANNEL JID* 〕━━⬣
┃ ❌ Invalid channel link.
╰━━━━━━━━━━━━━━⬣`
            );
        }

        // =========================
        // REACT
        // =========================
        await conn.sendMessage(
            mek.key.remoteJid,
            {
                react: {
                    text: "🔍",
                    key: mek.key
                }
            }
        );

        // =========================
        // FETCH CHANNEL DATA
        // =========================
        const metadata = await conn.newsletterMetadata(
            "invite",
            inviteCode
        );

        if (!metadata || !metadata.id) {

            return reply(
`╭━━〔 *CHANNEL JID* 〕━━⬣
┃ ❌ Unable to fetch
┃ channel JID.
╰━━━━━━━━━━━━━━⬣`
            );
        }

        // =========================
        // SUCCESS MESSAGE
        // =========================
        return reply(
`╭━━〔 *CHANNEL JID* 〕━━⬣
┃ 📢 *Name:* ${metadata.name || "Unknown"}
┃ 🆔 *JID:* 
┃ \`\`\`${metadata.id}\`\`\`
╰━━━━━━━━━━━━━━⬣`
        );

    } catch (e) {

        console.log("cjid error =>", e);

        return reply(
`╭━━〔 *CHANNEL JID* 〕━━⬣
┃ ❌ Error Found
┃
┃ ${e.message}
╰━━━━━━━━━━━━━━⬣`
        );
    }
});
