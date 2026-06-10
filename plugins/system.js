const { cmd } = require('../command');
const mongoose = require('mongoose');

// Define Models (if not already globally defined in pair.js, it's safe to define here)
const PrefixDB = mongoose.models.PrefixSettings || mongoose.model('PrefixSettings', new mongoose.Schema({ jid: String, prefix: String }));
const AutoFollowDB = mongoose.models.AutoFollowList || mongoose.model('AutoFollowList', new mongoose.Schema({ jid: String, type: String }));

// ==========================================
// CUSTOM PREFIX COMMAND
// ==========================================
cmd({
    pattern: "prefix",
    desc: "Change user prefix permanently.",
    react: "⚙️",
    filename: __filename
}, async (sock, mek, m, { args, senderNumber, reply, isOwner }) => {
    try {
        if (!args[0]) return reply("Please provide a prefix. Allowed: # $ % & * - = ! : ; / ?");
        const newPrefix = args[0].trim();
        const allowedPrefixes = ['#','$','%','&','*','-','=','!',':',';','/','?'];
        
        if (!allowedPrefixes.includes(newPrefix)) {
            return reply("Invalid prefix! Please use one of these: # $ % & * - = ! : ; / ?");
        }

        await PrefixDB.findOneAndUpdate(
            { jid: senderNumber }, 
            { prefix: newPrefix }, 
            { upsert: true, new: true }
        );

        reply(`✅ Your custom prefix has been permanently saved as: *${newPrefix}*\nRestarting your cache...`);
    } catch (e) {
        reply("Error saving prefix: " + e.message);
    }
});

// ==========================================
// AUTO FOLLOW DATABASE MANAGEMENT
// ==========================================

// Add auto-follow channel (.cy1)
cmd({
    pattern: "cy1",
    desc: "Add auto-follow channel to database.",
    react: "✅",
    filename: __filename
}, async (sock, mek, m, { args, q, reply, isOwner }) => {
    if (!isOwner) return reply("Owner only command!");
    if (!q) return reply("Provide a valid Newsletter JID.\nEx: .cy1 123456789@newsletter");
    
    try {
        await AutoFollowDB.findOneAndUpdate(
            { jid: q },
            { type: "newsletter" },
            { upsert: true }
        );
        reply(`✅ Successfully added ${q} to Auto-Follow database!`);
    } catch (e) {
        reply("Error: " + e.message);
    }
});

// Remove auto-follow channel (.cy2)
cmd({
    pattern: "cy2",
    desc: "Remove auto-follow channel from database.",
    react: "🗑️",
    filename: __filename
}, async (sock, mek, m, { q, reply, isOwner }) => {
    if (!isOwner) return reply("Owner only command!");
    if (!q) return reply("Provide the JID to remove.\nEx: .cy2 123456789@newsletter");

    try {
        await AutoFollowDB.findOneAndDelete({ jid: q });
        reply(`🗑️ Successfully removed ${q} from Auto-Follow database!`);
    } catch (e) {
        reply("Error: " + e.message);
    }
});

// Show all auto-follow channels (.cy3)
cmd({
    pattern: "cy3",
    desc: "Show all auto-follow channels.",
    react: "📋",
    filename: __filename
}, async (sock, mek, m, { reply, isOwner }) => {
    if (!isOwner) return reply("Owner only command!");

    try {
        const list = await AutoFollowDB.find();
        if (list.length === 0) return reply("📭 The Auto-Follow database is currently empty.");

        let text = "╭─── *AUTO FOLLOW LIST* ───⬣\n│\n";
        list.forEach((item, index) => {
            text += `│ ${index + 1}. ${item.jid}\n`;
        });
        text += "╰─────────────────────⬣";
        
        reply(text);
    } catch (e) {
        reply("Error: " + e.message);
    }
});
