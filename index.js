const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const config = require('./config.json');
const logger = require('./utils/logger');

// Bot istemcisini oluştur
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration
    ]
});

// Komut koleksiyonları
client.commands = new Collection();
client.slashCommands = new Collection();

// Komut dosyalarını yükle
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    
    // Prefix komutları
    if (command.name) {
        client.commands.set(command.name, command);
    }
    
    // Slash komutları
    if (command.data) {
        client.slashCommands.set(command.data.name, command);
    }
}

// Event handler'ları yükle
const commandHandler = require('./handlers/commandHandler');
const slashHandler = require('./handlers/slashHandler');
const { handleMemberJoin, handleMemberLeave } = require('./handlers/antiRaidHandler');
const { handleGuildBanAdd, handleGuildBanRemove } = require('./handlers/auditLogHandler');
const { handleGuildKick } = require('./handlers/auditLogKickHandler');

client.once('ready', async () => {
    logger.info(`${client.user.tag} başarıyla giriş yaptı!`);
    
    // Slash komutlarını kaydet
    const commands = [];
    client.slashCommands.forEach(command => {
        commands.push(command.data.toJSON());
    });
    
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN || config.token);
    
    try {
        logger.info('Slash komutları kaydediliyor...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        logger.info('Slash komutları başarıyla kaydedildi!');
    } catch (error) {
        logger.error('Slash komutları kaydedilirken hata:', error);
    }
    
    // Bot durumunu ayarla
    client.user.setActivity('Sunucuyu koruyor', { type: 'WATCHING' });
});

// Mesaj eventi (prefix komutları için)
client.on('messageCreate', commandHandler);

// Slash komut eventi
client.on('interactionCreate', slashHandler);

// Anti-raid eventi
client.on('guildMemberAdd', handleMemberJoin);
client.on('guildMemberRemove', handleMemberLeave);

// Ban audit log eventi - tüm ban işlemlerini izler (bot + manuel)
client.on('guildBanAdd', handleGuildBanAdd);
client.on('guildBanRemove', handleGuildBanRemove);

// Kick audit log eventi - tüm kick işlemlerini izler (bot + manuel)
client.on('guildMemberRemove', async (member) => {
    // Sadece kick işlemleri için (ayrılma değil)
    if (member.user.bot) return; // Bot'ları yoksay
    
    // Kısa bir bekleme sonrası audit log kontrol et
    setTimeout(async () => {
        await handleGuildKick(member.guild, member.user);
    }, 1000);
});

// Hata yakalama
client.on('error', error => {
    logger.error('Bot hatası:', error);
});

process.on('unhandledRejection', error => {
    logger.error('İşlenmemiş Promise hatası:', error);
});

// Bot'u başlat
const token = process.env.DISCORD_TOKEN || config.token;
if (!token) {
    logger.error('Bot token bulunamadı! Environment variable veya config.json dosyasında DISCORD_TOKEN belirtiniz.');
    process.exit(1);
}

client.login(token).catch(error => {
    logger.error('Bot giriş hatası:', error);
    process.exit(1);
});

module.exports = client;
