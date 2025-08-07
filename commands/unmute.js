const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { checkPermissions, canModerate } = require('../utils/permissions');
const LogManager = require('../utils/logManager');
const config = require('../config.json');
const logger = require('../utils/logger');

module.exports = {
    name: 'unmute',
    description: 'Bir kullanıcının susturmasını kaldırır',
    data: new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Bir kullanıcının susturmasını kaldırır')
        .addUserOption(option =>
            option.setName('kullanici')
                .setDescription('Susturması kaldırılacak kullanıcı')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('sebep')
                .setDescription('Susturmayı kaldırma sebebi')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(message, args, isSlash = false) {
        try {
            let targetUser, reason;
            
            if (isSlash) {
                targetUser = message.options.getUser('kullanici');
                reason = message.options.getString('sebep') || 'Sebep belirtilmedi';
            } else {
                if (!args[0]) {
                    return message.reply('❌ Lütfen susturması kaldırılacak kullanıcıyı belirtiniz! Kullanım: `!unmute @kullanıcı [sebep]`');
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
            const permissionCheck = await checkPermissions(authorMember, 'mute');
            
            if (!permissionCheck.hasPermission) {
                return message.reply(`❌ ${permissionCheck.message}`);
            }

            // Hedef kullanıcıyı bul
            const targetMember = message.guild.members.cache.get(targetUser.id);
            if (!targetMember) {
                return message.reply('❌ Bu kullanıcı sunucuda bulunamadı!');
            }

            // Moderasyon yetkisi kontrolü
            const moderationCheck = await canModerate(authorMember, targetMember, 'mute');
            if (!moderationCheck.canModerate) {
                return message.reply(`❌ ${moderationCheck.message}`);
            }

            // Bot'un yetkisini kontrol et
            const botMember = message.guild.members.cache.get(message.client.user.id);
            const botModerationCheck = await canModerate(botMember, targetMember, 'mute');
            if (!botModerationCheck.canModerate) {
                return message.reply(`❌ Bot'un bu kullanıcının susturmasını kaldırma yetkisi yok: ${botModerationCheck.message}`);
            }

            // Kullanıcının susturulup susturulmadığını kontrol et
            if (!targetMember.communicationDisabledUntil || targetMember.communicationDisabledUntil < new Date()) {
                return message.reply('❌ Bu kullanıcı zaten susturulmamış!');
            }

            // Susturmayı kaldır
            await targetMember.timeout(null, reason);

            // Başarı mesajı
            const embed = new EmbedBuilder()
                .setColor('#2ecc71') // Yeşil renk
                .setTitle('🔊 Susturma Kaldırıldı')
                .addFields(
                    { name: 'Kullanıcı', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                    { name: 'Yetkili', value: `${authorMember.user.tag}`, inline: true },
                    { name: 'Sebep', value: reason, inline: false }
                )
                .setTimestamp();

            const replyMethod = isSlash ? 'reply' : 'reply';
            await message[replyMethod]({ embeds: [embed] });

            logger.info(`${targetUser.tag} kullanıcısının susturması ${authorMember.user.tag} tarafından kaldırıldı. Sebep: ${reason}`);

        } catch (error) {
            logger.error('Unmute komutu hatası:', error);
            const replyMethod = isSlash ? 'reply' : 'reply';
            
            if (error.code === 50013) {
                await message[replyMethod]('❌ Bu kullanıcının susturmasını kaldırmak için yeterli yetkiye sahip değilim!');
            } else {
                await message[replyMethod]('❌ Kullanıcının susturması kaldırılırken bir hata oluştu!');
            }
        }
    }
};
