const config = require('../config.json');
const logger = require('../utils/logger');

module.exports = async (message) => {
    // Bot'un kendi mesajlarını yoksay
    if (message.author.bot) return;
    
    // DM'leri yoksay
    if (!message.guild) return;
    
    // Prefix kontrolü
    if (!message.content.startsWith(config.prefix)) return;
    
    try {
        // Komutu ve argümanları ayıkla
        const args = message.content.slice(config.prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        
        // Komutu bul
        const command = message.client.commands.get(commandName);
        if (!command) return;
        
        // Komutu çalıştır
        await command.execute(message, args, false);
        
        logger.info(`${message.author.tag} kullanıcısı "${commandName}" komutunu kullandı.`);
        
    } catch (error) {
        logger.error('Komut işleme hatası:', error);
        
        try {
            await message.reply('❌ Komut çalıştırılırken bir hata oluştu!');
        } catch (replyError) {
            logger.error('Hata mesajı gönderilirken hata:', replyError);
        }
    }
};
