// config.js
module.exports = {
    // WORK_TYPE : 'private', 'public', 'group', 'inbox'
    WORK_TYPE: process.env.WORK_TYPE || 'public', 
    ALWAYS_ONLINE: process.env.ALWAYS_ONLINE || false,
    AUTO_TYPING: process.env.AUTO_TYPING || false,
    AUTO_REACT: process.env.AUTO_REACT || false,
    AUTO_READ_STATUS: process.env.AUTO_READ_STATUS || false,
    PREFIX: process.env.PREFIX || '.',
    REACT_EMOJIS: ['❤️', '👍', '😂', '🔥', '✨', '🌸', '✅']
};
