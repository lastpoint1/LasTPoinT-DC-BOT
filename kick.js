const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { checkPermissions, canModerate } = require('../utils/permissions');
const LogManager = require('../utils/logManager');
const config = require('../config.json');
const logger = require('../utils/logger');

module.exports = {
    name: 'kick',
    description: 'Bir kullanıcıyı sunucudan atar',
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Bir kullanıcıyı sunucudan atar')
        .addUserOption(option =>
            option.setName('kullanici')
                .setDescription('Atılacak kullanıcı')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('sebep')
                .setDescription('Atma sebebi')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    async execute(message, args, isSlash = false) {
        try {
            let targetUser, reason;
            
            if (isSlash) {
                targetUser = message.options.getUser('kullanici');
                reason = message.options.getString('sebep') || 'Sebep belirtilmedi';
            } else {
                if (!args[0]) {
                    return message.reply('❌ Lütfen atılacak kullanıcıyı belirtiniz! Kullanım: `!kick @kullanıcı [sebep]`');
                }
                
                targetUser = message.mentions.users.first() || 
                           await message.guild.members.fetch(args[0]).then(m => m.user).catch(() => null);
                reason = args.slice(1).join(' ') || 'Sebep belirtilmedi';
            }

            if (!targetUser) {
                return message.reply('❌ Geçerli bir kullanıcı belirtiniz!');
            }

            // Kullanıcının yetkisini kontrol et
            const authorMember = message.guild.members.cache.get(message.author?.id || message.user.id);
            const permissionCheck = await checkPermissions(authorMember, 'kick');
            
            if (!permissionCheck.hasPermission) {
                return message.reply(`❌ ${permissionCheck.message}`);
            }

            // Hedef kullanıcıyı bul
            const targetMember = message.guild.members.cache.get(targetUser.id);
            if (!targetMember) {
                return message.reply('❌ Bu kullanıcı sunucuda bulunamadı!');
            }

            // Moderasyon yetkisi kontrolü
            const moderationCheck = await canModerate(authorMember, targetMember, 'kick');
            if (!moderationCheck.canModerate) {
                return message.reply(`❌ ${moderationCheck.message}`);
            }

            // Bot'un yetkisini kontrol et
            const botMember = message.guild.members.cache.get(message.client.user.id);
            
            // Sunucu sahibi ise sadece bot'un Discord yetkisini kontrol et
            if (authorMember.id === message.guild.ownerId) {
                if (!targetMember.kickable) {
                    return message.reply('❌ Bot\'un bu kullanıcıyı atma yetkisi yok! (Kullanıcının rolü bot\'tan yüksek)');
                }
            } else {
                // Normal kullanıcılar için tam yetki kontrolü
                const botModerationCheck = await canModerate(botMember, targetMember, 'kick');
                if (!botModerationCheck.canModerate) {
                    return message.reply(`❌ Bot'un bu kullanıcıyı atma yetkisi yok: ${botModerationCheck.message}`);
                }
            }

            // Kullanıcıyı at
            await targetMember.kick(reason);

            // Başarı mesajı
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setTitle('✅ Kullanıcı Atıldı')
                .addFields(
                    { name: 'Atılan Kullanıcı', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                    { name: 'Atan Yetkili', value: `${authorMember.user.tag}`, inline: true },
                    { name: 'Sebep', value: reason, inline: false }
                )
                .setTimestamp();

            const replyMethod = isSlash ? 'reply' : 'reply';
            await message[replyMethod]({ embeds: [embed] });

            logger.info(`${targetUser.tag} kullanıcısı ${authorMember.user.tag} tarafından atıldı. Sebep: ${reason}`);
            
            // Moderasyon log'u gönder
            await LogManager.logModeration(message.guild, authorMember, targetUser, 'Kick', reason);

        } catch (error) {
            logger.error('Kick komutu hatası:', error);
            const replyMethod = isSlash ? 'reply' : 'reply';
            await message[replyMethod]('❌ Kullanıcı atılırken bir hata oluştu!');
        }
    }
};
