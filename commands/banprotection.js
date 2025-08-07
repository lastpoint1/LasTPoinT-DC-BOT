const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { checkPermissions } = require('../utils/permissions');
const config = require('../config.json');
const logger = require('../utils/logger');

// Ban abuse koruması ayarları
const banAbuseSettings = new Map();
const banHistory = new Map(); // userId -> [banTimes]

module.exports = {
    name: 'banprotection',
    description: 'Ban kötüye kullanım korumasını yönetir',
    data: new SlashCommandBuilder()
        .setName('banprotection')
        .setDescription('Ban kötüye kullanım korumasını yönetir')
        .addSubcommand(subcommand =>
            subcommand
                .setName('enable')
                .setDescription('Ban abuse korumasını etkinleştirir')
                .addIntegerOption(option =>
                    option.setName('ban-limiti')
                        .setDescription('Kaç ban atarsa alarm versin (varsayılan: 3)')
                        .setMinValue(2)
                        .setMaxValue(10)
                        .setRequired(false))
                .addIntegerOption(option =>
                    option.setName('sure')
                        .setDescription('Kaç dakika içinde kontrol edilsin (varsayılan: 3)')
                        .setMinValue(1)
                        .setMaxValue(60)
                        .setRequired(false))
                .addStringOption(option =>
                    option.setName('ceza')
                        .setDescription('Limit aşılırsa ne yapılsın?')
                        .addChoices(
                            { name: 'Uyarı Ver', value: 'warn' },
                            { name: 'Kick At', value: 'kick' },
                            { name: 'Ban Ver', value: 'ban' },
                            { name: 'Tüm Rolleri Al', value: 'removeall' }
                        )
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Ban abuse korumasını devre dışı bırakır'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Ban abuse koruması durumunu gösterir'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('history')
                .setDescription('Ban geçmişini gösterir')
                .addUserOption(option =>
                    option.setName('kullanici')
                        .setDescription('Ban geçmişi görüntülenecek kullanıcı')
                        .setRequired(false)))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(message, args, isSlash = false) {
        try {
            let subcommand, banLimit, timeLimit, punishment, targetUser;
            
            if (isSlash) {
                subcommand = message.options.getSubcommand();
                banLimit = message.options.getInteger('ban-limiti') || 3;
                timeLimit = message.options.getInteger('sure') || 3;
                punishment = message.options.getString('ceza') || 'warn';
                targetUser = message.options.getUser('kullanici');
            } else {
                if (!args[0]) {
                    return message.reply('❌ Lütfen bir alt komut belirtiniz! Kullanım: `!banprotection <enable/disable/status/history>`');
                }
                
                subcommand = args[0].toLowerCase();
                banLimit = parseInt(args[1]) || 3;
                timeLimit = parseInt(args[2]) || 3;
                punishment = args[3] || 'warn';
            }

            // Yetki kontrolü - Sadece sunucu sahibi
            const authorMember = message.guild.members.cache.get(message.author?.id || message.user.id);
            if (authorMember.id !== message.guild.ownerId) {
                return message.reply('❌ Bu güvenlik komutu sadece sunucu sahibi tarafından kullanılabilir.');
            }

            const guildId = message.guild.id;
            const replyMethod = isSlash ? 'reply' : 'reply';

            switch (subcommand) {
                case 'enable':
                case 'etkinlestir':
                    banAbuseSettings.set(guildId, {
                        enabled: true,
                        banLimit: banLimit,
                        timeLimit: timeLimit * 60 * 1000, // Dakikayı milisaniyeye çevir
                        punishment: punishment
                    });

                    const punishmentText = {
                        'warn': 'Uyarı Verilecek',
                        'kick': 'Sunucudan Atılacak',
                        'ban': 'Yasaklanacak',
                        'removeall': 'Tüm Rolleri Alınacak'
                    };

                    const enableEmbed = new EmbedBuilder()
                        .setColor('#e67e22')
                        .setTitle('🛡️ Ban Abuse Koruması Etkinleştirildi')
                        .addFields(
                            { name: 'Ban Limiti', value: `${banLimit} ban`, inline: true },
                            { name: 'Zaman Sınırı', value: `${timeLimit} dakika`, inline: true },
                            { name: 'Ceza', value: punishmentText[punishment], inline: true }
                        )
                        .setDescription(`Bir moderatör ${timeLimit} dakika içinde ${banLimit} kişiyi banlarsa ${punishmentText[punishment].toLowerCase()}.`)
                        .setTimestamp();

                    await message[replyMethod]({ embeds: [enableEmbed] });
                    logger.info(`${authorMember.user.tag} tarafından ban abuse koruması etkinleştirildi. ${banLimit} ban / ${timeLimit} dakika`);
                    break;

                case 'disable':
                case 'devredisinibrak':
                    if (!banAbuseSettings.has(guildId)) {
                        return message[replyMethod]('❌ Ban abuse koruması zaten devre dışı!');
                    }

                    banAbuseSettings.delete(guildId);

                    const disableEmbed = new EmbedBuilder()
                        .setColor('#95a5a6')
                        .setTitle('🛡️ Ban Abuse Koruması Devre Dışı Bırakıldı')
                        .setDescription('Ban abuse koruması artık devre dışı.')
                        .setTimestamp();

                    await message[replyMethod]({ embeds: [disableEmbed] });
                    logger.info(`${authorMember.user.tag} tarafından ban abuse koruması devre dışı bırakıldı.`);
                    break;

                case 'status':
                case 'durum':
                    const settings = banAbuseSettings.get(guildId);
                    
                    if (!settings || !settings.enabled) {
                        const statusEmbed = new EmbedBuilder()
                            .setColor('#95a5a6')
                            .setTitle('🛡️ Ban Abuse Koruması Durumu')
                            .setDescription('❌ **Devre Dışı**')
                            .setTimestamp();

                        return message[replyMethod]({ embeds: [statusEmbed] });
                    }

                    const punishmentTextStatus = {
                        'warn': 'Uyarı Verilecek',
                        'kick': 'Sunucudan Atılacak',
                        'ban': 'Yasaklanacak',
                        'removeall': 'Tüm Rolleri Alınacak'
                    };

                    const activeEmbed = new EmbedBuilder()
                        .setColor('#e67e22')
                        .setTitle('🛡️ Ban Abuse Koruması Durumu')
                        .setDescription('✅ **Aktif ve Çalışıyor**')
                        .addFields(
                            { name: 'Ban Limiti', value: `${settings.banLimit} ban`, inline: true },
                            { name: 'Zaman Sınırı', value: `${settings.timeLimit / 60000} dakika`, inline: true },
                            { name: 'Ceza Türü', value: punishmentTextStatus[settings.punishment], inline: true }
                        )
                        .setTimestamp();

                    await message[replyMethod]({ embeds: [activeEmbed] });
                    break;

                case 'history':
                case 'gecmis':
                    const userId = targetUser ? targetUser.id : (message.author?.id || message.user.id);
                    const userBanHistory = banHistory.get(`${guildId}_${userId}`) || [];
                    
                    const historyEmbed = new EmbedBuilder()
                        .setColor('#3498db')
                        .setTitle('📊 Ban Geçmişi')
                        .setDescription(targetUser ? `**${targetUser.tag}** kullanıcısının ban geçmişi:` : 'Sizin ban geçmişiniz:');

                    if (userBanHistory.length === 0) {
                        historyEmbed.addFields({ name: 'Geçmiş', value: 'Henüz hiç ban işlemi yapılmamış.', inline: false });
                    } else {
                        const recentBans = userBanHistory.slice(-10); // Son 10 ban
                        const banList = recentBans.map((banTime, index) => {
                            const date = new Date(banTime);
                            return `${index + 1}. ${date.toLocaleString('tr-TR')}`;
                        }).join('\n');

                        historyEmbed.addFields(
                            { name: 'Toplam Ban Sayısı', value: userBanHistory.length.toString(), inline: true },
                            { name: 'Son 10 Ban', value: banList || 'Veri yok', inline: false }
                        );
                    }

                    historyEmbed.setTimestamp();
                    await message[replyMethod]({ embeds: [historyEmbed] });
                    break;

                default:
                    return message[replyMethod]('❌ Geçersiz alt komut! Kullanım: `!banprotection <enable/disable/status/history>`');
            }

        } catch (error) {
            logger.error('Ban protection komutu hatası:', error);
            const replyMethod = isSlash ? 'reply' : 'reply';
            await message[replyMethod]('❌ Ban koruması komutu çalıştırılırken bir hata oluştu!');
        }
    }
};

/**
 * Ban abuse kontrolü - ban komutunda kullanılacak
 */
async function trackBanUsage(guild, moderatorId, targetUserId) {
    const guildId = guild.id;
    const settings = banAbuseSettings.get(guildId);
    
    if (!settings || !settings.enabled) {
        return { violated: false };
    }

    // Sunucu sahibi muaf
    if (moderatorId === guild.ownerId) {
        return { violated: false };
    }

    const historyKey = `${guildId}_${moderatorId}`;
    const now = Date.now();
    
    // Mevcut ban geçmişini al
    let userBanHistory = banHistory.get(historyKey) || [];
    
    // Yeni ban'ı ekle
    userBanHistory.push(now);
    
    // Zaman sınırı dışındaki ban'ları temizle
    userBanHistory = userBanHistory.filter(banTime => 
        now - banTime <= settings.timeLimit
    );
    
    // Güncellenmiş geçmişi kaydet
    banHistory.set(historyKey, userBanHistory);
    
    // Limit kontrol et
    if (userBanHistory.length >= settings.banLimit) {
        logger.warn(`BAN ABUSE TESPİT EDİLDİ: ${moderatorId} kullanıcısı ${settings.timeLimit/60000} dakika içinde ${userBanHistory.length} ban attı!`);
        
        return {
            violated: true,
            banCount: userBanHistory.length,
            timeWindow: settings.timeLimit / 60000,
            punishment: settings.punishment
        };
    }
    
    return { violated: false, banCount: userBanHistory.length };
}

/**
 * Ban abuse cezası uygula
 */
async function applyBanAbusePunishment(guild, moderatorId, punishment) {
    try {
        const moderator = await guild.members.fetch(moderatorId);
        if (!moderator) return false;

        // Log kanalını bul
        const logChannel = guild.channels.cache.find(ch => 
            ch.name === config.logChannelName && ch.isTextBased()
        );

        const alertEmbed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('🚨 BAN ABUSE TESPİT EDİLDİ!')
            .setDescription(`**${moderator.user.tag}** kısa sürede çok fazla ban attı!`)
            .addFields(
                { name: 'Moderatör', value: `${moderator.user.tag} (<@${moderator.id}>)`, inline: false }
            )
            .setTimestamp();

        switch (punishment) {
            case 'warn':
                alertEmbed.addFields({ name: 'Uygulanan Ceza', value: '⚠️ Uyarı verildi', inline: true });
                if (logChannel) {
                    await logChannel.send({ embeds: [alertEmbed] });
                }
                break;

            case 'kick':
                if (moderator.kickable) {
                    await moderator.kick('Ban abuse - Çok fazla ban attı');
                    alertEmbed.addFields({ name: 'Uygulanan Ceza', value: '👢 Sunucudan atıldı', inline: true });
                } else {
                    alertEmbed.addFields({ name: 'Ceza Durumu', value: '❌ Atılamadı - yetki yetersiz', inline: true });
                }
                if (logChannel) {
                    await logChannel.send({ embeds: [alertEmbed] });
                }
                break;

            case 'ban':
                if (moderator.bannable) {
                    await moderator.ban({ reason: 'Ban abuse - Çok fazla ban attı' });
                    alertEmbed.addFields({ name: 'Uygulanan Ceza', value: '🔨 Yasaklandı', inline: true });
                } else {
                    alertEmbed.addFields({ name: 'Ceza Durumu', value: '❌ Yasaklanamadı - yetki yetersiz', inline: true });
                }
                if (logChannel) {
                    await logChannel.send({ embeds: [alertEmbed] });
                }
                break;

            case 'removeall':
                // Tüm rolleri al (@everyone hariç)
                const allUserRoles = moderator.roles.cache.filter(role => role.id !== guild.id);
                let allRemovedRoles = [];
                
                for (const role of allUserRoles.values()) {
                    try {
                        await moderator.roles.remove(role);
                        allRemovedRoles.push(role.name);
                    } catch (error) {
                        logger.warn(`Rol kaldırılamadı: ${role.name} - ${error.message}`);
                    }
                }
                
                const allRolesText = allRemovedRoles.length > 0 ? `${allRemovedRoles.length} rol kaldırıldı` : 'Hiçbiri';
                alertEmbed.addFields({ name: 'Uygulanan Ceza', value: `🗑️ Tüm roller alındı: ${allRolesText}`, inline: true });
                if (logChannel) {
                    await logChannel.send({ embeds: [alertEmbed] });
                }
                break;
        }

        logger.info(`Ban abuse cezası uygulandı: ${moderator.user.tag} -> ${punishment}`);
        return true;

    } catch (error) {
        logger.error('Ban abuse ceza uygulama hatası:', error);
        return false;
    }
}

module.exports.banAbuseSettings = banAbuseSettings;
module.exports.banHistory = banHistory;
module.exports.trackBanUsage = trackBanUsage;
module.exports.applyBanAbusePunishment = applyBanAbusePunishment;