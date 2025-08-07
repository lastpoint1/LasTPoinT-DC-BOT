const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { checkPermissions } = require('../utils/permissions');
const config = require('../config.json');
const logger = require('../utils/logger');

// Anti-raid ayarları
const antiRaidSettings = new Map();

module.exports = {
    name: 'antiraid',
    description: 'Anti-raid korumasını yönetir',
    data: new SlashCommandBuilder()
        .setName('antiraid')
        .setDescription('Anti-raid korumasını yönetir')
        .addSubcommand(subcommand =>
            subcommand
                .setName('enable')
                .setDescription('Anti-raid korumasını etkinleştirir')
                .addIntegerOption(option =>
                    option.setName('kullanici-sayisi')
                        .setDescription('Kaç kullanıcı katılırsa alarm versin (varsayılan: 5)')
                        .setMinValue(3)
                        .setMaxValue(20)
                        .setRequired(false))
                .addIntegerOption(option =>
                    option.setName('sure')
                        .setDescription('Kaç saniye içinde katılırsa alarm versin (varsayılan: 30)')
                        .setMinValue(10)
                        .setMaxValue(300)
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Anti-raid korumasını devre dışı bırakır'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Anti-raid koruması durumunu gösterir'))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(message, args, isSlash = false) {
        try {
            let subcommand, userLimit, timeLimit;
            
            if (isSlash) {
                subcommand = message.options.getSubcommand();
                userLimit = message.options.getInteger('kullanici-sayisi') || 5;
                timeLimit = message.options.getInteger('sure') || 30;
            } else {
                if (!args[0]) {
                    return message.reply('❌ Lütfen bir alt komut belirtiniz! Kullanım: `!antiraid <enable/disable/status> [ayarlar]`');
                }
                
                subcommand = args[0].toLowerCase();
                userLimit = parseInt(args[1]) || 5;
                timeLimit = parseInt(args[2]) || 30;
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
                    antiRaidSettings.set(guildId, {
                        enabled: true,
                        userLimit: userLimit,
                        timeLimit: timeLimit * 1000, // Milisaniyeye çevir
                        recentJoins: [],
                        lastAlert: 0
                    });

                    const enableEmbed = new EmbedBuilder()
                        .setColor('#e74c3c')
                        .setTitle('🛡️ Anti-Raid Koruması Etkinleştirildi')
                        .addFields(
                            { name: 'Kullanıcı Limiti', value: userLimit.toString(), inline: true },
                            { name: 'Zaman Limiti', value: `${timeLimit} saniye`, inline: true },
                            { name: 'Durum', value: '✅ Aktif', inline: true }
                        )
                        .setFooter({ text: 'Anti-raid sistemi şimdi aktif ve sunucuyu koruyor.' })
                        .setTimestamp();

                    await message[replyMethod]({ embeds: [enableEmbed] });
                    logger.info(`${authorMember.user.tag} tarafından anti-raid koruması etkinleştirildi. Limit: ${userLimit} kullanıcı / ${timeLimit} saniye`);
                    break;

                case 'disable':
                case 'devredisinibrak':
                    if (!antiRaidSettings.has(guildId)) {
                        return message[replyMethod]('❌ Anti-raid koruması zaten devre dışı!');
                    }

                    antiRaidSettings.delete(guildId);

                    const disableEmbed = new EmbedBuilder()
                        .setColor('#95a5a6')
                        .setTitle('🛡️ Anti-Raid Koruması Devre Dışı Bırakıldı')
                        .setDescription('Anti-raid koruması artık devre dışı.')
                        .setTimestamp();

                    await message[replyMethod]({ embeds: [disableEmbed] });
                    logger.info(`${authorMember.user.tag} tarafından anti-raid koruması devre dışı bırakıldı.`);
                    break;

                case 'status':
                case 'durum':
                    const settings = antiRaidSettings.get(guildId);
                    
                    if (!settings || !settings.enabled) {
                        const statusEmbed = new EmbedBuilder()
                            .setColor('#95a5a6')
                            .setTitle('🛡️ Anti-Raid Koruması Durumu')
                            .setDescription('❌ **Devre Dışı**')
                            .addFields(
                                { name: 'Etkinleştirmek için', value: '`!antiraid enable` veya `/antiraid enable`', inline: false }
                            )
                            .setTimestamp();

                        return message[replyMethod]({ embeds: [statusEmbed] });
                    }

                    const activeEmbed = new EmbedBuilder()
                        .setColor('#e74c3c')
                        .setTitle('🛡️ Anti-Raid Koruması Durumu')
                        .setDescription('✅ **Aktif ve Çalışıyor**')
                        .addFields(
                            { name: 'Kullanıcı Limiti', value: settings.userLimit.toString(), inline: true },
                            { name: 'Zaman Limiti', value: `${settings.timeLimit / 1000} saniye`, inline: true },
                            { name: 'Son Kontrol', value: settings.recentJoins.length > 0 ? `${settings.recentJoins.length} katılım izleniyor` : 'Temiz', inline: true }
                        )
                        .setTimestamp();

                    await message[replyMethod]({ embeds: [activeEmbed] });
                    break;

                default:
                    return message[replyMethod]('❌ Geçersiz alt komut! Kullanım: `!antiraid <enable/disable/status>`');
            }

        } catch (error) {
            logger.error('Anti-raid komutu hatası:', error);
            const replyMethod = isSlash ? 'reply' : 'reply';
            await message[replyMethod]('❌ Anti-raid komutu çalıştırılırken bir hata oluştu!');
        }
    }
};

// Anti-raid event handler - diğer dosyalarda kullanmak için export
module.exports.antiRaidSettings = antiRaidSettings;