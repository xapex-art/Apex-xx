const { cmd } = require('../command');

cmd({
    pattern: "cjid",
    desc: "Get the JID of a WhatsApp channel from its invite link.",
    category: "utility",
    react: "🔍",
    filename: __filename
},
async (conn, mek, m, { from, args, reply }) => {
    try {
        const link = args[0];

        // ලින්ක් එකක් දීලා තියෙනවද සහ ඒක නිවැරදි channel link එකක්ද කියලා බලනවා
        if (!link || !link.includes('whatsapp.com/channel/')) {
            return reply("❌ *Please provide a valid WhatsApp channel link.*\n\n*Usage:* `.cjid https://whatsapp.com/channel/ABCD...`");
        }

        // ලින්ක් එකෙන් invite code එක වෙන් කරගන්නවා
        const inviteCode = link.split('whatsapp.com/channel/')[1].split('/')[0].split('?')[0];

        if (!inviteCode) {
            return reply("❌ *Could not extract invite code from the given link.*");
        }

        reply("⏳ *Extracting Channel JID, please wait...*");
        
        try {
            // Channel එකේ details ගන්නවා (Baileys method)
            const metadata = await conn.newsletterMetadata("invite", inviteCode);
            
            if (metadata && metadata.id) {
                const chName = metadata.name ? `*Channel Name:* ${metadata.name}\n` : "";
                return reply(`✅ *Channel JID Found!*\n\n${chName}*JID:* \`\`\`${metadata.id}\`\`\``);
            } else {
                return reply("❌ *Could not find JID. The link might be invalid or the channel is private.*");
            }
        } catch (err) {
            console.error("Error fetching newsletter metadata:", err);
            return reply("❌ *Failed to fetch channel JID.* \n_(Make sure the bot supports WhatsApp newsletters)_");
        }

    } catch (e) {
        console.error('cjid error:', e);
        reply("❌ *System Error:* " + e.message);
    }
});
