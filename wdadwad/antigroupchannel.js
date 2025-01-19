const config = require('./config'); // Impor konfigurasi
const fs = require('fs'); // Impor fs untuk menyimpan dan memuat data dari file
const { getRandomImageUrl } = require('./gambaranimegc'); // Impor getRandomImageUrl

const warningCounts = loadWarningCounts(); // Menyimpan jumlah peringatan untuk setiap pengguna

function saveWarningCounts() {
  fs.writeFileSync('peringatan.json', JSON.stringify(warningCounts, null, 2));
}

function loadWarningCounts() {
  if (fs.existsSync('peringatan.json')) {
    const data = fs.readFileSync('peringatan.json');
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

const warningMessagesGC = [
  (senderId) => `🚫 Peringatan pertama (1/5) @${senderId.split('@')[0]}! Mohon tidak mengirim link grup di sini. Terima kasih. 🙏`,
  (senderId) => `🚫 Peringatan kedua (2/5) @${senderId.split('@')[0]}! Link grup tidak diperbolehkan. Mohon kerjasamanya. 🙏`,
  (senderId) => `🚫 Peringatan ketiga (3/5) @${senderId.split('@')[0]}! Tolong hentikan mengirim link grup. Terima kasih atas pengertiannya. 🙏`,
  (senderId) => `🚫 Peringatan keempat (4/5) @${senderId.split('@')[0]}! Link grup dilarang di sini. Mohon dipatuhi. 🙏`,
  (senderId) => `🚫 Peringatan terakhir (5/5) @${senderId.split('@')[0]}! Anda akan dikeluarkan jika mengirim link lagi. Mohon pengertiannya. 🙏`
];

const warningMessagesChannel = [
  (senderId) => `🚫 Peringatan pertama (1/5) @${senderId.split('@')[0]}! Mohon tidak mengirim link channel di sini. Terima kasih. 🙏`,
  (senderId) => `🚫 Peringatan kedua (2/5) @${senderId.split('@')[0]}! Link channel tidak diperbolehkan. Mohon kerjasamanya. 🙏`,
  (senderId) => `🚫 Peringatan ketiga (3/5) @${senderId.split('@')[0]}! Tolong hentikan mengirim link channel. Terima kasih atas pengertiannya. 🙏`,
  (senderId) => `🚫 Peringatan keempat (4/5) @${senderId.split('@')[0]}! Link channel dilarang di sini. Mohon dipatuhi. 🙏`,
  (senderId) => `🚫 Peringatan terakhir (5/5) @${senderId.split('@')[0]}! Anda akan dikeluarkan jika mengirim link lagi. Mohon pengertiannya. 🙏`
];

// Fungsi untuk menghapus pesan yang mengandung link grup di grup
async function antilinkgc(client, m) {
  if (config.antilinkGC) {
    const linkRegex = /chat\.whatsapp\.com\/[^\s]+/g;
    const groupButtonRegex = /(Lihat group|Bergabung ke group)/i;
    const readmoreRegex = /(readmore|Baca selengkapnya)/i;
    const messageContent = m.message?.conversation || m.message?.extendedTextMessage?.text || m.message?.buttonsResponseMessage?.selectedButtonId || m.message?.listResponseMessage?.singleSelectReply?.selectedRowId || m.message?.templateButtonReplyMessage?.selectedId || '';

    if (m.key.remoteJid.endsWith('@g.us') && (linkRegex.test(messageContent) || groupButtonRegex.test(messageContent) || readmoreRegex.test(messageContent))) {
      try {
        const senderId = m.key.participant || m.key.remoteJid;
        const groupMetadata = await client.groupMetadata(m.key.remoteJid);
        const isAdmin = groupMetadata.participants.some(p => p.id === senderId && (p.admin === 'admin' || p.admin === 'superadmin'));

        const imageUrl = getRandomImageUrl();

        if (isAdmin) {
          await client.sendMessage(m.key.remoteJid, { 
            image: { url: imageUrl },
            caption: `🚫 Kamu admin di grup ini, tenang saja @${senderId.split('@')[0]}. Link grup tidak akan dihapus oleh bot. 😎`, 
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
                caption: `🚫 @${senderId.split('@')[0]} telah dikeluarkan dari grup karena mengirim link grup lebih dari 5 kali. Mohon untuk tidak mengirim link grup di sini. Terima kasih. 🙏`, 
                mentions: [senderId], 
                quoted: m 
              });
              console.log(`🗑️ @${senderId.split('@')[0]} telah dikeluarkan dari grup ${m.key.remoteJid} karena mengirim link grup lebih dari 5 kali.`);
              await client.sendMessage(m.key.remoteJid, { delete: m.key });
              console.log(`🗑️ Pesan yang mengandung Link Group dari @${senderId.split('@')[0]} telah dihapus di grup ${m.key.remoteJid}.`);
              await client.groupParticipantsUpdate(m.key.remoteJid, [senderId], 'remove');
            } else {
              await client.sendMessage(m.key.remoteJid, { 
                image: { url: imageUrl },
                caption: `🚫 Waduh, fitur auto kick dimatikan oleh bot. @${senderId.split('@')[0]} tidak dikeluarkan dari grup meskipun mengirim link grup lebih dari 5 kali. Mohon untuk tidak mengirim link grup di sini. Terima kasih. 🙏`, 
                mentions: [senderId], 
                quoted: m 
              });
              console.log(`🗑️ Fitur auto kick dimatikan oleh bot. @${senderId.split('@')[0]} tidak dikeluarkan dari grup ${m.key.remoteJid} meskipun mengirim link grup lebih dari 5 kali.`);
              await client.sendMessage(m.key.remoteJid, { delete: m.key });
              console.log(`🗑️ Pesan yang mengandung Link Group dari @${senderId.split('@')[0]} telah dihapus di grup ${m.key.remoteJid}.`);
            }
          } else {
            const warningMessage = warningMessagesGC[warningCounts[senderId] - 1](senderId);
            await client.sendMessage(m.key.remoteJid, { 
              image: { url: imageUrl },
              caption: warningMessage, 
              mentions: [senderId], 
              quoted: m 
            });
            await client.sendMessage(m.key.remoteJid, { delete: m.key });
            console.log(`🗑️ Pesan yang mengandung Link Group dari @${senderId.split('@')[0]} telah dihapus di grup ${m.key.remoteJid}. Peringatan ${warningCounts[senderId]}/5.`);
          }
        }
      } catch (error) {
        console.error('⚠️ Terjadi kesalahan saat menghapus pesan yang mengandung Link Group:', error);
      }
    }
  }
}

// Fungsi untuk menghapus pesan yang mengandung link channel di grup
async function antilinkchannel(client, m) {
  if (config.antilinkChannel) {
    const linkRegex = /whatsapp\.com\/channel\/[^\s]+/g;
    const messageContent = m.message?.conversation || m.message?.extendedTextMessage?.text || m.message?.buttonsResponseMessage?.selectedButtonId || m.message?.listResponseMessage?.singleSelectReply?.selectedRowId || m.message?.templateButtonReplyMessage?.selectedId || '';

    if (m.key.remoteJid.endsWith('@g.us') && linkRegex.test(messageContent)) {
      try {
        const senderId = m.key.participant || m.key.remoteJid;
        const groupMetadata = await client.groupMetadata(m.key.remoteJid);
        const isAdmin = groupMetadata.participants.some(p => p.id === senderId && (p.admin === 'admin' || p.admin === 'superadmin'));

        const imageUrl = getRandomImageUrl();

        if (isAdmin) {
          await client.sendMessage(m.key.remoteJid, { 
            image: { url: imageUrl },
            caption: `🚫 Kamu admin di grup ini, tenang saja @${senderId.split('@')[0]}. Link channel tidak akan dihapus oleh bot. 😎`, 
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
                caption: `🚫 @${senderId.split('@')[0]} telah dikeluarkan dari grup karena mengirim link channel lebih dari 5 kali. Mohon untuk tidak mengirim link channel di sini. Terima kasih. 🙏`, 
                mentions: [senderId], 
                quoted: m 
              });
              console.log(`🗑️ @${senderId.split('@')[0]} telah dikeluarkan dari grup ${m.key.remoteJid} karena mengirim link channel lebih dari 5 kali.`);
              await client.sendMessage(m.key.remoteJid, { delete: m.key });
              console.log(`🗑️ Pesan yang mengandung Link Channel dari @${senderId.split('@')[0]} telah dihapus di grup ${m.key.remoteJid}.`);
              await client.groupParticipantsUpdate(m.key.remoteJid, [senderId], 'remove');
            } else {
              await client.sendMessage(m.key.remoteJid, { 
                image: { url: imageUrl },
                caption: `🚫 Waduh, fitur auto kick dimatikan oleh bot. @${senderId.split('@')[0]} tidak dikeluarkan dari grup meskipun mengirim link channel lebih dari 5 kali. Mohon untuk tidak mengirim link channel di sini. Terima kasih. 🙏`, 
                mentions: [senderId], 
                quoted: m 
              });
              console.log(`🗑️ Fitur auto kick dimatikan oleh bot. @${senderId.split('@')[0]} tidak dikeluarkan dari grup ${m.key.remoteJid} meskipun mengirim link channel lebih dari 5 kali.`);
              await client.sendMessage(m.key.remoteJid, { delete: m.key });
              console.log(`🗑️ Pesan yang mengandung Link Channel dari @${senderId.split('@')[0]} telah dihapus di grup ${m.key.remoteJid}.`);
            }
          } else {
            const warningMessage = warningMessagesChannel[warningCounts[senderId] - 1](senderId);
            await client.sendMessage(m.key.remoteJid, { 
              image: { url: imageUrl },
              caption: warningMessage, 
              mentions: [senderId], 
              quoted: m 
            });
            await client.sendMessage(m.key.remoteJid, { delete: m.key });
            console.log(`🗑️ Pesan yang mengandung Link Channel dari @${senderId.split('@')[0]} telah dihapus di grup ${m.key.remoteJid}. Peringatan ${warningCounts[senderId]}/5.`);
          }
        }
      } catch (error) {
        console.error('⚠️ Terjadi kesalahan saat menghapus pesan yang mengandung Link Channel:', error);
      }
    }
  }
}

// Fungsi untuk mereset peringatan ketika seseorang keluar dan masuk lagi ke grup
async function handleParticipantUpdate(client, update) {
  const { id, participants, action } = update;
  if (action === 'remove' || action === 'add') {
    for (const participant of participants) {
      resetWarningCount(participant);
    }
  }
}

module.exports = { resetAllWarningCounts, antilinkgc, antilinkchannel, handleParticipantUpdate };
