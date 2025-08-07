const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { antiRaidSettings } = require('../commands/antiraid');
const LogManager = require('../utils/logManager');
const config = require('../config.json');
const logger = require('../utils/logger');

/**
 * Yeni üye katılım event handler - Anti-raid koruması
 */
async function handleMemberJoin(member) {
    try {
        const guildId = member.guild.id;
        const settings = antiRaidSettings.get(guildId);
        
        // Anti-raid koruması aktif değilse çık
        if (!settings || !settings.enabled) {
            return;
        }

        const now = Date.now();
        const { userLimit, timeLimit, recentJoins } = settings;

        // Yeni katılımı kaydet
        recentJoins.push({
            userId: member.id,
            username: member.user.tag,
            joinTime: now
        });

        // Eski kayıtları temizle (zaman limiti dışında olanlar)
        const validJoins = recentJoins.filter(join => 
            now - join.joinTime <= timeLimit
        );

        // Ayarları güncelle
        settings.recentJoins = validJoins;

        // Eşik aşılmış mı kontrol et
        if (validJoins.length >= userLimit) {
            // Son 5 dakikada bir alert göndermemişse alert gönder
            const alertCooldown = 5 * 60 * 1000; // 5 dakika
            if (now - settings.lastAlert > alertCooldown) {
                await sendRaidAlert(member.guild, validJoins, settings);
                settings.lastAlert = now;
            }

            // Otomatik önlemler
            await takeAutomaticActions(member.guild, validJoins);
        }

        logger.info(`Anti-raid: ${member.user.tag} katıldı. Son ${timeLimit/1000}s içinde ${validJoins.length} katılım.`);

    } catch (error) {
        logger.error('Anti-raid handler hatası:', error);
    }
}

/**
 * Raid alarm mesajı gönder
 */
async function sendRaidAlert(guild, recentJoins, settings) {
    try {
        // Katılan kullanıcıların listesi
        const joinedUsers = recentJoins
            .slice(-settings.userLimit)
            .map((join, index) => `${index + 1}. ${join.username} (<@${join.userId}>)`)
            .join('\n');

        // LogManager ile anti-raid log'u gönder
        await LogManager.logAntiRaid(
            guild,
            'Potansiyel Raid Tespit Edildi',
            `**${settings.userLimit}** kullanıcı **${settings.timeLimit/1000}** saniye içinde katıldı!\n\n**Katılan Kullanıcılar:**\n${joinedUsers}\n\n**Önerilen Aksiyonlar:**\n• Sunucuyu geçici olarak kilitleyin\n• Şüpheli hesapları kontrol edin\n• Yeni katılanlara dikkat edin`,
            recentJoins.length,
            Math.round(settings.timeLimit/1000)
        );

        logger.warn(`RAID ALERT: ${guild.name} sunucusunda ${recentJoins.length} hızlı katılım tespit edildi.`);

    } catch (error) {
        logger.error('Raid alert gönderme hatası:', error);
    }
}

/**
 * Otomatik önlemler al
 */
async function takeAutomaticActions(guild, recentJoins) {
    try {
        // Bot'un yetkilerini kontrol et
        const botMember = guild.members.cache.get(guild.client.user.id);
        
        // 1. Şüpheli hesapları kontrol et ve gerekirse kick/ban et
        for (const join of recentJoins.slice(-3)) { // Son 3 katılanı kontrol et
            try {
                const member = await guild.members.fetch(join.userId);
                
                if (!member) continue;

                // Şüpheli hesap kriterleri
                const accountAge = Date.now() - member.user.createdTimestamp;
                const isNewAccount = accountAge < 7 * 24 * 60 * 60 * 1000; // 7 günden yeni
                const hasDefaultAvatar = !member.user.avatar;
                const hasNumbersInName = /\d{3,}/.test(member.user.username); // 3+ rakam içeriyor

                // Şüpheli kriterlerden 2'si varsa uyarı ver
                const suspiciousScore = [isNewAccount, hasDefaultAvatar, hasNumbersInName].filter(Boolean).length;
                
                if (suspiciousScore >= 2) {
                    logger.warn(`Şüpheli hesap tespit edildi: ${member.user.tag} (Skor: ${suspiciousScore}/3)`);
                    
                    // Eğer bot kick yetkisi varsa ve hesap çok yeni ise (1 günden az)
                    if (botMember.permissions.has(PermissionFlagsBits.KickMembers) && 
                        member.kickable && 
                        accountAge < 24 * 60 * 60 * 1000) {
                        
                        await member.kick('Anti-raid: Şüpheli hesap - Otomatik koruma');
                        logger.info(`Anti-raid otomatik kick: ${member.user.tag}`);
                    }
                }

            } catch (memberError) {
                logger.error(`Üye kontrolü hatası (${join.userId}):`, memberError);
            }
        }

    } catch (error) {
        logger.error('Otomatik anti-raid aksiyonları hatası:', error);
    }
}

/**
 * Üye ayrılım event handler
 */
async function handleMemberLeave(member) {
    try {
        const guildId = member.guild.id;
        const settings = antiRaidSettings.get(guildId);
        
        if (!settings || !settings.enabled) {
            return;
        }

        // Ayrılan üyeyi recent joins listesinden çıkar
        settings.recentJoins = settings.recentJoins.filter(join => 
            join.userId !== member.id
        );

    } catch (error) {
        logger.error('Anti-raid leave handler hatası:', error);
    }
}

module.exports = {
    handleMemberJoin,
    handleMemberLeave
};