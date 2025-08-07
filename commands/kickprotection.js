const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { checkPermissions } = require('../utils/permissions');
const config = require('../config.json');
const logger = require('../utils/logger');

// Kick abuse tracking
const kickAbuseData = new Map(); // guildId -> { settings, kickHistory }

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kickprotection')
        .setDescription('Kick abuse korumasını yönet')
        .addSubcommand(subcommand =>
            subcommand
                .setName('enable')
                .setDescription('Kick abuse korumasını etkinleştir')
                .addIntegerOption(option =>
                    option.setName('kick-limiti')
                        .setDescription('Zaman penceresi içinde maksimum kick sayısı')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(20))
                .addIntegerOption(option =>
                    option.setName('sure')
                        .setDescription('Zaman penceresi (dakika)')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(60))
                .addStringOption(option =>
                    option.setName('ceza')
                        .setDescription('Abuse durumunda uygulanacak ceza')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Uyarı (sadece log)', value: 'warn' },
                            { name: 'Kick (sunucudan at)', value: 'kick' },
                            { name: 'Ban (sunucudan yasakla)', value: 'ban' },
                            { name: 'Tüm Rolleri Al', value: 'removeall' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Kick abuse korumasını devre dışı bırak'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Kick abuse koruması durumunu görüntüle'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('history')
                .setDescription('Kick geçmişini görüntüle')
                .addUserOption(option =>
                    option.setName('kullanici')
                        .setDescription('Belirli bir kullanıcının kick geçmişi')
                        .setRequired(false)))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(message, args = [], isSlash = false) {
        try {
            // Yetki kontrolü - Sadece sunucu sahibi
            if (message.member.id !== message.guild.ownerId) {
                const embed = new EmbedBuilder()
                    .setColor(config.embedColors.error)
                    .setTitle('❌ Yetki Hatası')
                    .setDescription('Bu güvenlik komutu sadece sunucu sahibi tarafından kullanılabilir.')
                    .setTimestamp();

                const replyMethod = isSlash ? 'reply' : 'reply';
                return await message[replyMethod]({ embeds: [embed] });
            }

            const guildId = message.guild.id;
            let subcommand, kickLimit, timeWindow, punishment, targetUser;

            if (isSlash) {
                subcommand = message.options.getSubcommand();
                kickLimit = message.options.getInteger('kick-limiti');
                timeWindow = message.options.getInteger('sure');
                punishment = message.options.getString('ceza');
                targetUser = message.options.getUser('kullanici');
            } else {
                subcommand = args[0]?.toLowerCase();
                kickLimit = parseInt(args[1]);
                timeWindow = parseInt(args[2]);
                punishment = args[3]?.toLowerCase();
                
                if (subcommand === 'history' && args[1]) {
                    const userMention = args[1];
                    const userId = userMention.replace(/[<@!>]/g, '');
                    targetUser = await message.guild.members.fetch(userId).catch(() => null);
                    targetUser = targetUser?.user;
                }
            }

            const embed = new EmbedBuilder()
                .setColor(config.embedColors.success)
                .setTimestamp();

            if (subcommand === 'enable') {
                if (!kickLimit || !timeWindow || !punishment) {
                    embed.setColor(config.embedColors.error)
                        .setTitle('❌ Eksik Parametre')
                        .setDescription('Kullanım: `!kickprotection enable <kick-limiti> <dakika> <ceza>` veya `/kickprotection enable`');
                    
                    const replyMethod = isSlash ? 'reply' : 'reply';
                    return await message[replyMethod]({ embeds: [embed] });
                }

                // Ceza türünü eşleştir
                const punishmentMap = {
                    'warn': 'warn',
                    'uyari': 'warn',
                    'warning': 'warn',
                    'kick': 'kick',
                    'at': 'kick',
                    'ban': 'ban',
                    'yasakla': 'ban',
                    'removerole': 'removerole',
                    'yetkial': 'removerole',
                    'remiverole': 'removerole'
                };

                const mappedPunishment = punishmentMap[punishment] || punishment;

                // Ayarları kaydet
                kickAbuseData.set(guildId, {
                    settings: {
                        enabled: true,
                        kickLimit,
                        timeWindow: timeWindow * 60 * 1000, // dakikayı milisaniyeye çevir
                        punishment: mappedPunishment
                    },
                    kickHistory: new Map() // userId -> [kick entries]
                });

                const punishmentNames = {
                    'warn': 'Uyarı (Log)',
                    'kick': 'Kick (Sunucudan At)',
                    'ban': 'Ban (Sunucudan Yasakla)',
                    'removerole': 'Yetki Al (Roller Kaldır)'
                };

                embed.setTitle('🛡️ Kick Abuse Koruması Etkinleştirildi')
                    .setDescription('Kick abuse koruması başarıyla ayarlandı!')
                    .addFields({
                        name: 'Kick Limiti',
                        value: `${kickLimit} kick`,
                        inline: true
                    }, {
                        name: 'Zaman Penceresi',
                        value: `${timeWindow} dakika`,
                        inline: true
                    }, {
                        name: 'Ceza Türü',
                        value: punishmentNames[mappedPunishment] || mappedPunishment,
                        inline: true
                    });

                logger.info(`${message.member.user.tag} tarafından kick abuse koruması etkinleştirildi. ${kickLimit} kick / ${timeWindow} dakika`);

            } else if (subcommand === 'disable') {
                if (kickAbuseData.has(guildId)) {
                    kickAbuseData.delete(guildId);
                    embed.setTitle('🛡️ Kick Abuse Koruması Devre Dışı')
                        .setDescription('Kick abuse koruması devre dışı bırakıldı.');
                    
                    logger.info(`${message.member.user.tag} tarafından kick abuse koruması devre dışı bırakıldı`);
                } else {
                    embed.setColor(config.embedColors.error)
                        .setTitle('❌ Koruma Zaten Kapalı')
                        .setDescription('Kick abuse koruması zaten devre dışı.');
                }

            } else if (subcommand === 'status') {
                const data = kickAbuseData.get(guildId);
                
                if (data && data.settings.enabled) {
                    const { kickLimit, timeWindow, punishment } = data.settings;
                    
                    const punishmentNames = {
                        'warn': 'Uyarı (Log)',
                        'kick': 'Kick (Sunucudan At)',
                        'ban': 'Ban (Sunucudan Yasakla)', 
                        'removerole': 'Yetki Al (Roller Kaldır)'
                    };

                    embed.setTitle('🛡️ Kick Abuse Koruması Durumu')
                        .setDescription('Kick abuse koruması **aktif**.')
                        .addFields({
                            name: 'Kick Limiti',
                            value: `${kickLimit} kick`,
                            inline: true
                        }, {
                            name: 'Zaman Penceresi',
                            value: `${Math.round(timeWindow / 60000)} dakika`,
                            inline: true
                        }, {
                            name: 'Ceza Türü',
                            value: punishmentNames[punishment] || punishment,
                            inline: true
                        });
                } else {
                    embed.setColor(config.embedColors.warning)
                        .setTitle('🛡️ Kick Abuse Koruması Durumu')
                        .setDescription('Kick abuse koruması **devre dışı**.');
                }

            } else if (subcommand === 'history') {
                const data = kickAbuseData.get(guildId);
                
                if (!data) {
                    embed.setColor(config.embedColors.warning)
                        .setTitle('📋 Kick Geçmişi')
                        .setDescription('Kick abuse koruması henüz etkinleştirilmemiş.');
                } else if (targetUser) {
                    // Belirli kullanıcının geçmişi
                    const userKicks = data.kickHistory.get(targetUser.id) || [];
                    
                    if (userKicks.length === 0) {
                        embed.setTitle('📋 Kick Geçmişi')
                            .setDescription(`${targetUser.tag} için kick kaydı bulunamadı.`);
                    } else {
                        const recentKicks = userKicks
                            .slice(-10)
                            .map((kick, index) => `${index + 1}. <@${kick.targetId}> - ${new Date(kick.timestamp).toLocaleString('tr-TR')}`)
                            .join('\n');

                        embed.setTitle('📋 Kick Geçmişi')
                            .setDescription(`**${targetUser.tag}** son kick işlemleri:`)
                            .addFields({
                                name: 'Son Kickler',
                                value: recentKicks || 'Kayıt bulunamadı',
                                inline: false
                            }, {
                                name: 'Toplam Kick',
                                value: `${userKicks.length} adet`,
                                inline: true
                            });
                    }
                } else {
                    // Genel istatistikler
                    const totalKicks = Array.from(data.kickHistory.values())
                        .reduce((total, kicks) => total + kicks.length, 0);
                    
                    const activeUsers = data.kickHistory.size;

                    embed.setTitle('📋 Kick Abuse İstatistikleri')
                        .addFields({
                            name: 'Toplam Kick',
                            value: `${totalKicks} adet`,
                            inline: true
                        }, {
                            name: 'Aktif Kullanıcı',
                            value: `${activeUsers} kişi`,
                            inline: true
                        }, {
                            name: 'Durum',
                            value: data.settings.enabled ? '✅ Aktif' : '❌ Devre Dışı',
                            inline: true
                        });
                }

            } else {
                embed.setColor(config.embedColors.error)
                    .setTitle('❌ Geçersiz Komut')
                    .setDescription('Kullanım: `!kickprotection <enable|disable|status|history>` veya `/kickprotection`');
            }

            const replyMethod = isSlash ? 'reply' : 'reply';
            await message[replyMethod]({ embeds: [embed] });

            if (isSlash) {
                logger.info(`${message.member.user.tag} kullanıcısı "/kickprotection" slash komutunu kullandı.`);
            } else {
                logger.info(`${message.member.user.tag} kullanıcısı "!kickprotection" komutunu kullandı.`);
            }

        } catch (error) {
            logger.error('Kick protection komutu hatası:', error);
            
            const embed = new EmbedBuilder()
                .setColor(config.embedColors.error)
                .setTitle('❌ Hata')
                .setDescription('Kick abuse koruması ayarlanırken bir hata oluştu.')
                .setTimestamp();

            const replyMethod = isSlash ? 'reply' : 'reply';
            await message[replyMethod]({ embeds: [embed] });
        }
    }
};

/**
 * Kick kullanımını takip et
 */
async function trackKickUsage(guild, moderatorId, targetId) {
    try {
        const guildId = guild.id;
        const data = kickAbuseData.get(guildId);
        
        if (!data || !data.settings.enabled) {
            return { violated: false };
        }

        // Sunucu sahibi muaf
        if (moderatorId === guild.ownerId) {
            return { violated: false };
        }

        const now = Date.now();
        const { kickLimit, timeWindow, punishment } = data.settings;

        // Moderatörün kick geçmişini al
        if (!data.kickHistory.has(moderatorId)) {
            data.kickHistory.set(moderatorId, []);
        }

        const moderatorKicks = data.kickHistory.get(moderatorId);

        // Yeni kick'i ekle
        moderatorKicks.push({
            targetId,
            timestamp: now
        });

        // Eski kayıtları temizle
        const validKicks = moderatorKicks.filter(kick => 
            now - kick.timestamp <= timeWindow
        );

        data.kickHistory.set(moderatorId, validKicks);

        // Limit kontrol
        if (validKicks.length >= kickLimit) {
            return {
                violated: true,
                kickCount: validKicks.length,
                timeWindow: Math.round(timeWindow / 60000),
                punishment
            };
        }

        return { 
            violated: false, 
            kickCount: validKicks.length 
        };

    } catch (error) {
        logger.error('Kick usage tracking hatası:', error);
        return { violated: false };
    }
}

/**
 * Kick abuse cezası uygula
 */
async function applyKickAbusePunishment(guild, moderatorId, punishment) {
    try {
        const member = await guild.members.fetch(moderatorId).catch(() => null);
        if (!member) {
            logger.warn(`Kick abuse cezası uygulanamadı: Kullanıcı bulunamadı (${moderatorId})`);
            return false;
        }

        // Sunucu sahibine ceza uygulanmaz
        if (member.id === guild.ownerId) {
            logger.info(`Kick abuse cezası atlandı: Sunucu sahibi (${member.user.tag})`);
            return false;
        }

        switch (punishment) {
            case 'warn':
                logger.warn(`Kick abuse uyarısı: ${member.user.tag}`);
                return true;

            case 'kick':
                await member.kick('Kick abuse - Çok fazla kick işlemi');
                logger.info(`Kick abuse cezası (kick): ${member.user.tag}`);
                return true;

            case 'ban':
                await member.ban({ reason: 'Kick abuse - Çok fazla kick işlemi' });
                logger.info(`Kick abuse cezası (ban): ${member.user.tag}`);
                return true;

            case 'removeall':
                const allRoles = member.roles.cache.filter(role => role.id !== guild.id);
                let removedCount = 0;
                
                for (const role of allRoles.values()) {
                    try {
                        await member.roles.remove(role, 'Kick abuse - Tüm roller kaldırıldı');
                        removedCount++;
                    } catch (error) {
                        logger.warn(`Rol kaldırılamadı: ${role.name} - ${error.message}`);
                    }
                }
                
                logger.info(`Kick abuse cezası (tüm roller): ${member.user.tag} - ${removedCount} rol kaldırıldı`);
                return true;

            default:
                logger.warn(`Bilinmeyen kick abuse cezası: ${punishment}`);
                return false;
        }

    } catch (error) {
        logger.error(`Kick abuse cezası uygulama hatası (${punishment}):`, error);
        return false;
    }
}

module.exports.trackKickUsage = trackKickUsage;
module.exports.applyKickAbusePunishment = applyKickAbusePunishment;