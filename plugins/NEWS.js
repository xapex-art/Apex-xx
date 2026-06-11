const axios = require('axios');
const { cmd } = require('../command');

// ================= 1. NEWS COMMAND (.news) =================
cmd({
    pattern: "news",
    desc: "Fetch latest Lankadeepa news",
    category: "search",
    react: "📰",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        // Loading React
        await conn.sendMessage(from, { react: { text: "🔄", key: mek.key } });

        // API එකෙන් News ටික ගන්නවා
        const apiUrl = "https://lankadeepa.zone.id/api/news";
        const res = await axios.get(apiUrl);
        
        // API එකේ JSON Structure එක කොහොම ආවත් Data ටික අල්ලගන්නවා
        const newsData = res.data.result || res.data.data || res.data;

        if (!newsData || !Array.isArray(newsData) || newsData.length === 0) {
            return reply("❌ අලුත් පුවත් කිසිවක් සොයාගත නොහැකි විය.");
        }

        // List එක හදනවා
        let listText = `📰 *LANKADEEPA LATEST NEWS* 📰\n\n━━━━━━━━━━━━━━━━━━━\n\n`;
        
        // News ගොඩක් තිබ්බොත් මැසේජ් එක දිග වැඩි වෙන නිසා පළවෙනි News 15 විතරක් පෙන්නනවා
        const limit = Math.min(newsData.length, 15);
        for(let i = 0; i < limit; i++) {
            // API එකෙන් එන Title එක
            let title = newsData[i].title || newsData[i].name || "No Title";
            listText += `*${i + 1}.* ${title}\n\n`;
        }

        listText += `━━━━━━━━━━━━━━━━━━━\n*ඔබට කියවීමට අවශ්‍ය පුවතේ අංකය Reply කරන්න.* 🗞️\n\n> Powered by APEX MINI`;

        // Lankadeepa General Banner එක (API එකේ Banner එකක් නැත්තම් මේක වැටෙයි)
        const bannerUrl = "https://i.ibb.co/3sS7YqV/lankadeepa.jpg";

        // Image එකත් එක්ක List එක යවනවා
        await conn.sendMessage(from, {
            image: { url: bannerUrl },
            caption: listText
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });

    } catch (e) {
        console.error(e);
        reply(`❌ Error fetching news: ${e.message}`);
    }
});


// ================= 2. NUMBER REPLY HANDLER FOR NEWS =================
cmd({
    on: "body"
},
async (conn, mek, m, { from, body, reply }) => {
    try {
        // --- BULLETPROOF TEXT EXTRACTION ---
        let rawInput = body || "";
        if (mek.message?.extendedTextMessage?.text) {
            rawInput = mek.message.extendedTextMessage.text;
        } else if (mek.message?.conversation) {
            rawInput = mek.message.conversation;
        } else if (m?.text) {
            rawInput = m.text;
        }

        const text = rawInput.trim();
        const num = parseInt(text);

        // රිප්ලයි කරලා තියෙන්නේ අංකයක් නම් පමණක් ඉදිරියට යනවා
        if (!isNaN(num)) {
            // Quoted message එක හොයාගැනීම
            const quoted = mek.message?.extendedTextMessage?.contextInfo?.quotedMessage || m?.quoted;
            if (!quoted) return;

            // Caption එක ගන්නවා (Fallback කීපයක් එක්ක)
            let caption = "";
            if (quoted.imageMessage?.caption) caption = quoted.imageMessage.caption;
            else if (quoted.extendedTextMessage?.text) caption = quoted.extendedTextMessage.text;
            else if (quoted.conversation) caption = quoted.conversation;
            else if (m?.quoted?.caption) caption = m.quoted.caption;
            else if (m?.quoted?.text) caption = m.quoted.text;

            // අපේ News List එකටද රිප්ලයි කරේ කියලා හරියටම බලනවා
            if (!caption || !caption.includes("LANKADEEPA LATEST NEWS")) return;

            // වැඩේ පටන් ගත්තා කියලා React එකක් දානවා
            await conn.sendMessage(from, { react: { text: "⏳", key: mek.key } });

            // ආයෙත් API එක Call කරලා අදාළ අංකයේ පුවත ගන්නවා 
            // (මෙහෙම කරන්නේ Memory එකේ තියාගන්නවට වඩා මේක 100%ක් සාර්ථක නිසා)
            const apiUrl = "https://lankadeepa.zone.id/api/news";
            const res = await axios.get(apiUrl);
            const newsData = res.data.result || res.data.data || res.data;

            if (!newsData || !Array.isArray(newsData)) {
                 return reply("❌ Data fetch කිරීමේදී දෝෂයක් ඇතිවිය.");
            }

            // ගහපු අංකයට News එකක් තියෙනවද බලනවා
            if (num < 1 || num > newsData.length) {
                 await conn.sendMessage(from, { react: { text: "❌", key: mek.key } });
                 return reply("❌ කරුණාකර ලිස්ට් එකේ තියෙන නිවැරදි අංකයක් ලබාදෙන්න.");
            }

            // අදාළ News Item එක තෝරාගැනීම (Array එක පටන් ගන්නේ 0 න් නිසා අංකයෙන් 1ක් අඩු කරනවා)
            const selectedNews = newsData[num - 1];
            
            // API එකේ Fields මොන විදිහට ආවත් අල්ලගන්න Fallbacks
            const newsTitle = selectedNews.title || selectedNews.name || "News";
            const newsContent = selectedNews.content || selectedNews.desc || selectedNews.description || selectedNews.news || "විස්තරයක් ලබා දී නැත.";
            const newsDate = selectedNews.date || selectedNews.time || "";
            const newsLink = selectedNews.url || selectedNews.link || "";
            
            // News එකට අදාළ ෆොටෝ එක (නැත්තම් default Lankadeepa ලෝගෝ එක)
            const newsImage = selectedNews.image || selectedNews.img || selectedNews.thumb || "https://i.ibb.co/3sS7YqV/lankadeepa.jpg";

            // ලස්සනට Caption එක හදනවා
            let newsCaption = `📰 *${newsTitle}*\n\n`;
            if (newsDate) newsCaption += `🕒 *Date:* ${newsDate}\n\n`;
            
            newsCaption += `━━━━━━━━━━━━━━━━━━━\n\n${newsContent}\n\n━━━━━━━━━━━━━━━━━━━\n\n`;
            
            if (newsLink) newsCaption += `🔗 *Read More:* ${newsLink}\n\n`;
            newsCaption += `> Powered by APEX MINI`;

            // පුවතේ Photo එකත් එක්ක විස්තරේ යවනවා
            await conn.sendMessage(from, {
                image: { url: newsImage },
                caption: newsCaption
            }, { quoted: mek });

            // Success React
            await conn.sendMessage(from, { react: { text: "✅", key: mek.key } });
        }

    } catch (e) {
        console.error(e);
        reply(`❌ Reply Error: ${e.message}`);
    }
});
