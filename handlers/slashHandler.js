const logger = require('../utils/logger');

module.exports = async (interaction) => {
    // Sadece slash komutları için
    if (!interaction.isChatInputCommand()) return;
    
    try {
        // Komutu bul
        const command = interaction.client.slashCommands.get(interaction.commandName);
        if (!command) {
            return interaction.reply({
                content: '❌ Bu komut bulunamadı!',
                ephemeral: true
            });
        }
        
        // Komutu çalıştır
        await command.execute(interaction, [], true);
        
        logger.info(`${interaction.user.tag} kullanıcısı "/${interaction.commandName}" slash komutunu kullandı.`);
        
    } catch (error) {
        logger.error('Slash komut işleme hatası:', error);
        
        try {
            const errorMessage = {
                content: '❌ Komut çalıştırılırken bir hata oluştu!',
                ephemeral: true
            };
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        } catch (replyError) {
            logger.error('Hata mesajı gönderilirken hata:', replyError);
        }
    }
};
