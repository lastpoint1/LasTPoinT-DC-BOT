const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { checkPermissions, canModerate } = require('../utils/permissions');
const LogManager = require('../utils/logManager');
const config = require('../config.json');
const logger = require('../utils/logger');

module.exports = {
    name: 'mute',
    description: 'Bir kullanıcıyı susturur',
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Bir kullanıcıyı susturur')
        .addUserOption(option =>
            option.setName('kullanici')
                .setDescription('Susturulacak kullanıcı')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('sure')
                .setDescription('Susturma süresi (dakika)')
                .setMinValue(1)
                .setMaxValue(10080)
                .setRequired(false))
        .addStringOption(option =>
            option.setName('sebep')
                .setDescription('Susturma sebebi')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(message, args, isSlash = false) {
        try {
            let targetUser, duration, reason;
            
            if (isSlash) {
                targetUser = message.options.getUser('kullanici');
                duration = message.options.getInteger('sure') || 60; // Varsayılan 60 dakika
                reason = message.options.getString('sebep') || 'Sebep belirtilmedi';
            } else {
                if (!args[0]) {
                    return message.reply('❌ Lütfen susturulacak kullanıcıyı belirtiniz! Kullanım: `!mute @kullanıcı [süre(dk)] [sebep]`');
                }
                
                targetUser = message.mentions.users.first() || 
                           await message.guild.members.fetch(args[0]).then(m => m.user).catch(() => null);
                duration = parseInt(args[1]) || 60;
                reason = args.slice(2).join(' ') || 'Sebep belirtilmedi';
            }

            if (!targetUser) {
                return message.reply('❌ Geçerli bir kullanıcı belirtiniz!');
            }

            if (duration > 10080) { // 7 gün maksimum
                return message.reply('❌ Susturma süresi maksimum 10080 dakika (7 gün) olabilir!');
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
                return message.reply(`❌ Bot'un bu kullanıcıyı susturma yetkisi yok: ${botModerationCheck.message}`);
            }

            // Kullanıcının zaten susturulup susturulmadığını kontrol et
            if (targetMember.communicationDisabledUntil && targetMember.communicationDisabledUntil > new Date()) {
                return message.reply('❌ Bu kullanıcı zaten susturulmuş!');
            }

            // Susturma süresini hesapla
            const timeoutDuration = duration * 60 * 1000; // Dakikayı milisaniyeye çevir
            const timeoutUntil = new Date(Date.now() + timeoutDuration);

            // Kullanıcıyı sustur
            await targetMember.timeout(timeoutDuration, reason);

            // Süre formatını hazırla
            const formatDuration = (minutes) => {
                if (minutes < 60) return `${minutes} dakika`;
                const hours = Math.floor(minutes / 60);
                const remainingMinutes = minutes % 60;
                if (hours < 24) {
                    return remainingMinutes > 0 ? `${hours} saat ${remainingMinutes} dakika` : `${hours} saat`;
                }
                const days = Math.floor(hours / 24);
                const remainingHours = hours % 24;
                return remainingHours > 0 ? `${days} gün ${remainingHours} saat` : `${days} gün`;
            };

            // Başarı mesajı
            const embed = new EmbedBuilder()
                .setColor(config.embedColor)
                .setTitle('🔇 Kullanıcı Susturuldu')
                .addFields(
                    { name: 'Susturulan Kullanıcı', value: `${targetUser.tag} (${targetUser.id})`, inline: true },
                    { name: 'Susturan Yetkili', value: `${authorMember.user.tag}`, inline: true },
                    { name: 'Süre', value: formatDuration(duration), inline: true },
                    { name: 'Bitiş Zamanı', value: `<t:${Math.floor(timeoutUntil.getTime() / 1000)}:F>`, inline: true },
                    { name: 'Sebep', value: reason, inline: false }
                )
                .setTimestamp();

            const replyMethod = isSlash ? 'reply' : 'reply';
            await message[replyMethod]({ embeds: [embed] });

            logger.info(`${targetUser.tag} kullanıcısı ${authorMember.user.tag} tarafından ${duration} dakika susturuldu. Sebep: ${reason}`);

        } catch (error) {
            logger.error('Mute komutu hatası:', error);
            const replyMethod = isSlash ? 'reply' : 'reply';
            
            if (error.code === 50013) {
                await message[replyMethod]('❌ Bu kullanıcıyı susturmak için yeterli yetkiye sahip değilim!');
            } else {
                await message[replyMethod]('❌ Kullanıcı susturulurken bir hata oluştu!');
            }
        }
    }
};
