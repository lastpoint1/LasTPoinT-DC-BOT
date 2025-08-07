const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { checkPermissions } = require('../utils/permissions');
const config = require('../config.json');
const logger = require('../utils/logger');

module.exports = {
    name: 'clear',
    description: 'Belirtilen sayıda mesajı siler',
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Belirtilen sayıda mesajı siler')
        .addIntegerOption(option =>
            option.setName('sayi')
                .setDescription('Silinecek mesaj sayısı (1-100)')
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true))
        .addUserOption(option =>
            option.setName('kullanici')
                .setDescription('Sadece belirli bir kullanıcının mesajlarını sil')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

    async execute(message, args, isSlash = false) {
        try {
            let amount, targetUser;
            
            if (isSlash) {
                amount = message.options.getInteger('sayi');
                targetUser = message.options.getUser('kullanici');
            } else {
                if (!args[0] || isNaN(args[0])) {
                    return message.reply('❌ Lütfen geçerli bir sayı belirtiniz! Kullanım: `!clear <sayı> [@kullanıcı]`');
                }
                
                amount = parseInt(args[0]);
                targetUser = message.mentions.users.first();
            }

            if (amount < 1 || amount > 100) {
                return message.reply('❌ Mesaj sayısı 1 ile 100 arasında olmalıdır!');
            }

            // Kullanıcının yetkisini kontrol et
            const authorMember = message.guild.members.cache.get(message.author?.id || message.user.id);
            const permissionCheck = await checkPermissions(authorMember, 'clear');
            
            if (!permissionCheck.hasPermission) {
                return message.reply(`❌ ${permissionCheck.message}`);
            }

            // Bot'un mesaj silme yetkisini kontrol et
            const botPermissions = message.channel.permissionsFor(message.client.user);
            if (!botPermissions.has(PermissionFlagsBits.ManageMessages)) {
                return message.reply('❌ Bu kanalda mesaj silme yetkim yok!');
            }

            // Önce komutu onaylayalım
            const replyMethod = isSlash ? 'reply' : 'reply';
            const confirmMessage = await message[replyMethod]({
                content: '🔄 Mesajlar siliniyor...',
                ephemeral: isSlash
            });

            let deletedCount = 0;
            
            if (targetUser) {
                // Belirli bir kullanıcının mesajlarını sil
                const messages = await message.channel.messages.fetch({ limit: 100 });
                const userMessages = messages.filter(msg => 
                    msg.author.id === targetUser.id && 
                    msg.createdTimestamp > Date.now() - 14 * 24 * 60 * 60 * 1000 // 14 günden eski değil
                ).first(amount);
                
                for (const msg of userMessages.values()) {
                    try {
                        await msg.delete();
                        deletedCount++;
                    } catch (error) {
                        // Mesaj zaten silinmişse veya silinemiyorsa devam et
                        continue;
                    }
                }
            } else {
                // Genel mesaj silme
                const messages = await message.channel.messages.fetch({ 
                    limit: amount + (isSlash ? 0 : 1) // Prefix komutunda komutu da dahil et
                });
                
                // 14 günden eski mesajları filtrele
                const recentMessages = messages.filter(msg => 
                    msg.createdTimestamp > Date.now() - 14 * 24 * 60 * 60 * 1000
                );
                
                if (recentMessages.size === 0) {
                    return confirmMessage.edit('❌ 14 günden eski mesajlar Discord API tarafından silinemez!');
                }
                
                try {
                    // Toplu silme işlemi
                    const messagesToDelete = Array.from(recentMessages.values()).slice(0, amount);
                    if (messagesToDelete.length > 1) {
                        await message.channel.bulkDelete(messagesToDelete);
                        deletedCount = messagesToDelete.length;
                    } else if (messagesToDelete.length === 1) {
                        await messagesToDelete[0].delete();
                        deletedCount = 1;
                    }
                } catch (error) {
                    logger.error('Mesaj silme hatası:', error);
                    return confirmMessage.edit('❌ Mesajlar silinirken bir hata oluştu!');
                }
            }

            // Başarı mesajı
            const embed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('🧹 Mesajlar Silindi')
                .addFields(
                    { name: 'Silinen Mesaj Sayısı', value: deletedCount.toString(), inline: true },
                    { name: 'Yetkili', value: `${authorMember.user.tag}`, inline: true }
                )
                .setTimestamp();

            if (targetUser) {
                embed.addFields({ name: 'Hedef Kullanıcı', value: `${targetUser.tag}`, inline: true });
            }

            // Önce onay mesajını sil
            if (!isSlash) {
                try {
                    await confirmMessage.delete();
                } catch (error) {
                    // Mesaj zaten silinmişse devam et
                }
            }

            // Sonuç mesajını gönder ve 5 saniye sonra sil
            const resultMessage = await message.channel.send({ embeds: [embed] });
            setTimeout(async () => {
                try {
                    await resultMessage.delete();
                } catch (error) {
                    // Mesaj zaten silinmişse sorun yok
                }
            }, 5000);

            // Slash command için edit yapılması gerekiyor
            if (isSlash) {
                await confirmMessage.edit({ embeds: [embed] });
            }

            logger.info(`${authorMember.user.tag} tarafından ${deletedCount} mesaj silindi. Kanal: ${message.channel.name}${targetUser ? ` | Hedef: ${targetUser.tag}` : ''}`);

        } catch (error) {
            logger.error('Clear komutu hatası:', error);
            const replyMethod = isSlash ? 'reply' : 'reply';
            
            if (error.code === 50013) {
                await message[replyMethod]('❌ Mesajları silmek için yeterli yetkiye sahip değilim!');
            } else if (error.code === 50034) {
                await message[replyMethod]('❌ 14 günden eski mesajlar Discord API tarafından silinemez!');
            } else {
                await message[replyMethod]('❌ Mesajlar silinirken bir hata oluştu!');
            }
        }
    }
};
