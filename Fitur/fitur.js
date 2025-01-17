const config = require('../config'); 
const axios = require('axios'); 
const fs = require('fs'); 
const path = require('path'); 
const { getRandomImageUrl } = require('../gambaranimegc'); 
const { resetAllWarningCounts, antilinkgc, antilinkchannel, handleParticipantUpdate } = require('./antigroupchannel'); 

function saveGroupInfo(groupId, data) {
  const dirPath = path.join(__dirname, 'notifgc');
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath);
  }
  const filePath = path.join(dirPath, `group_info_${groupId}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function loadGroupInfo(groupId) {
  const filePath = path.join(__dirname, 'notifgc', `group_info_${groupId}.json`);
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath);
    return JSON.parse(data);
  }
  return { previousDesc: 'Tidak ada deskripsi sebelumnya', previousName: 'Tidak ada nama sebelumnya' };
}

// Fungsi untuk mengirim pesan selamat datang dan selamat tinggal
const sendWelcomeGoodbyeMessage = async (client, groupId, participant, type) => {
  try {
    const participantId = participant.split('@')[0];
    const groupMetadata = await client.groupMetadata(groupId);
    const memberCount = groupMetadata.participants.length;
    const adminCount = groupMetadata.participants.filter(p => p.admin).length;
    const groupOwner = groupMetadata.owner || groupMetadata.participants.find(p => p.admin === 'superadmin').id;
    const creationDate = new Date(groupMetadata.creation * 1000);
    const formattedCreationDate = creationDate.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let messageText = '';
    let imageUrl = '';

    if (type === 'add' && config.welcome) {
      messageText = `Selamat datang @${participantId} di grup kami! Semoga betah ya! 🎉`;
    } else if (type === 'remove' && config.goodbye) {
      messageText = `Selamat tinggal @${participantId}, semoga sukses di tempat yang baru! 🌟`;
    } else {
      return; // Jika fitur dinonaktifkan, keluar dari fungsi
    }

    imageUrl = getRandomImageUrl();

    const caption = `
────────────────────────────
${messageText}
────────────────────────────
Nama Grup: ${groupMetadata.subject} 📛
────────────────────────────
Jumlah Anggota: ${memberCount} 👥
────────────────────────────
Jumlah Admin: ${adminCount} 👮
────────────────────────────
Pembuat Grup: @${groupOwner.split('@')[0]} 👑
────────────────────────────
Grup Dibuat Pada: ${formattedCreationDate} 📅
────────────────────────────
Deskripsi Grup: ${groupMetadata.desc} 📝
────────────────────────────
    `;

    const { default: chalk } = await import('chalk'); // Impor chalk secara dinamis
    await client.sendMessage(groupId, { image: { url: imageUrl }, caption: caption, mentions: [participant, groupOwner] });
    console.log(chalk.green(`Sent ${type === 'add' ? 'welcome' : 'goodbye'} message to ${groupId}`));
  } catch (e) {
    if (e.message.includes('forbidden')) {
      console.error(`Bot tidak memiliki izin untuk mengirim pesan di grup ${groupId}`);
    } else {
      console.error(`Error sending ${type === 'add' ? 'welcome' : 'goodbye'} message:`, e);
      if (!config.continueOnError) throw e;
    }
  }
};

// Fungsi untuk merespon perubahan info grup
const handleGroupInfoChange = async (client, update) => {
  if (config.groupInfoChange) {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const { id, desc, subject, announce, restrict, author } = update;
        const groupMetadata = await client.groupMetadata(id);
        const groupOwner = groupMetadata.owner || groupMetadata.participants.find(p => p.admin === 'superadmin').id;
        const adminCount = groupMetadata.participants.filter(p => p.admin).length;
        const creationDate = new Date(groupMetadata.creation * 1000);
        const formattedCreationDate = creationDate.toLocaleDateString('id-ID', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });

        let changeType = '';
        if (desc) changeType = 'Deskripsi';
        if (subject) changeType = 'Nama Grup';
        if (announce !== undefined) changeType = 'Pengaturan Pengumuman';
        if (restrict !== undefined) changeType = 'Pengaturan Edit Info';

        const previousInfo = loadGroupInfo(id);

        const messageText = `Perubahan ${changeType} grup telah dilakukan oleh admin @${author.split('@')[0]}.`;
        const imageUrl = getRandomImageUrl();

        const caption = `
────────────────────────────
${messageText}
────────────────────────────
Nama Grup Saat Ini: ${groupMetadata.subject} 📛
Nama Grup Sebelumnya: ${previousInfo.previousName} 📛
────────────────────────────
Jumlah Anggota: ${groupMetadata.participants.length} 👥
────────────────────────────
Jumlah Admin: ${adminCount} 👮
────────────────────────────
Pembuat Grup: @${groupOwner.split('@')[0]} 👑
────────────────────────────
Deskripsi Grup Saat Ini: ${groupMetadata.desc} 📝
Deskripsi Grup Sebelumnya: ${previousInfo.previousDesc} 📝
────────────────────────────
Grup Dibuat Pada: ${formattedCreationDate} 📅
────────────────────────────
        `;

        const { default: chalk } = await import('chalk'); // Impor chalk secara dinamis
        await client.sendMessage(id, { image: { url: imageUrl }, caption: caption, mentions: [groupOwner, author] });

        console.log(chalk.green(`Sent group info change message to ${id}`));

        // Simpan informasi grup setelah perubahan
        saveGroupInfo(id, { previousDesc: groupMetadata.desc, previousName: groupMetadata.subject });

        break; // Keluar dari loop jika berhasil
      } catch (e) {
        attempt++;
        if (e.message.includes('Timed Out')) {
          console.error(`Attempt ${attempt} failed: Timed Out. Retrying...`);
        } else {
          console.error(`Error sending group info change message:`, e);
          if (!config.continueOnError) throw e;
          break; // Keluar dari loop jika bukan kesalahan timeout
        }
      }
    }
  }
};

// Fungsi untuk merespon perubahan status admin
const handleAdminStatusChange = async (client, update) => {
  if (config.adminStatusChangeNotification) {
    const { id, participants, action } = update;

    for (const participant of participants) {
      const participantId = participant.split('@')[0];
      const groupMetadata = await client.groupMetadata(id);
      const adminCount = groupMetadata.participants.filter(p => p.admin).length;
      const memberCount = groupMetadata.participants.length;
      const groupOwner = groupMetadata.owner || groupMetadata.participants.find(p => p.admin === 'superadmin').id;
      const creationDate = new Date(groupMetadata.creation * 1000);
      const formattedCreationDate = creationDate.toLocaleDateString('id-ID', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      let messageText = '';
      if (action === 'promote') {
        messageText = `Selamat @${participantId}, Anda telah diangkat menjadi admin oleh @${update.author.split('@')[0]}!`;
      } else if (action === 'demote') {
        messageText = `@${participantId} telah dicabut status adminnya oleh @${update.author.split('@')[0]}.`;
      } else {
        return; // Jika bukan aksi promote atau demote, keluar dari fungsi
      }

      const caption = `
────────────────────────────
${messageText}
────────────────────────────
Jumlah Admin Saat Ini: ${adminCount} 👮
────────────────────────────
Jumlah Anggota: ${memberCount} 👥
────────────────────────────
Grup Dibuat Pada: ${formattedCreationDate} 📅
────────────────────────────
Pembuat Grup: @${groupOwner.split('@')[0]} 👑
────────────────────────────
      `;

      try {
        const ppUrl = await client.profilePictureUrl(participant, 'image');
        const { default: chalk } = await import('chalk'); // Impor chalk secara dinamis
        await client.sendMessage(id, { image: { url: ppUrl }, caption: caption, mentions: [participant, update.author, groupOwner] });
        console.log(chalk.green(`Sent admin status change message to ${id}`));
      } catch (error) {
        if (error.message.includes('item-not-found')) {
          const randomImageUrl = getRandomImageUrl();
          const { default: chalk } = await import('chalk'); // Impor chalk secara dinamis
          await client.sendMessage(id, { image: { url: randomImageUrl }, caption: caption, mentions: [participant, update.author, groupOwner] });
          console.log(chalk.green(`Sent admin status change message to ${id} with random image`));
        } else {
          console.error('Error fetching profile picture:', error);
        }
      }
    }
  }
}

module.exports = { 
  sendWelcomeGoodbyeMessage, 
  handleGroupInfoChange, 
  handleAdminStatusChange,  
};
