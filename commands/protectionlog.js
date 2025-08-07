const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } = require('discord.js');
const { checkPermissions } = require('../utils/permissions');
const config = require('../config.json');
const logger = require('../utils/logger');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('protectionlog')
        .setDescription('Koruma sistemleri için log kanallarını ayarla')
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Koruma sistemi için log kanalı ayarla')
                .addStringOption(option =>
                    option.setName('sistem')
                        .setDescription('Koruma sistemi türü')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Ban Abuse Koruması', value: 'banprotection' },
                            { name: 'Kick Abuse Koruması', value: 'kickprotection' },
                            { name: 'Anti-Raid Koruması', value: 'antiraid' }
                        ))
                .addChannelOption(option =>
                    option.setName('kanal')
                        .setDescription('Log kanalı')
                        .setRequired(true)
                        .addChannelTypes(ChannelType.GuildText)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Koruma sistemi log kanalını kaldır')
                .addStringOption(option =>
                    option.setName('sistem')
                        .setDescription('Koruma sistemi türü')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Ban Abuse Koruması', value: 'banprotection' },
                            { name: 'Kick Abuse Koruması', value: 'kickprotection' },
                            { name: 'Anti-Raid Koruması', value: 'antiraid' }
                        )))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Tüm koruma sistemi log kanallarını listele'))
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

            let subcommand, protectionType, channel;

            if (isSlash) {
                subcommand = message.options.getSubcommand();
                protectionType = message.options.getString('sistem');
                channel = message.options.getChannel('kanal');
            } else {
                subcommand = args[0]?.toLowerCase();
                protectionType = args[1]?.toLowerCase();
                
                if (subcommand === 'set') {
                    const channelMention = args[2];
                    if (channelMention) {
                        const channelId = channelMention.replace(/[<#>]/g, '');
                        channel = message.guild.channels.cache.get(channelId);
                    }
                }
            }

            // Config dosyasını oku
            let configData = { ...config };
            
            // Koruma log kanalları bölümü yoksa oluştur
            if (!configData.protectionLogChannels) {
                configData.protectionLogChannels = {};
            }

            const embed = new EmbedBuilder()
                .setColor(config.embedColors.success)
                .setTimestamp();

            if (subcommand === 'set') {
                if (!protectionType || !channel) {
                    embed.setColor(config.embedColors.error)
                        .setTitle('❌ Eksik Parametre')
                        .setDescription('Kullanım: `!protectionlog set <sistem> <#kanal>` veya `/protectionlog set`');
                    
                    const replyMethod = isSlash ? 'reply' : 'reply';
                    return await message[replyMethod]({ embeds: [embed] });
                }

                // Koruma türünü eşleştir
                const protectionTypeMap = {
                    'banprotection': 'banprotection',
                    'bankoruma': 'banprotection',
                    'banabuse': 'banprotection',
                    'kickprotection': 'kickprotection',
                    'kickkoruma': 'kickprotection',
                    'kickabuse': 'kickprotection',
                    'antiraid': 'antiraid',
                    'raidkoruma': 'antiraid',
                    'raid': 'antiraid'
                };

                const mappedType = protectionTypeMap[protectionType] || protectionType;

                // Kanal tipini kontrol et
                if (channel.type !== ChannelType.GuildText) {
                    embed.setColor(config.embedColors.error)
                        .setTitle('❌ Geçersiz Kanal')
                        .setDescription('Sadece metin kanalları log kanalı olarak ayarlanabilir.');
                    
                    const replyMethod = isSlash ? 'reply' : 'reply';
                    return await message[replyMethod]({ embeds: [embed] });
                }

                // Log kanalını ayarla
                configData.protectionLogChannels[mappedType] = channel.id;

                // Config dosyasını kaydet
                fs.writeFileSync('./config.json', JSON.stringify(configData, null, 4));

                const protectionNames = {
                    'banprotection': 'Ban Abuse Koruması',
                    'kickprotection': 'Kick Abuse Koruması',
                    'antiraid': 'Anti-Raid Koruması'
                };

                embed.setTitle('🛡️ Koruma Log Kanalı Ayarlandı')
                    .setDescription(`**${protectionNames[mappedType]}** log kanalı ${channel} olarak ayarlandı.`)
                    .addFields({
                        name: 'Koruma Sistemi',
                        value: protectionNames[mappedType],
                        inline: true
                    }, {
                        name: 'Log Kanalı',
                        value: channel.toString(),
                        inline: true
                    });

                logger.info(`${message.member.user.tag} tarafından ${mappedType} koruma log kanalı ${channel.name} olarak ayarlandı`);

            } else if (subcommand === 'remove') {
                if (!protectionType) {
                    embed.setColor(config.embedColors.error)
                        .setTitle('❌ Eksik Parametre')
                        .setDescription('Kullanım: `!protectionlog remove <sistem>` veya `/protectionlog remove`');
                    
                    const replyMethod = isSlash ? 'reply' : 'reply';
                    return await message[replyMethod]({ embeds: [embed] });
                }

                const protectionTypeMap = {
                    'banprotection': 'banprotection',
                    'bankoruma': 'banprotection',
                    'banabuse': 'banprotection',
                    'kickprotection': 'kickprotection',
                    'kickkoruma': 'kickprotection',
                    'kickabuse': 'kickprotection',
                    'antiraid': 'antiraid',
                    'raidkoruma': 'antiraid',
                    'raid': 'antiraid'
                };

                const mappedType = protectionTypeMap[protectionType] || protectionType;

                if (configData.protectionLogChannels[mappedType]) {
                    delete configData.protectionLogChannels[mappedType];
                    fs.writeFileSync('./config.json', JSON.stringify(configData, null, 4));

                    const protectionNames = {
                        'banprotection': 'Ban Abuse Koruması',
                        'kickprotection': 'Kick Abuse Koruması',
                        'antiraid': 'Anti-Raid Koruması'
                    };

                    embed.setTitle('🛡️ Koruma Log Kanalı Kaldırıldı')
                        .setDescription(`**${protectionNames[mappedType]}** log kanalı kaldırıldı.`);

                    logger.info(`${message.member.user.tag} tarafından ${mappedType} koruma log kanalı kaldırıldı`);
                } else {
                    embed.setColor(config.embedColors.error)
                        .setTitle('❌ Log Kanalı Bulunamadı')
                        .setDescription('Bu koruma sistemi için ayarlanmış bir kanal bulunamadı.');
                }

            } else if (subcommand === 'list') {
                embed.setTitle('🛡️ Koruma Sistemi Log Kanalları')
                    .setDescription('Ayarlanmış koruma log kanalları:');

                const protectionNames = {
                    'banprotection': 'Ban Abuse Koruması',
                    'kickprotection': 'Kick Abuse Koruması',
                    'antiraid': 'Anti-Raid Koruması'
                };

                let hasChannels = false;
                const fields = [];

                for (const [type, channelId] of Object.entries(configData.protectionLogChannels || {})) {
                    const channel = message.guild.channels.cache.get(channelId);
                    if (channel) {
                        fields.push({
                            name: protectionNames[type] || type,
                            value: `<#${channelId}>`,
                            inline: true
                        });
                        hasChannels = true;
                    }
                }

                if (hasChannels) {
                    embed.addFields(fields);
                } else {
                    embed.setDescription('Henüz hiç koruma log kanalı ayarlanmamış.\n\n**Ayarlayabileceğiniz Sistemler:**\n🚨 Ban Abuse Koruması\n⚠️ Kick Abuse Koruması\n⚔️ Anti-Raid Koruması');
                }

            } else {
                embed.setColor(config.embedColors.error)
                    .setTitle('❌ Geçersiz Komut')
                    .setDescription('Kullanım: `!protectionlog <set|remove|list>` veya `/protectionlog`');
            }

            const replyMethod = isSlash ? 'reply' : 'reply';
            await message[replyMethod]({ embeds: [embed] });

            if (isSlash) {
                logger.info(`${message.member.user.tag} kullanıcısı "/protectionlog" slash komutunu kullandı.`);
            } else {
                logger.info(`${message.member.user.tag} kullanıcısı "!protectionlog" komutunu kullandı.`);
            }

        } catch (error) {
            logger.error('Koruma log kanalı komutu hatası:', error);
            
            const embed = new EmbedBuilder()
                .setColor(config.embedColors.error)
                .setTitle('❌ Hata')
                .setDescription('Koruma log kanalı ayarlanırken bir hata oluştu.')
                .setTimestamp();

            const replyMethod = isSlash ? 'reply' : 'reply';
            await message[replyMethod]({ embeds: [embed] });
        }
    }
};