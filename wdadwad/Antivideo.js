const config = require('./config'); // Impor konfigurasi dari direktori yang benar
const { getRandomImageUrl } = require('./gambaranimegc'); // Impor getRandomImageUrl dari direktori yang benar
const fs = require('fs'); // Impor fs untuk menyimpan dan memuat data dari file

const warningCounts = loadWarningCounts(); // Menyimpan jumlah peringatan untuk setiap pengguna

function saveWarningCounts() {
  fs.writeFileSync('peringatan_video.json', JSON.stringify(warningCounts, null, 2));
}

function loadWarningCounts() {
  if (fs.existsSync('peringatan_video.json')) {
    const data = fs.readFileSync('peringatan_video.json');
    return JSON.parse(data);
  }
  return {};
}

function resetWarningCount(senderId) {
  if (warningCounts[senderId]) {
    delete warningCounts[senderId];
    saveWarningCounts();
  }
}

function resetAllWarningCounts() {
  for (const senderId in warningCounts) {
    delete warningCounts[senderId];
  }
  saveWarningCounts();
}

if (config.autoResetWarnings) {
  setInterval(resetAllWarningCounts, config.resetWarningInterval);
}

const warningMessagesVideo = [
  (senderId) => `🚫 Peringatan pertama (1/5) @${senderId.split('@')[0]}! Mohon tidak mengirim video di sini. Terima kasih. 🙏`,
  (senderId) => `🚫 Peringatan kedua (2/5) @${senderId.split('@')[0]}! Video tidak diperbolehkan. Mohon kerjasamanya. 🙏`,
  (senderId) => `🚫 Peringatan ketiga (3/5) @${senderId.split('@')[0]}! Tolong hentikan mengirim video. Terima kasih atas pengertiannya. 🙏`,
  (senderId) => `🚫 Peringatan keempat (4/5) @${senderId.split('@')[0]}! Video dilarang di sini. Mohon dipatuhi. 🙏`,
  (senderId) => `🚫 Peringatan terakhir (5/5) @${senderId.split('@')[0]}! Anda akan dikeluarkan jika mengirim video lagi. Mohon pengertiannya. 🙏`
];

async function antivideo(client, m) {
  if (config.antivideo) {
    const messageType = Object.keys(m.message)[0];
    if (messageType === 'videoMessage' && m.key.remoteJid.endsWith('@g.us')) {
      try {
        const senderId = m.key.participant || m.key.remoteJid;
        const groupMetadata = await client.groupMetadata(m.key.remoteJid);
        const isAdmin = groupMetadata.participants.some(p => p.id === senderId && (p.admin === 'admin' || p.admin === 'superadmin'));

        const imageUrl = getRandomImageUrl();

        if (isAdmin) {
          await client.sendMessage(m.key.remoteJid, { 
            image: { url: imageUrl },
            caption: `🚫 @${senderId.split('@')[0]}, Anda adalah admin di grup ini, jadi video Anda tidak akan dihapus. Terima kasih telah mematuhi aturan grup. 🙏`, 
            mentions: [senderId], 
            quoted: m 
          });
        } else {
          if (!warningCounts[senderId]) {
            warningCounts[senderId] = 0;
          }
          warningCounts[senderId]++;
          saveWarningCounts();

          if (warningCounts[senderId] > 5) {
            if (config.autoKick) {
              await client.sendMessage(m.key.remoteJid, { 
                image: { url: imageUrl },
                caption: `🚫 @${senderId.split('@')[0]} telah dikeluarkan dari grup karena mengirim video lebih dari 5 kali. Mohon untuk tidak mengirim video di sini. Terima kasih. 🙏`, 
                mentions: [senderId], 
                quoted: m 
              });
              console.log(`🗑️ @${senderId.split('@')[0]} telah dikeluarkan dari grup ${m.key.remoteJid} karena mengirim video lebih dari 5 kali.`);
              await client.sendMessage(m.key.remoteJid, { delete: m.key });
              console.log(`🗑️ Pesan yang mengandung video dari @${senderId.split('@')[0]} telah dihapus di grup ${m.key.remoteJid}.`);
              await client.groupParticipantsUpdate(m.key.remoteJid, [senderId], 'remove');
            } else {
              await client.sendMessage(m.key.remoteJid, { 
                image: { url: imageUrl },
                caption: `🚫 Waduh, fitur auto kick dimatikan oleh bot. @${senderId.split('@')[0]} tidak dikeluarkan dari grup meskipun mengirim video lebih dari 5 kali. Mohon untuk tidak mengirim video di sini. Terima kasih. 🙏`, 
                mentions: [senderId], 
                quoted: m 
              });
              console.log(`🗑️ Fitur auto kick dimatikan oleh bot. @${senderId.split('@')[0]} tidak dikeluarkan dari grup ${m.key.remoteJid} meskipun mengirim video lebih dari 5 kali.`);
              await client.sendMessage(m.key.remoteJid, { delete: m.key });
              console.log(`🗑️ Pesan yang mengandung video dari @${senderId.split('@')[0]} telah dihapus di grup ${m.key.remoteJid}.`);
            }
          } else {
            const warningMessage = warningMessagesVideo[warningCounts[senderId] - 1](senderId);
            await client.sendMessage(m.key.remoteJid, { 
              image: { url: imageUrl },
              caption: warningMessage, 
              mentions: [senderId], 
              quoted: m 
            });
            await client.sendMessage(m.key.remoteJid, { delete: m.key });
            console.log(`🗑️ Pesan yang mengandung video dari @${senderId.split('@')[0]} telah dihapus di grup ${m.key.remoteJid}. Peringatan ${warningCounts[senderId]}/5.`);
          }
        }
      } catch (error) {
        console.error('⚠️ Terjadi kesalahan saat menghapus video:', error);
      }
    }
  }
}

module.exports = { antivideo };
