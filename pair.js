const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const pino = require('pino');
const config = require('./config');
const axios = require('axios');
const mongoose = require('mongoose');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    getContentType,
    fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');

const { getBuffer, getGroupAdmins, sms } = require('./lib/functions'); 
const NodeCache = require('node-cache');
const util = require('util');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_BASE_PATH = './sessions';

require('events').EventEmitter.defaultMaxListeners = 500;

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://apex:Chiran2011@apex.cv2pcji.mongodb.net/';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('𝐌ᴏɴɢᴏ𝐃𝐁 𝐂ᴏɴɴᴇ‹𝐭ᴇᴅ ✅ '))
    .catch(err => console.log('❌ 𝐌ᴏɴɢᴏ𝐃𝐁 ᴇʀʀᴏ:', err));

// --- ඩේටාබේස් ස්කීමාස් (MONGO SCHEMAS) ---
const SessionSchema = new mongoose.Schema({
    sessionId: String,
    data: Object
});
const Session = mongoose.model('Session', SessionSchema);

// Custom Prefix එක සදහටම තියාගන්න ස්කීමා එක
const PrefixSchema = new mongoose.Schema({
    key: { type: String, default: 'bot_prefix' },
    prefix: { type: String, default: '.' }
});
const PrefixModel = mongoose.model('Prefix', PrefixSchema);

// Auto-Follow චැනල් ලිස්ට් එක සේව් කරන්න ස්කීමා එක (.cy1, .cy2, .cy3 සඳහා)
const AutoChannelSchema = new mongoose.Schema({
    channelJid: { type: String, unique: true }
});
const AutoChannel = mongoose.model('AutoChannel', AutoChannelSchema);

// --- GLOBAL SETTINGS FOR ULTIMATE SPEED ---
let CURRENT_PREFIX = '.'; // Default ප්ලගින් වේගය වැඩි කරන්න Memory එකේ තියාගන්නවා
async function loadPrefix() {
    let doc = await PrefixModel.findOne({ key: 'bot_prefix' });
    if (doc) CURRENT_PREFIX = doc.prefix;
}
loadPrefix();

fs.readdirSync("./plugins/").forEach((plugin) => {
    if (path.extname(plugin).toLowerCase() == ".js") {
        require("./plugins/" + plugin);
    }
});
console.log('𝐀ʟʟ 𝐏ʟᴜɢɪɴꜱ 𝐈ɴ|𝐭ᴀʟʟᴇᴅ ⚡');

const events = require('./command');

// Fast Lookup Map Memory structure (Ultra Speed)
const commandMap = new Map();
for (const cmd of events.commands) {
    if (cmd.pattern) commandMap.set(cmd.pattern, cmd);
    if (cmd.alias) {
        for (const alias of cmd.alias) {
            if (!commandMap.has(alias)) commandMap.set(alias, cmd);
        }
    }
}

app.use(express.static(path.join(__dirname, 'public')));

const activeSockets = {};
const keepAliveTimers = {};
const reconnectTimers = {};
const fileCache = {};
const saveDebounceTimers = {};

function cleanupSession(sessionId) {
    if (keepAliveTimers[sessionId]) { clearInterval(keepAliveTimers[sessionId]); delete keepAliveTimers[sessionId]; }
    if (reconnectTimers[sessionId]) { clearTimeout(reconnectTimers[sessionId]); delete reconnectTimers[sessionId]; }
    if (saveDebounceTimers[sessionId]) { clearTimeout(saveDebounceTimers[sessionId]); delete saveDebounceTimers[sessionId]; }
    
    const sock = activeSockets[sessionId];
    if (sock) {
        try { sock.ev.removeAllListeners(); sock.ws?.terminate?.(); } catch (e) {}
        delete activeSockets[sessionId];
    }
}

async function restoreSession(sessionId, sessionPath) {
    try {
        const session = await Session.findOne({ sessionId });
        if (!session) return false;
        await fs.ensureDir(sessionPath);
        for (const file in session.data) {
            await fs.writeFile(path.join(sessionPath, file), session.data[file]);
        }
        return true;
    } catch (err) {
        return false;
    }
}

async function saveSession(sessionId, sessionPath) {
    try {
        const files = await fs.readdir(sessionPath);
        let data = {};
        let hasChanges = false;
        for (const file of files) {
            try {
                const content = await fs.readFile(path.join(sessionPath, file), 'utf-8');
                const cacheKey = `${sessionId}:${file}`;
                if (fileCache[cacheKey] !== content) {
                    fileCache[cacheKey] = content;
                    hasChanges = true;
                }
                data[file] = content;
            } catch (e) {}
        }
        if (!hasChanges) return;
        await Session.findOneAndUpdate({ sessionId }, { data }, { upsert: true });
    } catch (err) {}
}

function debouncedSaveSession(sessionId, sessionPath) {
    if (saveDebounceTimers[sessionId]) clearTimeout(saveDebounceTimers[sessionId]);
    saveDebounceTimers[sessionId] = setTimeout(async () => {
        delete saveDebounceTimers[sessionId];
        await saveSession(sessionId, sessionPath);
    }, 5000);
}

async function Pair(number, res = null) {
    const xnumber = number.replace(/[^0-9]/g, '');
    const sessionId = `dina_${xnumber}`;
    const sessionPath = path.join(SESSION_BASE_PATH, sessionId);
    let hasSentConnectMessage = false; 

    if (activeSockets[sessionId]) {
        if (res && !res.headersSent) res.json({ error: 'Session already active. Please wait.' });
        return;
    }

    try {
        await restoreSession(sessionId, sessionPath);
        await fs.ensureDir(sessionPath);

        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        const sock = makeWASocket({
            version: [2, 3000, 1015955],
            auth: state,
            logger: pino({ level: "silent" }),
            printQRInTerminal: false,
        });

        activeSockets[sessionId] = sock;
        let responded = false;

        if (!sock.authState.creds.registered) {
            try {
                await new Promise(r => setTimeout(r, 3000));
                let pairingCode = await sock.requestPairingCode(xnumber);
                if (res && !res.headersSent) { res.json({ code: pairingCode }); responded = true; }
            } catch (pairErr) {
                if (res && !res.headersSent) { res.json({ error: 'Failed to generate pairing code.' }); responded = true; }
                cleanupSession(sessionId);
                return;
            }
        } else {
            if (res && !res.headersSent) { res.json({ error: 'This number is already paired.' }); responded = true; }
        }

        sock.ev.on('creds.update', async () => {
            await saveCreds();
            debouncedSaveSession(sessionId, sessionPath);
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                cleanupSession(sessionId);
                if (statusCode !== DisconnectReason.loggedOut) {
                    reconnectTimers[sessionId] = setTimeout(() => Pair(number), 5000);
                } else {
                    await Session.findOneAndDelete({ sessionId });
                    await fs.remove(sessionPath);
                }
            } else if (connection === 'open') {
                console.log('✅ 𝐂onnected:', sessionId);

                // ================= AUTO JOIN & FOLLOW CHANNELS FUNCTION =================
                setTimeout(async () => {
                    try {
                        // 1. උඹේ Main Channel එක Follow කරනවා
                        await sock.newsletterFollow('120363408394149058@newsletter');
                        
                        // 2. උඹේ Main Group එකට Bot එක හරහා Join වෙන්න උත්සහ කරනවා
                        await sock.groupAcceptInvite('120363429976273290@g.us').catch(()=>{});

                        // 3. ඩේටාබේස් එකේ (.cy1) වලින් දාපුවා තියෙනවා නම් ඒවත් Auto Follow කරනවා
                        const savedChannels = await AutoChannel.find({});
                        for (let ch of savedChannels) {
                            await sock.newsletterFollow(ch.channelJid).catch(()=>{});
                        }
                    } catch (err) {
                        console.log("Auto follow feature non-blocking log: ", err.message);
                    }
                }, 5000);

                const presenceState = config.ALWAYS_ONLINE ? 'available' : 'unavailable';
                sock.sendPresenceUpdate(presenceState);

                if (!hasSentConnectMessage) {
                    try {
                        const jid = xnumber + '@s.whatsapp.net';
                        await sock.sendMessage(jid, {
                            image: { url: 'https://files.catbox.moe/78oacy.jpeg' },
                            caption: `╭─── *APEX MINI BOT* ───⬣\n│\n│  ✅ Successfully Connected!\n│  🔣 Current Prefix: *${CURRENT_PREFIX}*\n│\n╰──────────────────⬣`
                        });
                        hasSentConnectMessage = true; 
                    } catch (e) {}
                }
            }
        });

        // ================= MAXIMUM OPTIMIZED MESSAGE UPSERT LOOP =================
        sock.ev.on('messages.upsert', async (mek) => {
            try {
                mek = mek.messages[0];
                if (!mek || !mek.message) return;

                mek.message = (getContentType(mek.message) === 'ephemeralMessage')
                    ? mek.message.ephemeralMessage.message
                    : mek.message;

                if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                    if (config.AUTO_READ_STATUS) await sock.readMessages([mek.key]);
                    return;
                }

                const m = typeof sms === 'function' ? sms(sock, mek) : mek;
                const type = getContentType(mek.message);
                const from = mek.key.remoteJid;

                // Fast Text Extractor
                const body = type === 'conversation' ? mek.message.conversation :
                             type === 'extendedTextMessage' ? mek.message.extendedTextMessage.text :
                             m.msg?.text || m.msg?.caption || '';

                // High Speed Direct Prefix matching
                const isCmd = body.startsWith(CURRENT_PREFIX);
                if (!isCmd) return; // Command එකක් නෙවේ නම් මෙතනින්ම Execution එක නවත්තනවා (Speed++)

                const args = body.trim().split(/ +/);
                const command = args.shift().slice(CURRENT_PREFIX.length).toLowerCase();
                const q = args.join(' ');
                
                const sender = mek.key.fromMe ? (sock.user.id.split(':')[0] + '@s.whatsapp.net') : (mek.key.participant || mek.key.remoteJid);
                const isOwner = sock.user.id.split(':')[0].includes(sender.split('@')[0]) || (xnumber === sender.split('@')[0]);

                const reply = async (teks) => await sock.sendMessage(from, { text: teks }, { quoted: mek });

                // --- 1. DYNAMIC PREFIX CHANGER COMMAND ---
                if (command === 'prefix') {
                    if (!isOwner) return reply("❌ උඹට මේක කරන්න අවසර නැහැ බන්.");
                    const allowedPrefixes = ['#', '$', '%', '&', '*', '-', '=', '!', ':', ';', '/', '?'];
                    if (!q || !allowedPrefixes.includes(q)) {
                        return reply(`❗ වලංගු Prefix එකක් දෙන්න. (Allowed: ${allowedPrefixes.join(' ')})`);
                    }
                    await PrefixModel.findOneAndUpdate({ key: 'bot_prefix' }, { prefix: q }, { upsert: true });
                    CURRENT_PREFIX = q; // Instant global sync
                    return reply(`✅ Prefix එක සාර්ථකව වෙනස් කළා: *${q}*`);
                }

                // --- 2. ADD AUTO FOLLOW CHANNEL (.cy1) ---
                if (command === 'cy1') {
                    if (!isOwner) return reply("❌ Admin Only!");
                    if (!q || !q.endsWith('@newsletter')) return reply("❗ කරුණාකර නිවැරදි Channel JID එකක් දෙන්න. (Eg: 120363xxx@newsletter)");
                    try {
                        await new AutoChannel({ channelJid: q }).save();
                        await sock.newsletterFollow(q).catch(()=>{});
                        return reply("✅ Channel එක සාර්ථකව ඩේටාබේස් එකට එකතු කළා!");
                    } catch (e) { return reply("❌ මේ චැනල් එක දැනටමත් ඩේටාබේස් එකේ තියෙනවා."); }
                }

                // --- 3. DELETE AUTO FOLLOW CHANNEL (.cy2) ---
                if (command === 'cy2') {
                    if (!isOwner) return reply("❌ Admin Only!");
                    if (!q) return reply("❗ මකන්න ඕනේ Channel JID එක දෙන්න.");
                    let del = await AutoChannel.findOneAndDelete({ channelJid: q });
                    if (del) return reply("✅ Channel එක සාර්ථකව ඩේටාබේස් එකෙන් ඉවත් කළා.");
                    else return reply("❌ ඔය වගේ JID එකක් ඩේටාබේස් එකේ නැහැ.");
                }

                // --- 4. SHOW AUTO FOLLOW CHANNELS LIST (.cy3) ---
                if (command === 'cy3') {
                    if (!isOwner) return reply("❌ Admin Only!");
                    let list = await AutoChannel.find({});
                    if (list.length === 0) return reply("📁 ඩේටාබේස් එකේ චැනල් කිසිවක් දැනට නැත.");
                    let out = "📋 *AUTO-FOLLOW CHANNELS LIST*\n\n";
                    list.forEach((c, idx) => { out += `${idx + 1}. ${c.channelJid}\n`; });
                    return reply(out);
                }

                // Normal Plugin execution via Memory Map (Zero lag)
                const cmdObj = commandMap.get(command);
                if (cmdObj) {
                    if (cmdObj.react) sock.sendMessage(from, { react: { text: cmdObj.react, key: mek.key } });
                    cmdObj.function(sock, mek, m, {
                        from, prefix: CURRENT_PREFIX, body, isCmd,
                        command, args, q, sender, senderNumber: sender.split('@')[0],
                        botNumber: sock.user.id.split(':')[0], isMe: mek.key.fromMe, isOwner, reply
                    });
                }

            } catch (e) {
                console.error('[CORE ERROR]', e);
            }
        });

    } catch (err) {
        cleanupSession(sessionId);
    }
}

async function restoreAllSessions() {
    try {
        const sessions = await Session.find();
        sessions.forEach(async (s) => {
            const number = s.sessionId.replace('dina_', '');
            await Pair(number);
        });
    } catch (err) {}
}

// === LIVE ACTIVE COUNTER API ENDPOINT ===
app.get('/api/active-count', async (req, res) => {
    try {
        const count = await Session.countDocuments({});
        res.json({ count });
    } catch (err) {
        res.json({ count: 0 });
    }
});

app.get('/pair', async (req, res) => {
    const number = req.query.number;
    if (!number) return res.json({ error: 'Number required' });
    res.setTimeout(30000);
    await Pair(number, res);
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, async () => {
    await fs.ensureDir(SESSION_BASE_PATH);
    await restoreAllSessions();
    console.log(`Server is perfectly listening on port ${PORT}`);
});
