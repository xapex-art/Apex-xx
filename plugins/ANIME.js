const { cmd } = require('../command');
const axios = require('axios');

// Users ලා reply කරන messages අල්ලගන්න මේ object එක පාවිච්චි කරනවා
const activeSelections = {};
let listenerRegistered = false;

cmd({
    pattern: "anime",
    alias: ["animemovie"],
    desc: "Search and download anime movies/tv shows",
    category: "search",
    react: "🎬",
    filename: __filename
},
async (conn, mek, m, { from, q, reply, sender }) => {
    try {
        if (!q) return reply(`━━━━━━━━━━━━━━━━━━━\n\n│ \`Example\`\n│ • \`.anime solo leveling\`\n│ • \`.anime naruto\`\n\n━━━━━━━━━━━━━━━━━━━`);
        
        // 🔄 React with loading
        await conn.sendMessage(from, { react: { text: "🔄", key: mek.key } });
        
        const apiUrl = `https://dumiyh-ofc-anime-club2-api.vercel.app/api/search?q=${encodeURIComponent(q)}`;
        const response = await axios.get(apiUrl);
        const resData = response.data;
        
        if (!resData || !resData.status || !resData.data || resData.data.length === 0) {
            await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
            return reply(`❌ *No movies or TV shows found for '${q}'!*`);
        }

        const items = resData.data;

        let listText = `*🎬 ANIME CLUB SEARCH*
━━━━━━━━━━━━━━━━━━━
*🔍 Results for:* ${q}

`;

        items.forEach((item, index) => {
            listText += `*${index + 1}.* ${item.title} (${item.info || item.type})\n`;
        });

        listText += `\n━━━━━━━━━━━━━━━━━━━\n*reply this message with number 🪄*`; // Reply instruction

        // Send image and the list
        let sentMsg;
        if (items[0].image) {
            sentMsg = await conn.sendMessage(from, { image: { url: items[0].image }, caption: listText }, { quoted: mek });
        } else {
            sentMsg = await conn.sendMessage(from, { text: listText }, { quoted: mek });
        }

        // ✅ React when list is sent
        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

        // Store data to catch the reply
        const msgId = sentMsg.key.id;
        activeSelections[msgId] = {
            type: 'search',
            data: items,
            sender: sender
        };

        // ----------------------------------------------------
        // REGISTER EVENT LISTENER (TO CATCH REPLIES)
        // ----------------------------------------------------
        if (!listenerRegistered) {
            listenerRegistered = true;
            conn.ev.on('messages.upsert', async (msgUpdate) => {
                try {
                    const replyMek = msgUpdate.messages[0];
                    if (!replyMek.message || !replyMek.message.extendedTextMessage) return;

                    const body = replyMek.message.extendedTextMessage.text;
                    const quotedMsgId = replyMek.message.extendedTextMessage.contextInfo.stanzaId;
                    const replySender = replyMek.key.participant || replyMek.key.remoteJid;
                    const replyFrom = replyMek.key.remoteJid;

                    // Check if the user is replying to our bot's message!
                    if (activeSelections[quotedMsgId]) {
                        const session = activeSelections[quotedMsgId];
                        
                        // Prevent other group members from pressing numbers
                        if (session.sender && session.sender !== replySender) return;

                        const selectedNum = parseInt(body.trim());

                        // ==========================================
                        // STAGE 1: MOVIE SELECTION -> SENDING DETAILS
                        // ==========================================
                        if (session.type === 'search') {
                            if (isNaN(selectedNum) || selectedNum < 1 || selectedNum > session.data.length) {
                                return conn.sendMessage(replyFrom, { text: "❌ Invalid number. Please reply with a correct number." }, { quoted: replyMek });
                            }

                            const selectedItem = session.data[selectedNum - 1];
                            const url = selectedItem.url;

                            await conn.sendMessage(replyFrom, { react: { text: "🔄", key: replyMek.key } });

                            const detailsUrl = `https://dumiyh-ofc-anime-club2-api.vercel.app/api/details?url=${encodeURIComponent(url)}`;
                            const detailsRes = await axios.get(detailsUrl);
                            const detailsData = detailsRes.data;

                            if (!detailsData.status || !detailsData.data) {
                                await conn.sendMessage(replyFrom, { react: { text: "❌", key: replyMek.key } });
                                return conn.sendMessage(replyFrom, { text: "❌ Could not fetch details." }, { quoted: replyMek });
                            }

                            const itemDetails = detailsData.data;
                            const downloads = itemDetails.downloads;

                            // Handle shows/movies with no download links
                            if (!downloads || !Array.isArray(downloads) || downloads.length === 0) {
                                await conn.sendMessage(replyFrom, { react: { text: "❌", key: replyMek.key } });
                                return conn.sendMessage(replyFrom, { text: "❌ No direct download links found for this movie/show." }, { quoted: replyMek });
                            }

                            let dlText = `*🎬 DETAILS & DOWNLOADS*
━━━━━━━━━━━━━━━━━━━

*🎥 Title:* ${itemDetails.title}
*📝 Description:* ${itemDetails.description || "N/A"}

*📥 Download Options:*
`;
                            downloads.forEach((dl, idx) => {
                                dlText += `*${idx + 1}.* ${dl.quality} (${dl.language || "Unknown"})\n`;
                            });

                            dlText += `\n━━━━━━━━━━━━━━━━━━━\n*reply this message with number 🪄*`;

                            // Send new Details message with Movie Poster
                            const detailsMsg = await conn.sendMessage(replyFrom, { image: { url: itemDetails.image || selectedItem.image }, caption: dlText }, { quoted: replyMek });

                            // Add new reply listener to catch Download quality selection
                            activeSelections[detailsMsg.key.id] = {
                                type: 'download',
                                data: {
                                    title: itemDetails.title,
                                    downloads: downloads
                                },
                                sender: replySender
                            };
                            
                            await conn.sendMessage(replyFrom, { react: { text: "✅", key: replyMek.key } });

                        // ==========================================
                        // STAGE 2: QUALITY SELECTION -> SEND DOCUMENT
                        // ==========================================
                        } else if (session.type === 'download') {
                            if (isNaN(selectedNum) || selectedNum < 1 || selectedNum > session.data.downloads.length) {
                                return conn.sendMessage(replyFrom, { text: "❌ Invalid option number." }, { quoted: replyMek });
                            }

                            const selectedDl = session.data.downloads[selectedNum - 1];

                            // ⬇️ React while downloading
                            await conn.sendMessage(replyFrom, { react: { text: "⬇️", key: replyMek.key } });
                            await conn.sendMessage(replyFrom, { text: `*Downloading ${session.data.title} - ${selectedDl.quality} ...*\n_Please wait, this might take some time depending on file size._` }, { quoted: replyMek });

                            // Sending the final movie/document
                            await conn.sendMessage(replyFrom, { 
                                document: { url: selectedDl.url }, 
                                mimetype: 'video/mp4', // Common video mime-type
                                fileName: `${session.data.title} - ${selectedDl.quality}.mp4`,
                                caption: `*🎬 Title:* ${session.data.title}\n*📺 Quality:* ${selectedDl.quality}\n\n> \`\`\`Downloaded via AnimeClub2 API\`\`\``
                            }, { quoted: replyMek });

                            // ✅ React when finished
                            await conn.sendMessage(replyFrom, { react: { text: "✅", key: replyMek.key } });
                        }
                    }
                } catch (err) {
                    console.log("Error in reply listener:", err);
                }
            });
        }
        
    } catch (e) {
        console.log(e);
        await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
        reply(`❌ Error: ${e.response ? e.response.data.message || 'API Error' : e.message || e}`);
    }
});
