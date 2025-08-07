const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { checkPermissions, canModerate } = require('../utils/permissions');
const LogManager = require('../utils/logManager');
const config = require('../config.json');
const logger = require('../utils/logger');

module.exports = {
    name: 'ban',
    description: 'Bir kullanıcıyı sunucudan yasaklar',
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bir kullanıcıyı sunucudan yasaklar')
        .addUserOption(option =>
            option.setName('kullanici')
                .setDescription('Yasaklanacak kullanıcı')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('sebep')
                .setDescription('Yasaklama sebebi')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('mesaj-sil')
                .setDescription('Kaç günlük mesajları silinsin? (0-7)')
                .setMinValue(0)
                .setMaxValue(7)
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

    async execute(message, args, isSlash = false) {
        try {
            let targetUser, reason, deleteMessageDays;
            
            if (isSlash) {
                targetUser = message.options.getUser('kullanici');
                reason = message.options.getString('sebep') || 'Sebep belirtilmedi';
                deleteMessageDays = message.options.getInteger('mesaj-sil') || 0;
            } else {
                if (!args[0]) {
                    return message.reply('❌ Lütfen yasaklanacak kullanıcıyı belirtiniz! Kullanım: `!ban @kullanıcı [sebep]`');
                }
                
                targetUser = message.mentions.users.first() || 
                           await message.guild.members.fetch(args[0]).then(m => m.user).catch(() => null);
                reason = args.slice(1).join(' ') || 'Sebep belirtilmedi';
                deleteMessageDays = 0;
            }

            if (!targetUser) {
                return message.reply('❌ Geçerli bir kullanıcı belirtiniz!');
            }

            // Kullanıcının yetkisini kontrol et
            const authorMember = message.guild.members.cache.get(message.author?.id || message.user.id);
            const permissionCheck = await checkPermissions(authorMember, 'ban');
            
            if (!permissionCheck.hasPermission) {
                return message.reply(`❌ ${permissionCheck.message}`);
            }

            // Hedef kullanıcıyı bul
            const targetMember = message.guild.members.cache.get(targetUser.id);
            
            // Eğer kullanıcı sunucuda ise moderasyon kontrolü yap
            if (targetMember) {
                const moderationCheck = await canModerate(authorMember, targetMember, 'ban');
                if (!moderationCheck.canModerate) {
                    return message.reply(`❌ ${moderationCheck.message}`);
                }

                // Bot'un yetkisini kontrol et
                const botMember = message.guild.members.cache.get(message.client.user.id);
                
                // Sunucu sahibi ise sadece bot'un Discord yetkisini kontrol et
                if (authorMember.id === message.guild.ownerId) {
                    if (!targetMember.bannable) {
                        return message.reply('❌ Bot\'un bu kullanıcıyı yasaklama yetkisi yok! (Kullanıcının rolü bot\'tan yüksek)');
                    }
                } else {
                    // Normal kullanıcılar için tam yetki kontrolü
                    const botModerationCheck = await canModerate(botMember, targetMember, 'ban');
                    if (!botModerationCheck.canModerate) {
                        return message.reply(`❌ Bot'un bu kullanıcıyı yasaklama yetkisi yok: ${botModerationCheck.message}`);
                    }
                }


            }

            // Kullanıcıyı yasakla
            await message.guild.members.ban(targetUser, {
                reason: reason,
                deleteMessageSeconds: deleteMessageDays * 24 * 60 * 60 // Günü saniyeye çevir
            });

            // Başarı mesajı
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setTitle('🔨 Kullanıcı Yasaklandı')
                .addFields(
                    { name: 'Yasaklanan Kullanıcı', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                    { name: 'Yasaklayan Yetkili', value: `${authorMember.user.tag}`, inline: true },
                    { name: 'Sebep', value: reason, inline: false }
                )
                .setTimestamp();

            if (deleteMessageDays > 0) {
                embed.addFields({ name: 'Silinen Mesajlar', value: `${deleteMessageDays} günlük`, inline: true });
            }

            const replyMethod = isSlash ? 'reply' : 'reply';
            await message[replyMethod]({ embeds: [embed] });

            logger.info(`${targetUser.tag} kullanıcısı ${authorMember.user.tag} tarafından yasaklandı. Sebep: ${reason}`);
            
            // Moderasyon log'u gönder
            await LogManager.logModeration(message.guild, authorMember, targetUser, 'Ban', reason);
            
            // Not: Ban abuse tracking artık audit log handler tarafından yapılıyor (tüm ban türleri için)

        } catch (error) {
            logger.error('Ban komutu hatası:', error);
            const replyMethod = isSlash ? 'reply' : 'reply';
            
            if (error.code === 10007) {
                await message[replyMethod]('❌ Bu kullanıcı bulunamadı!');
            } else if (error.code === 50013) {
                await message[replyMethod]('❌ Bu kullanıcıyı yasaklamak için yeterli yetkiye sahip değilim!');
            } else {
                await message[replyMethod]('❌ Kullanıcı yasaklanırken bir hata oluştu!');
            }
        }
    }
};
