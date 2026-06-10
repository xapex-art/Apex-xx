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


functions.js
const axios = require('axios')
const fs = require('fs')
const path = require('path')
const mimes = require('mime-types')
const {fileTypeFromBuffer} = require('file-type')

const getBuffer = async(url, options) => {
	try {
		options ? options : {}
		var res = await axios({
			method: 'get',
			url,
			headers: {
				'DNT': 1,
				'Upgrade-Insecure-Request': 1
			},
			...options,
			responseType: 'arraybuffer'
		})
		return res.data
	} catch (e) {
		console.log(e)
	}
}

const getGroupAdmins = (participants) => {
	var admins = []
	for (let i of participants) {
		i.admin !== null  ? admins.push(i.id) : ''
		if(i.admin) {
			admins.push(i.id)
			admins.push(i.jid)
		}
		
	}
	return admins
} 


const getRandom = (ext) => {
	return `${Math.floor(Math.random() * 10000)}${ext}`
}

const h2k = (eco) => {
	var lyrik = ['', 'K', 'M', 'B', 'T', 'P', 'E']
	var ma = Math.log10(Math.abs(eco)) / 3 | 0
	if (ma == 0) return eco
	var ppo = lyrik[ma]
	var scale = Math.pow(10, ma * 3)
	var scaled = eco / scale
	var formatt = scaled.toFixed(1)
	if (/\.0$/.test(formatt))
		formatt = formatt.substr(0, formatt.length - 2)
	return formatt + ppo
}

const isUrl = (url) => {
	return url.match(
		new RegExp(
			/https?:\/\/(www\.)?[-a-zA-Z0-9@:%.+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%+.~#?&/=]*)/,
			'gi'
		)
	)
}

const Json = (string) => {
    return JSON.stringify(string, null, 2)
}

const runtime = (seconds) => {
	seconds = Number(seconds)
	var d = Math.floor(seconds / (3600 * 24))
	var h = Math.floor(seconds % (3600 * 24) / 3600)
	var m = Math.floor(seconds % 3600 / 60)
	var s = Math.floor(seconds % 60)
	var dDisplay = d > 0 ? d + (d == 1 ? ' day, ' : ' days, ') : ''
	var hDisplay = h > 0 ? h + (h == 1 ? ' hour, ' : ' hours, ') : ''
	var mDisplay = m > 0 ? m + (m == 1 ? ' minute, ' : ' minutes, ') : ''
	var sDisplay = s > 0 ? s + (s == 1 ? ' second' : ' seconds') : ''
	return dDisplay + hDisplay + mDisplay + sDisplay;
}

const sleep = async(ms) => {
	return new Promise(resolve => setTimeout(resolve, ms))
}

const fetchJson = async (url, options) => {
    try {
        options ? options : {}
        const res = await axios({
            method: 'GET',
            url: url,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36'
            },
            ...options
        })
        return res.data
    } catch (err) {
        return err
    }
}

async function getsize(fx) {
function formatBytes(x) {
    let units = ['B', 'KB', 'MB', 'GB', 'TB']
    let bytes = x
    let i;

    for (i = 0; bytes >= 1024 && i < 4; i++) {
        bytes /= 1024;
    }

    return bytes.toFixed(2) + ' ' + units[i];
}
  return formatBytes((await axios.head(fx)).headers['content-length'])
}

function formatBytes(x) {
    let units = ['B', 'KB', 'MB', 'GB', 'TB']
    let bytes = x
    let i;

    for (i = 0; bytes >= 1024 && i < 4; i++) {
        bytes /= 1024;
    }

    return bytes.toFixed(2) + ' ' + units[i];
}

async function formatSize(bytes, si = true, dp = 2) {
	const thresh = si ? 1000 : 1024;

	if (Math.abs(bytes) < thresh) {
	   return `${bytes} B`;
	}

	const units = si
	   ? ["kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
	   : ["KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"];
	let u = -1;
	const r = 10 ** dp;

	do {
	   bytes /= thresh;
	   ++u;
	} while (
	   Math.round(Math.abs(bytes) * r) / r >= thresh &&
	   u < units.length - 1
	);

	return `${bytes.toFixed(dp)} ${units[u]}`;
 }

 async function getFile(url) {
	try {
    	const fileType = require("file-type");
	  const response = await getBuffer(url)
	  let type = await fileType.fromBuffer(response);
	  let savepath = "./" + getRandom('.'+type.ext)
	  await fs.promises.writeFile(savepath, response);
	  return savepath
	} catch (error) {
	  console.error('An error occurred:', error.message);
	}
  }
async function fetchBuffer(string, options = {}) {
	return new Promise(async (resolve, reject) => {
	   try {
		  if (/^https?:\/\//i.test(string)) {
			 let data = await axios.get(string, {
				headers: {
				   ...(!!options.headers ? options.headers : {}),
				},
				responseType: "arraybuffer",
				...options,
			 })
			 let buffer = await data?.data
			 let name = /filename/i.test(data.headers?.get("content-disposition")) ? data.headers?.get("content-disposition")?.match(/filename=(.*)/)?.[1]?.replace(/["';]/g, '') : ''
			 let mime = mimes.lookup(name) || data.headers.get("content-type") || (await fileTypeFromBuffer(buffer))?.mime
			 resolve({
				data: buffer,
				size: Buffer.byteLength(buffer),
				sizeH: formatSize(Buffer.byteLength(buffer)),
				name,
				mime,
				ext: mimes.extension(mime)
			 });
		  } else if (/^data:.*?\/.*?;base64,/i.test(string)) {
			 let data = Buffer.from(string.split`,`[1], "base64")
			 let size = Buffer.byteLength(data)
			 resolve({ data, size, sizeH: formatSize(size), ...((await fileTypeFromBuffer(data)) || { mime: "application/octet-stream", ext: ".bin" }) });
		  } else if (fs.existsSync(string) && fs.statSync(string).isFile()) {
			 let data = fs.readFileSync(string)
			 let size = Buffer.byteLength(data)
			 resolve({ data, size, sizeH: formatSize(size), ...((await fileTypeFromBuffer(data)) || { mime: "application/octet-stream", ext: ".bin" }) });
		  } else if (Buffer.isBuffer(string)) {
			 let size = Buffer?.byteLength(string) || 0
			 resolve({ data: string, size, sizeH: formatSize(size), ...((await fileTypeFromBuffer(string)) || { mime: "application/octet-stream", ext: ".bin" }) });
		  } else if (/^[a-zA-Z0-9+/]={0,2}$/i.test(string)) {
			 let data = Buffer.from(string, "base64")
			 let size = Buffer.byteLength(data)
			 resolve({ data, size, sizeH: formatSize(size), ...((await fileTypeFromBuffer(data)) || { mime: "application/octet-stream", ext: ".bin" }) });
		  } else {
			 let buffer = Buffer.alloc(20)
			 let size = Buffer.byteLength(buffer)
			 resolve({ data: buffer, size, sizeH: formatSize(size), ...((await fileTypeFromBuffer(buffer)) || { mime: "application/octet-stream", ext: ".bin" }) });
		  }
	   } catch (e) {
		  reject(new Error(e?.message || e))
	   }
	});
 }


module.exports = { getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep , fetchJson, getsize, formatBytes, fetchBuffer, formatSize, getFile}
