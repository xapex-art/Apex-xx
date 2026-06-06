const { cmd } = require('../command');
const mongoose = require('mongoose');

cmd({
    pattern: "addchannel",
    desc: "Add a channel to auto-react and auto-follow list.",
    category: "owner",
    react: "✅",
    filename: __filename
},
async (conn, mek, m, { q, isOwner, reply }) => {
    // Owner ta witarai me command eka gahanna puluwan
    if (!isOwner) return reply("❌ Only the owner can use this command.");
    
    if (!q) return reply("❌ Please provide the Channel JID.\nExample: *.addchannel 123456789@newsletter*");
    if (!q.endsWith('@newsletter')) return reply("❌ Invalid JID. It must end with @newsletter");

    try {
        const TargetChannel = mongoose.model('TargetChannel');
        
        // Channel eka kalින් add karalada balanawa
        const exists = await TargetChannel.findOne({ jid: q });
        if (exists) return reply("⚠️ This channel is already in the database.");

        // Database ekata save karanawa
        await TargetChannel.create({ jid: q });
        
        // Meka create wuna gaman pair.js eke watcher eka realtime trigger wela active sessions walin auto-follow karagannawa!
        reply(`✅ Successfully added \`${q}\` to MongoDB.\n\n🔄 Bot watcher will now automatically update the cache memory and attempt to follow it instantly!`);
        
    } catch (e) {
        console.log(e);
        reply("❌ Error adding channel to database.");
    }
});

