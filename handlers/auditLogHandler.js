const { AuditLogEvent } = require('discord.js');
const { trackBanUsage, applyBanAbusePunishment } = require('../commands/banprotection');
const LogManager = require('../utils/logManager');
const logger = require('../utils/logger');

/**
 * Audit log tabanlı ban takibi - tüm ban işlemlerini izler
 */
async function handleGuildBanAdd(ban) {
    try {
        const guild = ban.guild;
        
        // Bot'un kendisinin ban'larını yoksay (sonsuz döngü önleme)
        if (ban.user.bot && ban.user.id === guild.client.user.id) {
            return;
        }

        // Audit log'lardan kim ban attığını bul
        const auditLogs = await guild.fetchAuditLogs({
            type: AuditLogEvent.MemberBanAdd,
            limit: 5
        });

        // Son ban işlemini bul
        const banLog = auditLogs.entries.find(entry => 
            entry.target.id === ban.user.id &&
            Date.now() - entry.createdTimestamp < 5000 // Son 5 saniye içinde
        );

        if (!banLog || !banLog.executor) {
            logger.warn(`Ban audit log bulunamadı: ${ban.user.tag}`);
            return;
        }

        const executor = banLog.executor;
        
        // Bot'ların ban'larını yoksay (başka botlar)
        if (executor.bot) {
            return;
        }

        logger.info(`Audit log ban tespit edildi: ${ban.user.tag} <- ${executor.tag} (${banLog.reason || 'Sebeb yok'})`);

        // Her ban işlemi için detaylı log gönder
        await LogManager.sendLog(guild, 'banprotection', {
            type: 'ban_action',
            moderator: `${executor.tag} (${executor.id})`,
            target: `${ban.user.tag} (${ban.user.id})`,
            reason: banLog.reason || 'Sebep belirtilmedi',
            method: 'Audit Log',
            timestamp: new Date().toLocaleString('tr-TR')
        });

        // Ban abuse tracking çalıştır
        const abuseCheck = await trackBanUsage(guild, executor.id, ban.user.id);
        
        if (abuseCheck.violated) {
            logger.warn(`Ban abuse tespit edildi (audit log): ${executor.tag} - ${abuseCheck.banCount} ban / ${abuseCheck.timeWindow} dakika`);
            
            // Ban abuse log'u gönder
            await LogManager.logBanAbuse(guild, executor, abuseCheck.banCount, abuseCheck.timeWindow, abuseCheck.punishment, ban.user);
            
            // Ceza uygula
            const punishmentSuccess = await applyBanAbusePunishment(guild, executor.id, abuseCheck.punishment);
            
            if (punishmentSuccess) {
                logger.info(`Ban abuse cezası uygulandı: ${executor.tag} -> ${abuseCheck.punishment}`);
            } else {
                logger.error(`Ban abuse cezası uygulanamadı: ${executor.tag}`);
            }
        } else {
            logger.info(`Ban sayısı normal: ${executor.tag} - ${abuseCheck.banCount || 0} ban`);
        }

    } catch (error) {
        logger.error('Audit log ban handler hatası:', error);
    }
}

/**
 * Unban işlemlerini de izle (opsiyonel)
 */
async function handleGuildBanRemove(ban) {
    try {
        const guild = ban.guild;
        
        // Audit log'lardan kim unban yaptığını bul
        const auditLogs = await guild.fetchAuditLogs({
            type: AuditLogEvent.MemberBanRemove,
            limit: 3
        });

        const unbanLog = auditLogs.entries.find(entry => 
            entry.target.id === ban.user.id &&
            Date.now() - entry.createdTimestamp < 5000
        );

        if (unbanLog && unbanLog.executor && !unbanLog.executor.bot) {
            logger.info(`Unban işlemi: ${ban.user.tag} <- ${unbanLog.executor.tag}`);
        }

    } catch (error) {
        logger.error('Audit log unban handler hatası:', error);
    }
}

module.exports = {
    handleGuildBanAdd,
    handleGuildBanRemove
};