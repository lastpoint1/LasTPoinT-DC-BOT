const { EmbedBuilder } = require('discord.js');
const config = require('../config.json');
const logger = require('./logger');

/**
 * Merkezi log gönderme sistemi - her komut türü için ayrı kanal desteği
 */
class LogManager {
    /**
     * Belirli bir log türü için mesaj gönder
     * @param {Guild} guild - Discord sunucusu
     * @param {string} logType - Log türü (moderation, banprotection, antiraid, audit, errors)
     * @param {Object} logData - Log verisi
     */
    static async sendLog(guild, logType, logData) {
        try {
            let logChannelId;
            
            // Koruma sistemleri için özel log kanallarını kontrol et
            if (logType === 'banprotection' || logType === 'antiraid' || logType === 'kickprotection') {
                logChannelId = config.protectionLogChannels?.[logType];
            } else {
                logChannelId = config.logChannels?.[logType];
            }
            
            // Log kanalı yoksa varsayılan kanala gönder
            let logChannel;
            if (logChannelId) {
                logChannel = guild.channels.cache.get(logChannelId);
            }
            
            // Varsayılan log kanalını dene
            if (!logChannel && config.logChannelName) {
                logChannel = guild.channels.cache.find(ch => ch.name === config.logChannelName);
            }

            // Hiç log kanalı yoksa çık
            if (!logChannel) {
                logger.warn(`Log kanalı bulunamadı - Tür: ${logType}`);
                return false;
            }

            // Embed oluştur
            const embed = new EmbedBuilder()
                .setTimestamp();

            // Log türüne göre embed'i ayarla
            switch (logType) {
                case 'moderation':
                    embed.setColor(config.embedColors?.warning || '#ffa500')
                        .setTitle(`🔨 ${logData.action} İşlemi`)
                        .addFields(
                            { name: 'Moderatör', value: logData.moderator, inline: true },
                            { name: 'Hedef', value: logData.target, inline: true },
                            { name: 'Sebep', value: logData.reason || 'Belirtilmedi', inline: false }
                        );
                    if (logData.duration) {
                        embed.addFields({ name: 'Süre', value: logData.duration, inline: true });
                    }
                    break;

                case 'banprotection':
                    if (logData.type === 'ban_action') {
                        // Her ban işlemi için normal log
                        embed.setColor('#ff4444')
                            .setTitle('🔨 Ban İşlemi')
                            .addFields(
                                { name: 'Moderatör', value: logData.moderator, inline: true },
                                { name: 'Hedef Kullanıcı', value: logData.target, inline: true },
                                { name: 'Sebep', value: logData.reason, inline: false },
                                { name: 'Yöntem', value: logData.method, inline: true },
                                { name: 'Zaman', value: logData.timestamp, inline: true }
                            );
                    } else {
                        // Ban abuse tespit edildi
                        embed.setColor('#ff0000')
                            .setTitle('🚨 Ban Abuse Tespit Edildi')
                            .addFields(
                                { name: 'Moderatör', value: logData.moderator, inline: true },
                                { name: 'Ban Sayısı', value: `${logData.banCount} ban`, inline: true },
                                { name: 'Zaman Penceresi', value: `${logData.timeWindow} dakika`, inline: true },
                                { name: 'Uygulanan Ceza', value: logData.punishment, inline: false }
                            );
                        if (logData.banTarget) {
                            embed.addFields({ name: 'Son Banlanan', value: logData.banTarget, inline: true });
                        }
                    }
                    break;

                case 'kickprotection':
                    if (logData.type === 'kick_action') {
                        // Her kick işlemi için normal log
                        embed.setColor('#ff8800')
                            .setTitle('👢 Kick İşlemi')
                            .addFields(
                                { name: 'Moderatör', value: logData.moderator, inline: true },
                                { name: 'Hedef Kullanıcı', value: logData.target, inline: true },
                                { name: 'Sebep', value: logData.reason, inline: false },
                                { name: 'Yöntem', value: logData.method, inline: true },
                                { name: 'Zaman', value: logData.timestamp, inline: true }
                            );
                    } else {
                        // Kick abuse tespit edildi
                        embed.setColor('#ff8c00')
                            .setTitle('⚠️ Kick Abuse Tespit Edildi')
                            .addFields(
                                { name: 'Moderatör', value: logData.moderator, inline: true },
                                { name: 'Kick Sayısı', value: `${logData.kickCount} kick`, inline: true },
                                { name: 'Zaman Penceresi', value: `${logData.timeWindow} dakika`, inline: true },
                                { name: 'Uygulanan Ceza', value: logData.punishment, inline: false }
                            );
                        if (logData.kickTarget) {
                            embed.addFields({ name: 'Son Atılan', value: logData.kickTarget, inline: true });
                        }
                    }
                    break;

                case 'antiraid':
                    embed.setColor('#ff8c00')
                        .setTitle('⚠️ Anti-Raid Uyarısı')
                        .addFields(
                            { name: 'Olay Türü', value: logData.eventType, inline: true },
                            { name: 'Detay', value: logData.details, inline: false }
                        );
                    if (logData.userCount) {
                        embed.addFields({ name: 'Kullanıcı Sayısı', value: `${logData.userCount}`, inline: true });
                    }
                    if (logData.timeWindow) {
                        embed.addFields({ name: 'Zaman Aralığı', value: `${logData.timeWindow} saniye`, inline: true });
                    }
                    break;

                case 'audit':
                    embed.setColor('#00ff00')
                        .setTitle('📋 Audit Log')
                        .addFields(
                            { name: 'İşlem', value: logData.action, inline: true },
                            { name: 'Kullanıcı', value: logData.user, inline: true },
                            { name: 'Detay', value: logData.details, inline: false }
                        );
                    break;

                case 'errors':
                    embed.setColor('#ff0000')
                        .setTitle('❌ Bot Hatası')
                        .addFields(
                            { name: 'Hata Türü', value: logData.errorType, inline: true },
                            { name: 'Konum', value: logData.location, inline: true },
                            { name: 'Detay', value: logData.details, inline: false }
                        );
                    if (logData.user) {
                        embed.addFields({ name: 'Kullanıcı', value: logData.user, inline: true });
                    }
                    break;

                default:
                    embed.setColor('#cccccc')
                        .setTitle('📄 Log')
                        .setDescription(logData.message || 'Log mesajı');
            }

            // Log'u gönder
            await logChannel.send({ embeds: [embed] });
            return true;

        } catch (error) {
            logger.error(`Log gönderme hatası (${logType}):`, error);
            return false;
        }
    }

    /**
     * Moderasyon işlemi log'u
     */
    static async logModeration(guild, moderator, target, action, reason, duration = null) {
        return await this.sendLog(guild, 'moderation', {
            action,
            moderator: `${moderator.user.tag} (${moderator.user.id})`,
            target: `${target.tag} (${target.id})`,
            reason,
            duration
        });
    }

    /**
     * Ban abuse log'u
     */
    static async logBanAbuse(guild, moderator, banCount, timeWindow, punishment, banTarget = null) {
        return await this.sendLog(guild, 'banprotection', {
            moderator: `${moderator.tag} (${moderator.id})`,
            banCount,
            timeWindow,
            punishment,
            banTarget: banTarget ? `${banTarget.tag} (${banTarget.id})` : null
        });
    }

    /**
     * Kick abuse log'u
     */
    static async logKickAbuse(guild, moderator, kickCount, timeWindow, punishment, kickTarget = null) {
        return await this.sendLog(guild, 'kickprotection', {
            moderator: `${moderator.tag} (${moderator.id})`,
            kickCount,
            timeWindow,
            punishment,
            kickTarget: kickTarget ? `${kickTarget.tag} (${kickTarget.id})` : null
        });
    }

    /**
     * Anti-raid log'u
     */
    static async logAntiRaid(guild, eventType, details, userCount = null, timeWindow = null) {
        return await this.sendLog(guild, 'antiraid', {
            eventType,
            details,
            userCount,
            timeWindow
        });
    }

    /**
     * Audit log'u
     */
    static async logAudit(guild, action, user, details) {
        return await this.sendLog(guild, 'audit', {
            action,
            user: `${user.tag} (${user.id})`,
            details
        });
    }

    /**
     * Hata log'u
     */
    static async logError(guild, errorType, location, details, user = null) {
        return await this.sendLog(guild, 'errors', {
            errorType,
            location,
            details,
            user: user ? `${user.tag} (${user.id})` : null
        });
    }

    /**
     * Mevcut log kanallarını kontrol et
     */
    static getLogChannels(guild) {
        const channels = {};
        
        // Normal log kanalları
        const logChannels = config.logChannels || {};
        for (const [logType, channelId] of Object.entries(logChannels)) {
            const channel = guild.channels.cache.get(channelId);
            if (channel) {
                channels[logType] = channel;
            }
        }
        
        // Koruma sistemi log kanalları
        const protectionChannels = config.protectionLogChannels || {};
        for (const [logType, channelId] of Object.entries(protectionChannels)) {
            const channel = guild.channels.cache.get(channelId);
            if (channel) {
                channels[logType] = channel;
            }
        }
        
        return channels;
    }
}

module.exports = LogManager;