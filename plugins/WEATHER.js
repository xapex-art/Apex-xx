const { cmd } = require('../command');
const axios = require('axios');

cmd({
    pattern: "weather",
    desc: "Get weather information.",
    category: "search",
    react: "🌦️", // Reacts automatically when the command is run
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    try {
        // If no city name is given (e.g. just typed `.weather`)
        if (!q) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
            return reply(`━━━━━━━━━━━━━━━━━━━\n\n│ \`Example\`\n│ • \`.weather Colombo\`\n\n━━━━━━━━━━━━━━━━━━━`);
        }
        
        // While searching
        await conn.sendMessage(from, { react: { text: '🌦️', key: mek.key } });
        
        const url = `https://api-dark-shan-yt.koyeb.app/search/weather?q=${encodeURIComponent(q)}&apikey=22ff0c2a10e232d3`;
        const response = await axios.get(url);
        
        if (!response.data || !response.data.status) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
            return reply("*City not found or API error!*");
        }
        
        const data = response.data.data;
        
        const city = data.city;
        const country = data.country;
        
        // Fixed [object Object] issue
        const currentTemp = data.temperature.current; 
        const humidity = data.humidity;
        const conditions = data.conditions.description; 
        
        let msg = `*🌦️ WEATHER INFO*

━━━━━━━━━━━━━━━━━━━

│ • \`CITY\` - ${city}, ${country}
│ • \`CONDITION\` - ${conditions}
│ • \`TEMP\` - ${currentTemp}°C
│ • \`HUMIDITY\` - ${humidity}%

━━━━━━━━━━━━━━━━━━━

> \`\`\`Developed by ChiraNx 🌸\`\`\``;

        // Sending only the message without any image
        await conn.sendMessage(from, { text: msg }, { quoted: mek });
        
        // Reacting with success mark at the end
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
        
    } catch (e) {
        console.log(e);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply(`*Error:* ${e.message}`);
    }
});
