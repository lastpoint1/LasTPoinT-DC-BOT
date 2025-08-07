const { PermissionFlagsBits } = require('discord.js');
const config = require('../config.json');

/**
 * Kullanıcının belirli bir komut için yetki kontrolü
 * @param {GuildMember} member - Kontrol edilecek üye
 * @param {string} action - Yapılacak işlem (kick, ban, mute, clear)
 * @returns {Object} - Yetki durumu ve mesaj
 */
async function checkPermissions(member, action) {
    if (!member) {
        return {
            hasPermission: false,
            message: 'Üye bilgisi bulunamadı!'
        };
    }

    // Sunucu sahibi her zaman yetkili
    if (member.guild.ownerId === member.id) {
        return {
            hasPermission: true,
            message: 'Sunucu sahibi yetkisi'
        };
    }

    // Moderatör rolü kontrolü
    const hasModeratorRole = member.roles.cache.some(role => 
        config.moderatorRoles.includes(role.name)
    );

    if (!hasModeratorRole) {
        // Discord yetkilerini kontrol et
        const requiredPermissions = {
            kick: PermissionFlagsBits.KickMembers,
            ban: PermissionFlagsBits.BanMembers,
            mute: PermissionFlagsBits.ModerateMembers,
            clear: PermissionFlagsBits.ManageMessages,
            antiraid: PermissionFlagsBits.Administrator,
            banprotection: PermissionFlagsBits.Administrator
        };

        const requiredPermission = requiredPermissions[action];
        if (!requiredPermission || !member.permissions.has(requiredPermission)) {
            return {
                hasPermission: false,
                message: `Bu komutu kullanmak için moderatör rolü (${config.moderatorRoles.join(', ')}) veya gerekli Discord yetkisine sahip olmanız gerekir!`
            };
        }
    }

    return {
        hasPermission: true,
        message: 'Yetki kontrolü başarılı'
    };
}

/**
 * Bir kullanıcının diğer kullanıcıyı moderasyona tabi tutup tutamayacağını kontrol eder
 * @param {GuildMember} moderator - Moderatör
 * @param {GuildMember} target - Hedef kullanıcı
 * @param {string} action - Yapılacak işlem
 * @returns {Object} - Moderasyon yapabilme durumu ve mesaj
 */
async function canModerate(moderator, target, action) {
    if (!moderator || !target) {
        return {
            canModerate: false,
            message: 'Kullanıcı bilgileri bulunamadı!'
        };
    }

    // Kendi kendini moderasyona alamaz
    if (moderator.id === target.id) {
        return {
            canModerate: false,
            message: 'Kendi kendinizi moderasyona tabi tutamazsınız!'
        };
    }

    // Sunucu sahibini moderasyona alamaz (sahibi hariç)
    if (target.guild.ownerId === target.id && moderator.guild.ownerId !== moderator.id) {
        return {
            canModerate: false,
            message: 'Sunucu sahibini moderasyona tabi tutamazsınız!'
        };
    }

    // Rol hiyerarşisi kontrolü (sunucu sahibi hariç)
    if (moderator.roles.highest.position <= target.roles.highest.position && moderator.guild.ownerId !== moderator.id) {
        return {
            canModerate: false,
            message: 'Bu kullanıcı sizinle aynı veya daha yüksek role sahip olduğu için moderasyona tabi tutamazsınız!'
        };
    }

    // Bot mu kontrolü
    if (target.user.bot && moderator.id !== moderator.guild.ownerId) {
        return {
            canModerate: false,
            message: 'Bot kullanıcılarını moderasyona tabi tutamazsınız!'
        };
    }

    // İşlem-spesifik kontroller
    switch (action) {
        case 'kick':
        case 'ban':
            // Sunucu sahibi herkesi kick/ban edebilir (bot yetkileri yeterli olduğu sürece)
            if (!target.kickable && moderator.id !== moderator.guild.ownerId) {
                return {
                    canModerate: false,
                    message: 'Bu kullanıcı moderasyona tabi tutulamaz (yetki seviyesi çok yüksek)!'
                };
            }
            break;
        
        case 'mute':
            if (!target.moderatable && moderator.id !== moderator.guild.ownerId) {
                return {
                    canModerate: false,
                    message: 'Bu kullanıcı susturulamaz (yetki seviyesi çok yüksek)!'
                };
            }
            break;
    }

    return {
        canModerate: true,
        message: 'Moderasyon yetkisi onaylandı'
    };
}

/**
 * Belirli bir rolün bulunup bulunmadığını kontrol eder ve yoksa oluşturur
 * @param {Guild} guild - Discord sunucusu
 * @param {string} roleName - Rol adı
 * @param {Object} options - Rol seçenekleri
 * @returns {Role} - Bulunan veya oluşturulan rol
 */
async function findOrCreateRole(guild, roleName, options = {}) {
    try {
        let role = guild.roles.cache.find(r => r.name === roleName);
        
        if (!role) {
            role = await guild.roles.create({
                name: roleName,
                color: options.color || '#95a5a6',
                permissions: options.permissions || [],
                mentionable: options.mentionable || false,
                reason: options.reason || `${roleName} rolü otomatik olarak oluşturuldu`
            });
        }
        
        return role;
    } catch (error) {
        throw new Error(`Rol oluşturulurken hata: ${error.message}`);
    }
}

module.exports = {
    checkPermissions,
    canModerate,
    findOrCreateRole
};
