import TelegramBot from 'node-telegram-bot-api';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

let bot;
let allowedUsers = [];

export function initNotifier(token, allowedUsersStr, callbacks = {}) {
    if (!token || !allowedUsersStr) {
        logger.warn('Notifier not initialized: missing token or allowed users');
        return;
    }
    bot = new TelegramBot(token, { polling: true });

    allowedUsers = allowedUsersStr.toString().split(',').map(id => id.trim()).filter(id => id);

    const { getChannels, getRules } = callbacks;

    bot.on('message', async (msg) => {
        if (!msg.text) return;
        const senderId = msg.chat.id.toString();

        if (!allowedUsers.includes(senderId)) {
            logger.warn({ receivedId: senderId, authorizedIds: allowedUsers }, 'Unauthorized message received');
            return;
        }

        const text = msg.text.trim();

        if (text === '/start') {
            await bot.sendMessage(senderId, '🤖 <b>Telegram Advanced Search Bot</b>\n\nДоступные команды:\n/channels - Список отслеживаемых каналов\n/rules - Список активных правил (подписок)\n/help - Справка', { parse_mode: 'HTML' });
        } else if (text === '/channels') {
            if (!getChannels) return;
            const channels = getChannels();
            if (!channels || channels.length === 0) {
                await bot.sendMessage(senderId, 'Список каналов пуст.');
                return;
            }
            let resp = '<b>📋 Отслеживаемые каналы:</b>\n\n';
            channels.forEach((ch, idx) => {
                const status = ch.enabled ? '✅' : '❌';
                resp += `${idx + 1}. ${status} <b>${ch.label || ch.id}</b>\n`;
                resp += `   ID: <code>${ch.id}</code>\n`;
                if (ch.topics?.length) resp += `   Темы: ${ch.topics.join(', ')}\n`;
                resp += '\n';
            });
            await bot.sendMessage(senderId, resp, { parse_mode: 'HTML' });
        } else if (text === '/rules') {
            if (!getRules) return;
            const rules = getRules();
            if (!rules || rules.length === 0) {
                await bot.sendMessage(senderId, 'Список правил пуст.');
                return;
            }
            let resp = '<b>🔔 Настроенные подписки:</b>\n\n';
            rules.forEach((r, idx) => {
                const status = r.enabled ? '✅' : '❌';
                resp += `${idx + 1}. ${status} <b>${r.name}</b>\n`;
                resp += `   ID: <code>${r.id}</code>\n`;
                if (r.price) {
                    const min = r.price.min !== null ? r.price.min : '0';
                    const max = r.price.max !== null ? r.price.max : '∞';
                    resp += `   Цена: ${min} - ${max} ${r.price.currency}\n`;
                }
                resp += '\n';
            });
            await bot.sendMessage(senderId, resp, { parse_mode: 'HTML' });
        } else if (text === '/help') {
            await bot.sendMessage(senderId, 'Команды:\n/channels - показать список каналов\n/rules - показать список правил');
        }
    });

    logger.info('Bot polling enabled and command handlers registered');
}

export async function sendTelegramNotification(payload) {
    if (!bot || allowedUsers.length === 0) {
        logger.warn('Cannot send notification: bot or allowed_users not set');
        return { status: 'skipped', error: 'Not initialized' };
    }

    const { match, message, rule } = payload;

    // Format message
    const dateStr = new Date(message.message_date).toLocaleString('ru-RU');
    const priceStr = message.price_value !== null ? `${message.price_value} ${message.price_currency}` : 'Не указана';

    let text = `🎯 <b>Совпадение: ${rule.name}</b>\n\n`;
    text += `<b>Канал:</b> ${message.channel_label || message.channel_id}\n`;
    text += `<b>Цена:</b> ${priceStr}\n`;
    text += `<b>Дата:</b> ${dateStr}\n\n`;
    text += `${message.text_raw.substring(0, 500)}${message.text_raw.length > 500 ? '...' : ''}\n\n`;

    if (message.message_link) {
        text += `🔗 <a href="${message.message_link}">Ссылка на пост</a>`;
    }

    let success = false;
    let errors = [];

    for (const userId of allowedUsers) {
        try {
            await bot.sendMessage(userId, text, { parse_mode: 'HTML', disable_web_page_preview: true });
            success = true;
        } catch (error) {
            logger.error({ error, userId }, 'Failed to send notification');
            errors.push(error.message);
        }
    }

    if (success) {
        return { status: 'sent' };
    } else {
        return { status: 'failed', error: errors.join(', ') };
    }
}
