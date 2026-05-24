const { cmd } = require('../command');
let config = require('../config');

// Main Menu Command
cmd({
    pattern: "setting",
    react: "⚙️",
    desc: "Bot Setting Menu",
    category: "owner",
    filename: __filename
},
async (sock, mek, m, { from, reply, isOwner }) => {
    // Owner Only
    if (!isOwner) return reply("❌ This command is only for the owner!");

    const menu = `*⚙️ SETTING PANEL*

━━━━━━━━━━━━━━━━━━━

│ • \`1 - WORK TYPE\`

\`\`\`1.1 PRIVATE ${config.WORK_TYPE === 'private' ? '✅' : ''}\`\`\`
\`\`\`1.2 PUBLIC ${config.WORK_TYPE === 'public' ? '✅' : ''}\`\`\`
\`\`\`1.3 GROUP ${config.WORK_TYPE === 'group' ? '✅' : ''}\`\`\`
\`\`\`1.4 INBOX ${config.WORK_TYPE === 'inbox' ? '✅' : ''}\`\`\`

│ • \`2 - ALWAYS ONLINE\`

\`\`\`2.1 OFF ${!config.ALWAYS_ONLINE ? '✅' : ''}\`\`\`
\`\`\`2.2 ON ${config.ALWAYS_ONLINE ? '✅' : ''}\`\`\`

│ • \`3 - AUTO TYPING\`

\`\`\`3.1 OFF ${!config.AUTO_TYPING ? '✅' : ''}\`\`\`
\`\`\`3.2 ON ${config.AUTO_TYPING ? '✅' : ''}\`\`\`

│ • \`4 - AUTO REACT\`

\`\`\`4.1 OFF ${!config.AUTO_REACT ? '✅' : ''}\`\`\`
\`\`\`4.2 ON ${config.AUTO_REACT ? '✅' : ''}\`\`\`

│ • \`5 - AUTO READ STATUS\`

\`\`\`5.1 OFF ${!config.AUTO_READ_STATUS ? '✅' : ''}\`\`\`
\`\`\`5.2 ON ${config.AUTO_READ_STATUS ? '✅' : ''}\`\`\`

━━━━━━━━━━━━━━━━━━━

> \`\`\`Developed by ChiraNx 🌸\`\`\``;

    await sock.sendMessage(from, { text: menu }, { quoted: mek });
});

// Reply Option Handler
cmd({
    on: "text"
},
async (sock, mek, m, { from, body, isOwner, reply }) => {
    if (!isOwner) return; // Only owner can change settings
    if (!mek.message?.extendedTextMessage?.contextInfo?.quotedMessage) return;

    const quotedText = mek.message.extendedTextMessage.contextInfo.quotedMessage.conversation || 
                       mek.message.extendedTextMessage.contextInfo.quotedMessage.extendedTextMessage?.text || "";

    if (!quotedText.includes("*⚙️ SETTING PANEL*")) return;

    const opt = body.trim();
    let updated = false;

    // WORK TYPE
    if (opt === "1.1") { config.WORK_TYPE = 'private'; updated = true; }
    else if (opt === "1.2") { config.WORK_TYPE = 'public'; updated = true; }
    else if (opt === "1.3") { config.WORK_TYPE = 'group'; updated = true; }
    else if (opt === "1.4") { config.WORK_TYPE = 'inbox'; updated = true; }

    // ALWAYS ONLINE
    else if (opt === "2.1") { config.ALWAYS_ONLINE = false; updated = true; }
    else if (opt === "2.2") { config.ALWAYS_ONLINE = true; updated = true; }

    // AUTO TYPING
    else if (opt === "3.1") { config.AUTO_TYPING = false; updated = true; }
    else if (opt === "3.2") { config.AUTO_TYPING = true; updated = true; }

    // AUTO REACT
    else if (opt === "4.1") { config.AUTO_REACT = false; updated = true; }
    else if (opt === "4.2") { config.AUTO_REACT = true; updated = true; }

    // AUTO READ STATUS
    else if (opt === "5.1") { config.AUTO_READ_STATUS = false; updated = true; }
    else if (opt === "5.2") { config.AUTO_READ_STATUS = true; updated = true; }

    if (updated) {
        await reply(`✅ *Setting Successfully Applied!*\n\nOption \`${opt}\` applied to the bot live system.`);
    }
});
