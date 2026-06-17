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

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://Akdev:1234@cluster0.folf1ey.mongodb.net/';

mongoose.connect(MONGODB_URI)
    .then(() => console.log('𝐌ᴏɴɢᴏ𝐃𝐁 𝐂ᴏɴɴᴇᴄᴛᴇᴅ ✅ '))
    .catch(err => console.log('❌ 𝐌ᴏɴɢᴏ𝐃𝐁 ᴇʀʀᴏ:', err));

const SessionSchema = new mongoose.Schema({
    sessionId: String,
    data: Object
});
const Session = mongoose.model('Session', SessionSchema);

fs.readdirSync("./plugins/").forEach((plugin) => {
    if (path.extname(plugin).toLowerCase() == ".js") {
        require("./plugins/" + plugin);
    }
});
console.log('𝐀ʟʟ 𝐏ʟᴜɢɪɴꜱ 𝐈ɴꜱᴛᴀʟʟᴇᴅ ⚡');

const events = require('./command');

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
        console.log('✅ 𝐑ᴇꜱᴛᴏʀᴇ:', sessionId);
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
        console.log('💾 𝐒aved:', sessionId);
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
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version: [2,3000,1033105955],
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
                if (res && !res.headersSent) { res.json({ error: 'Failed to generate pairing code. Try again.' }); responded = true; }
                cleanupSession(sessionId);
                return;
            }
        } else {
            console.log('Already registered:', sessionId);
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

                // --- ALWAYS ONLINE UPDATE ---
                const presenceState = config.ALWAYS_ONLINE ? 'available' : 'unavailable';
                sock.sendPresenceUpdate(presenceState);

                keepAliveTimers[sessionId] = setInterval(async () => {
                    if (!activeSockets[sessionId]) {
                        return;
                    }
                    const stateToSet = config.ALWAYS_ONLINE ? 'available' : 'unavailable';
                    sock.sendPresenceUpdate(stateToSet).catch(() => {});
                }, 30000);

                if (!hasSentConnectMessage) {
                    try {
                        const jid = xnumber + '@s.whatsapp.net';
                        await sock.sendMessage(jid, {
                            image: { url: 'https://files.catbox.moe/78oacy.jpeg' },
                            caption: `╭─── *APEX MINI BOT* ───⬣\n│\n│  ✅ Successfully Reconnected\n│  🔣 Prefix *.*\n│  🔄 Session Restored\n│\n╰──────────────────⬣`
                        });
                        hasSentConnectMessage = true; 
                    } catch (e) {}
                }
            }
        });

        sock.ev.on('messages.upsert', async (mek) => {
            try {
                mek = mek.messages[0];
                if (!mek.message) return;

                mek.message = (getContentType(mek.message) === 'ephemeralMessage')
                    ? mek.message.ephemeralMessage.message
                    : mek.message;

                // --- STATUS HANDLING - AUTO READ & AUTO REACT ---
                if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                    if (config.AUTO_READ_STATUS) {
                        await sock.readMessages([mek.key]);
                    }
                    if (config.AUTO_REACT && mek.key.participant) {
                        try {
                            const emojis = config.REACT_EMOJIS;
                            const reactEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                            await sock.sendMessage(mek.key.remoteJid, {
                                react: { text: reactEmoji, key: mek.key }
                            }, { statusJidList: [mek.key.participant] });
                        } catch (e) {
                            console.log("Status react error: ", e);
                        }
                    }
                    return; // DO NOT process status as a normal command
                }

                const m = typeof sms === 'function' ? sms(sock, mek) : mek;
                const type = getContentType(mek.message);
                const from = mek.key.remoteJid;

                const isGroup = from.endsWith('@g.us');
                const isInbox = from.endsWith('@s.whatsapp.net');

                const body =
                    type === 'conversation' ? mek.message.conversation :
                    type === 'extendedTextMessage' ? mek.message.extendedTextMessage.text :
                    type === 'imageMessage' && mek.message.imageMessage?.caption ? mek.message.imageMessage.caption :
                    type === 'videoMessage' && mek.message.videoMessage?.caption ? mek.message.videoMessage.caption :
                    m.msg?.text || m.msg?.conversation || m.msg?.caption || '';

                const prefix = config.PREFIX || ".";
                const isCmd = body.startsWith(prefix);
                const command = isCmd ? body.slice(prefix.length).trim().split(' ').shift().toLowerCase() : '';
                const args = body.trim().split(/ +/).slice(1);
                const q = args.join(' ');
                
                const sender = mek.key.fromMe ? (sock.user.id.split(':')[0] + '@s.whatsapp.net') : (mek.key.participant || mek.key.remoteJid);
                const senderNumber = sender.split('@')[0];
                const botNumber = sock.user.id.split(':')[0];
                const isMe = botNumber.includes(senderNumber);
                const isOwner = isMe || (xnumber === senderNumber);

                // --- AUTO TYPING FOR CHATS ONLY ---
                if (config.AUTO_TYPING && !isMe) {
                    sock.sendPresenceUpdate('composing', from).catch(() => {});
                    setTimeout(() => sock.sendPresenceUpdate('paused', from).catch(() => {}), 3000);
                }

                const reply = async (teks) => await sock.sendMessage(from, { text: teks }, { quoted: mek });

                if (isCmd) await sock.readMessages([mek.key]);

                const cmdName = isCmd ? body.slice(prefix.length).trim().split(' ')[0].toLowerCase() : false;

                if (isCmd) {
                    const cmd = commandMap.get(cmdName);
                    if (cmd) {
                        
                        // --- WORK TYPE MODE CHECK ---
                        if (!isOwner) {
                            if (config.WORK_TYPE === 'private') {
                                return; // Stop users executing commands if private
                            } else if (config.WORK_TYPE === 'group' && !isGroup) {
                                return; // Stop users if they are not in a group
                            } else if (config.WORK_TYPE === 'inbox' && !isInbox) {
                                return; // Stop users if they are not in inbox messages
                            }
                        }

                        if (cmd.react) sock.sendMessage(from, { react: { text: cmd.react, key: mek.key } });
                        try {
                            cmd.function(sock, mek, m, {
                                from, prefix, body, isCmd,
                                command, args, q, sender, senderNumber,
                                botNumber, isMe, isOwner, reply, isGroup, isInbox
                            });
                        } catch (e) {
                            console.error('[PLUGIN ERROR]', e);
                        }
                    }
                }

                // Handling exact texts/on text commands (like Settings Matcher)
                for (const cmd of events.commands) {
                    try {
                        if (body && cmd.on === 'text') {

                            // --- WORK TYPE MODE CHECK FOR EXACT MATCHES ---
                            if (!isOwner) {
                                if (config.WORK_TYPE === 'private') continue;
                                if (config.WORK_TYPE === 'group' && !isGroup) continue;
                                if (config.WORK_TYPE === 'inbox' && !isInbox) continue;
                            }

                            cmd.function(sock, mek, m, {
                                from, prefix, body, isCmd,
                                command, args, q, sender, senderNumber,
                                botNumber, isMe, isOwner, reply, isGroup, isInbox
                            });
                        }
                    } catch (e) {}
                }

            } catch (e) {
                console.error('[MESSAGE ERROR]', String(e));
            }
        });

    } catch (err) {
        cleanupSession(sessionId);
    }
}

async function restoreAllSessions() {
    try {
        const sessions = await Session.find();
        console.log(`Restoring ${sessions.length} session(s)...`);

        await Promise.all(
            sessions.filter(s => s.sessionId).map(async (s, index) => {
                const number = s.sessionId.replace('dina_', '');
                try {
                    await new Promise(r => setTimeout(r, index * 500));
                    await Pair(number);
                } catch (err) {}
            })
        );
    } catch (err) {}
}

app.get('/pair', async (req, res) => {
    const number = req.query.number;
    if (!number) return res.json({ error: 'Number required' });
    res.setTimeout(30000);
    await Pair(number, res);
});

app.get('/', (req, res) => res.send('Bots Server Running!'));

app.listen(PORT, async () => {
    await fs.ensureDir(SESSION_BASE_PATH);
    await restoreAllSessions();
});

process.on('uncaughtException', (err) => {
    const e = String(err);
    if (e.includes('Socket connection timeout') || e.includes('rate-overlimit') || e.includes('Connection Closed')) return;
});
