const config = require('../Pengaturan/config'); // Impor konfigurasi
const { getRandomImageUrl } = require('../Random_Images_Anime/gambaranimegc'); // Impor getRandomImageUrl
const fs = require('fs'); // Impor fs untuk menyimpan dan memuat data dari file

const spamCounts = loadSpamCounts(); // Menyimpan jumlah spam untuk setiap pengguna
const lastMessageTimes = {}; // Menyimpan waktu pesan terakhir untuk setiap pengguna

function saveSpamCounts() {
  fs.writeFileSync('peringatan_spam.json', JSON.stringify(spamCounts, null, 2));
}

function loadSpamCounts() {
  if (fs.existsSync('peringatan_spam.json')) {
    const data = fs.readFileSync('peringatan_spam.json');
    return JSON.parse(data);
  }
  return {};
}

function resetSpamCount(senderId) {
  if (spamCounts[senderId]) {
    delete spamCounts[senderId];
    saveSpamCounts();
  }
}

function resetAllSpamCounts() {
  for (const senderId in spamCounts) {
    delete spamCounts[senderId];
  }
  saveSpamCounts();
}

if (config.autoResetWarnings) {
  setInterval(resetAllSpamCounts, config.resetWarningInterval);
}

const warningMessagesSpam = [
  (senderId) => `🚫 Peringatan pertama (1/5) @${senderId.split('@')[0]}! Mohon tidak mengirim pesan terlalu cepat di sini. Terima kasih. 🙏`,
  (senderId) => `🚫 Peringatan kedua (2/5) @${senderId.split('@')[0]}! Pesan terlalu cepat tidak diperbolehkan. Mohon kerjasamanya. 🙏`,
  (senderId) => `🚫 Peringatan ketiga (3/5) @${senderId.split('@')[0]}! Tolong hentikan mengirim pesan terlalu cepat. Terima kasih atas pengertiannya. 🙏`,
  (senderId) => `🚫 Peringatan keempat (4/5) @${senderId.split('@')[0]}! Pesan terlalu cepat dilarang di sini. Mohon dipatuhi. 🙏`,
  (senderId) => `🚫 Peringatan terakhir (5/5) @${senderId.split('@')[0]}! Anda akan dikeluarkan jika mengirim pesan terlalu cepat lagi. Mohon pengertiannya. 🙏`
];

async function antispam(client, m) {
  if (config.antispam) {
    const messageType = Object.keys(m.message)[0];
    if (messageType === 'conversation' && m.key.remoteJid.endsWith('@g.us')) {
      try {
        const senderId = m.key.participant || m.key.remoteJid;
        const groupMetadata = await client.groupMetadata(m.key.remoteJid);
        const isAdmin = groupMetadata.participants.some(p => p.id === senderId && (p.admin === 'admin' || p.admin === 'superadmin'));

        const imageUrl = getRandomImageUrl();
        const currentTime = Date.now();

        if (isAdmin) {
          await client.sendMessage(m.key.remoteJid, { 
            image: { url: imageUrl },
            caption: `🚫 @${senderId.split('@')[0]}, Anda adalah admin di grup ini, jadi pesan Anda tidak akan dihapus. Terima kasih telah mematuhi aturan grup. 🙏`, 
            mentions: [senderId], 
            quoted: m 
          });
        } else {
          if (!lastMessageTimes[senderId]) {
            lastMessageTimes[senderId] = currentTime;
          }

          const timeDiff = currentTime - lastMessageTimes[senderId];

          if (timeDiff < 2000) { // Jeda 2 detik
            if (!spamCounts[senderId]) {
              spamCounts[senderId] = 0;
            }
            spamCounts[senderId]++;
            saveSpamCounts();

            if (spamCounts[senderId] > 5) {
              if (config.autoKick) {
                await client.sendMessage(m.key.remoteJid, { 
                  image: { url: imageUrl },
                  caption: `🚫 @${senderId.split('@')[0]} telah dikeluarkan dari grup karena mengirim pesan terlalu cepat lebih dari 5 kali. Mohon untuk tidak mengirim pesan terlalu cepat di sini. Terima kasih. 🙏`, 
                  mentions: [senderId], 
                  quoted: m 
                });
                console.log(`🗑️ @${senderId.split('@')[0]} telah dikeluarkan dari grup ${m.key.remoteJid} karena mengirim pesan terlalu cepat lebih dari 5 kali.`);
                await client.sendMessage(m.key.remoteJid, { delete: m.key });
                console.log(`🗑️ Pesan yang mengandung spam dari @${senderId.split('@')[0]} telah dihapus di grup ${m.key.remoteJid}.`);
                await client.groupParticipantsUpdate(m.key.remoteJid, [senderId], 'remove');
              } else {
                await client.sendMessage(m.key.remoteJid, { 
                  image: { url: imageUrl },
                  caption: `🚫 Waduh, fitur auto kick dimatikan oleh bot. @${senderId.split('@')[0]} tidak dikeluarkan dari grup meskipun mengirim pesan terlalu cepat lebih dari 5 kali. Mohon untuk tidak mengirim pesan terlalu cepat di sini. Terima kasih. 🙏`, 
                  mentions: [senderId], 
                  quoted: m 
                });
                console.log(`🗑️ Fitur auto kick dimatikan oleh bot. @${senderId.split('@')[0]} tidak dikeluarkan dari grup ${m.key.remoteJid} meskipun mengirim pesan terlalu cepat lebih dari 5 kali.`);
                await client.sendMessage(m.key.remoteJid, { delete: m.key });
                console.log(`🗑️ Pesan yang mengandung spam dari @${senderId.split('@')[0]} telah dihapus di grup ${m.key.remoteJid}.`);
              }
            } else {
              const warningMessage = warningMessagesSpam[spamCounts[senderId] - 1](senderId);
              await client.sendMessage(m.key.remoteJid, { 
                image: { url: imageUrl },
                caption: warningMessage, 
                mentions: [senderId], 
                quoted: m 
              });
              await client.sendMessage(m.key.remoteJid, { delete: m.key });
              console.log(`🗑️ Pesan yang mengandung spam dari @${senderId.split('@')[0]} telah dihapus di grup ${m.key.remoteJid}. Peringatan ${spamCounts[senderId]}/5.`);
            }
          } else {
            lastMessageTimes[senderId] = currentTime;
          }
        }
      } catch (error) {
        console.error('⚠️ Terjadi kesalahan saat menghapus spam:', error);
      }
    }
  }
}

module.exports = { antispam };
