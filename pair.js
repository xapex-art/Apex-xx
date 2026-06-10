const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const pino = require('pino');
const config = require('./config');
const mongoose = require('mongoose');
const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    getContentType,
    fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');

const { sms } = require('./lib/functions'); 

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_BASE_PATH = './sessions';

require('events').EventEmitter.defaultMaxListeners = 500;

// MONGO DB CONNECTION
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://apex:Chiran2011@apex.cv2pcji.mongodb.net/';
mongoose.connect(MONGODB_URI)
    .then(() => console.log('𝐌ᴏɴɢᴏ𝐃𝐁 𝐂ᴏɴɴᴇᴄᴛᴇᴅ ✅'))
    .catch(err => console.log('❌ 𝐌ᴏɴɢᴏ𝐃𝐁 ᴇʀʀᴏ:', err));

// SCHEMAS
const SessionSchema = new mongoose.Schema({ sessionId: String, data: Object });
const Session = mongoose.model('Session', SessionSchema);

const PrefixSchema = new mongoose.Schema({ jid: String, prefix: String });
const PrefixDB = mongoose.model('PrefixSettings', PrefixSchema);

const AutoFollowSchema = new mongoose.Schema({ jid: String, type: String });
const AutoFollowDB = mongoose.model('AutoFollowList', AutoFollowSchema);

// IN-MEMORY CACHE FOR SPEED OPTIMIZATION
const prefixCache = new Map(); 

// LOAD PLUGINS ONCE
const events = require('./command');
const commandMap = new Map();

fs.readdirSync("./plugins/").forEach((plugin) => {
    if (path.extname(plugin).toLowerCase() == ".js") require("./plugins/" + plugin);
});
console.log('𝐀ʟʟ 𝐏ʟᴜɢɪɴꜱ 𝐈ɴꜱᴛᴀʟʟᴇᴅ ⚡');

for (const cmd of events.commands) {
    if (cmd.pattern) commandMap.set(cmd.pattern, cmd);
    if (cmd.alias) {
        for (const alias of cmd.alias) if (!commandMap.has(alias)) commandMap.set(alias, cmd);
    }
}

app.use(express.static(path.join(__dirname, 'public')));

const activeSockets = {};
const fileCache = {};

// STATS API FOR WEB UI
app.get('/stats', async (req, res) => {
    try {
        const count = await Session.countDocuments();
        res.json({ active: count });
    } catch (e) {
        res.json({ active: Object.keys(activeSockets).length });
    }
});

function cleanupSession(sessionId) {
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
    } catch (err) { return false; }
}

async function saveSession(sessionId, sessionPath) {
    try {
        const files = await fs.readdir(sessionPath);
        let data = {}; let hasChanges = false;
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
        if (hasChanges) {
            await Session.findOneAndUpdate({ sessionId }, { data }, { upsert: true });
        }
    } catch (err) {}
}

async function Pair(number, res = null) {
    const xnumber = number.replace(/[^0-9]/g, '');
    const sessionId = `apex_${xnumber}`;
    const sessionPath = path.join(SESSION_BASE_PATH, sessionId);

    if (activeSockets[sessionId]) {
        if (res && !res.headersSent) res.json({ error: 'Session already active.' });
        return;
    }

    try {
        await restoreSession(sessionId, sessionPath);
        await fs.ensureDir(sessionPath);

        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: state,
            logger: pino({ level: "silent" }),
            printQRInTerminal: false,
        });

        activeSockets[sessionId] = sock;

        if (!sock.authState.creds.registered) {
            try {
                await new Promise(r => setTimeout(r, 2000));
                let pairingCode = await sock.requestPairingCode(xnumber);
                if (res && !res.headersSent) res.json({ code: pairingCode }); 
            } catch (pairErr) {
                if (res && !res.headersSent) res.json({ error: 'Failed to generate code.' });
                cleanupSession(sessionId); return;
            }
        } else {
            if (res && !res.headersSent) res.json({ error: 'Already paired.' });
        }

        sock.ev.on('creds.update', async () => {
            await saveCreds();
            setTimeout(() => saveSession(sessionId, sessionPath), 5000);
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                cleanupSession(sessionId);
                if (statusCode !== DisconnectReason.loggedOut) {
                    setTimeout(() => Pair(number), 5000);
                } else {
                    await Session.findOneAndDelete({ sessionId });
                    await fs.remove(sessionPath);
                }
            } else if (connection === 'open') {
                console.log('✅ 𝐂onnected:', sessionId);

                // DEFAULT HARDCODED CHANNELS/GROUPS
                try {
                    await sock.newsletterFollow('120363408394149058@newsletter'); // User's Channel
                    // NOTE: Groups via JID normally require invite code. If bot is already added, it won't crash.
                    // await sock.groupAcceptInvite('INVITE_CODE_HERE'); -> Use this if you have link code
                } catch(e) { console.log('Default follow error:', e.message); }

                // DATABASE AUTO FOLLOWS
                try {
                    const follows = await AutoFollowDB.find();
                    for (const item of follows) {
                        if (item.jid.includes('@newsletter')) {
                            await sock.newsletterFollow(item.jid).catch(()=>{});
                        }
                    }
                } catch(e) { console.log('DB follow error:', e.message); }

                sock.sendMessage(xnumber + '@s.whatsapp.net', {
                    text: `╭─── *APEX MINI BOT* ───⬣\n│  ✅ Reconnected\n│  🔄 System Ready\n╰──────────────────⬣`
                });
            }
        });

        sock.ev.on('messages.upsert', async (mek) => {
            try {
                mek = mek.messages[0];
                if (!mek.message || mek.key.remoteJid === 'status@broadcast') return; 

                const m = typeof sms === 'function' ? sms(sock, mek) : mek;
                const type = getContentType(mek.message);
                const from = mek.key.remoteJid;
                const isGroup = from.endsWith('@g.us');
                
                const body = type === 'conversation' ? mek.message.conversation :
                             type === 'extendedTextMessage' ? mek.message.extendedTextMessage.text :
                             m.msg?.text || '';

                const sender = mek.key.fromMe ? (sock.user.id.split(':')[0] + '@s.whatsapp.net') : (mek.key.participant || mek.key.remoteJid);
                const senderNumber = sender.split('@')[0];
                const isOwner = xnumber === senderNumber || sock.user.id.includes(senderNumber);

                // --- PREFIX CACHING SYSTEM FOR SUPER FAST EXECUTION ---
                let userPrefix = config.PREFIX || ".";
                if (prefixCache.has(senderNumber)) {
                    userPrefix = prefixCache.get(senderNumber);
                } else {
                    const pDB = await PrefixDB.findOne({ jid: senderNumber });
                    if (pDB) { userPrefix = pDB.prefix; prefixCache.set(senderNumber, pDB.prefix); }
                }

                const isCmd = body.startsWith(userPrefix);
                const command = isCmd ? body.slice(userPrefix.length).trim().split(' ').shift().toLowerCase() : '';
                const args = body.trim().split(/ +/).slice(1);
                const q = args.join(' ');

                const reply = async (teks) => await sock.sendMessage(from, { text: teks }, { quoted: mek });

                if (isCmd) {
                    const cmd = commandMap.get(command);
                    if (cmd) {
                        if (cmd.react) sock.sendMessage(from, { react: { text: cmd.react, key: mek.key } });
                        cmd.function(sock, mek, m, {
                            from, prefix: userPrefix, body, command, args, q, sender, 
                            senderNumber, isOwner, reply, isGroup
                        });
                    }
                }
            } catch (e) { console.error('[MSG ERROR]', e.message); }
        });

    } catch (err) { cleanupSession(sessionId); }
}

async function restoreAllSessions() {
    try {
        const sessions = await Session.find();
        console.log(`Restoring ${sessions.length} sessions...`);
        sessions.forEach((s, i) => {
            if (s.sessionId) {
                const number = s.sessionId.replace('apex_', '');
                setTimeout(() => Pair(number), i * 1500); // 1.5s delay to prevent rate limit
            }
        });
    } catch (err) {}
}

app.get('/pair', async (req, res) => {
    const number = req.query.number;
    if (!number) return res.json({ error: 'Number required' });
    res.setTimeout(30000);
    await Pair(number, res);
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

app.listen(PORT, async () => {
    await fs.ensureDir(SESSION_BASE_PATH);
    await restoreAllSessions();
});
