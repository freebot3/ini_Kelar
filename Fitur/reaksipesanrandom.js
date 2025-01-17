// reaksipesanrandom.js
const config = require('../config'); // Impor konfigurasi

const emojis = [
    "🔥", "✨", "🤖", "🌟", "🌞", "🎉", "🎊", "😺",
    "😂", "😉", "😎", "😜", "😇", "😈", "😋", "😛",
    "😅", "😆", "😏", "😐", "😑", "😒", "😓", "😔",
    "😕", "😖", "😗", "😘", "😙", "😚", "😜", "😝" // emot baru
];

async function reaksipesanrandom(client, message) {
    if (message.key.fromMe || message.key.remoteJid.endsWith('@g.us')) {
        return; // Abaikan pesan dari bot sendiri atau dari grup
    }

    const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
    await client.sendMessage(message.key.remoteJid, { react: { text: randomEmoji, key: message.key } });
}

module.exports = { reaksipesanrandom };