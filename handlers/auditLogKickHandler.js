const { AuditLogEvent } = require('discord.js');
const { trackKickUsage, applyKickAbusePunishment } = require('../commands/kickprotection');
const LogManager = require('../utils/logManager');
const logger = require('../utils/logger');

/**
 * Audit log tabanlı kick takibi - tüm kick işlemlerini izler
 */
async function handleGuildKick(guild, user) {
    try {
        // Audit log'lardan kim kick attığını bul
        const auditLogs = await guild.fetchAuditLogs({
            type: AuditLogEvent.MemberKick,
            limit: 5
        });

        // Son kick işlemini bul
        const kickLog = auditLogs.entries.find(entry => 
            entry.target.id === user.id &&
            Date.now() - entry.createdTimestamp < 5000 // Son 5 saniye içinde
        );

        if (!kickLog || !kickLog.executor) {
            logger.warn(`Kick audit log bulunamadı: ${user.tag}`);
            return;
        }

        const executor = kickLog.executor;
        
        // Bot'ların kick'larını yoksay
        if (executor.bot) {
            return;
        }

        logger.info(`Audit log kick tespit edildi: ${user.tag} <- ${executor.tag} (${kickLog.reason || 'Sebep yok'})`);

        // Her kick işlemi için detaylı log gönder
        await LogManager.sendLog(guild, 'kickprotection', {
            type: 'kick_action',
            moderator: `${executor.tag} (${executor.id})`,
            target: `${user.tag} (${user.id})`,
            reason: kickLog.reason || 'Sebep belirtilmedi',
            method: 'Audit Log',
            timestamp: new Date().toLocaleString('tr-TR')
        });

        // Kick abuse tracking çalıştır
        const abuseCheck = await trackKickUsage(guild, executor.id, user.id);
        
        if (abuseCheck.violated) {
            logger.warn(`Kick abuse tespit edildi (audit log): ${executor.tag} - ${abuseCheck.kickCount} kick / ${abuseCheck.timeWindow} dakika`);
            
            // Kick abuse log'u gönder
            await LogManager.sendLog(guild, 'kickprotection', {
                type: 'kick_abuse',
                moderator: `${executor.tag} (${executor.id})`,
                kickCount: abuseCheck.kickCount,
                timeWindow: abuseCheck.timeWindow,
                punishment: abuseCheck.punishment,
                kickTarget: `${user.tag} (${user.id})`
            });
            
            // Ceza uygula
            const punishmentSuccess = await applyKickAbusePunishment(guild, executor.id, abuseCheck.punishment);
            
            if (punishmentSuccess) {
                logger.info(`Kick abuse cezası uygulandı: ${executor.tag} -> ${abuseCheck.punishment}`);
            } else {
                logger.error(`Kick abuse cezası uygulanamadı: ${executor.tag}`);
            }
        } else {
            logger.info(`Kick sayısı normal: ${executor.tag} - ${abuseCheck.kickCount || 0} kick`);
        }

    } catch (error) {
        logger.error('Audit log kick handler hatası:', error);
    }
}

module.exports = {
    handleGuildKick
};