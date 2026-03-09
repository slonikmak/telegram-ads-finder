import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import readline from 'readline';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

const input = (text) => new Promise((resolve) => rl.question(text, resolve));

export async function startTelegramClient({ apiId, apiHash, sessionPath }) {
    if (!fs.existsSync(sessionPath)) {
        fs.mkdirSync(sessionPath, { recursive: true });
    }

    const sessionFile = path.join(sessionPath, 'session.txt');
    let sessionString = '';
    if (fs.existsSync(sessionFile)) {
        sessionString = fs.readFileSync(sessionFile, 'utf8').trim();
    }

    const client = new TelegramClient(new StringSession(sessionString), parseInt(apiId), apiHash, {
        connectionRetries: 5,
    });

    await client.start({
        phoneNumber: async () => await input("Please enter your number (e.g. +79991234567): "),
        password: async () => await input("Please enter your password (2FA): "),
        phoneCode: async (isCodeViaApp) => {
            const method = isCodeViaApp ? "App" : "SMS";
            logger.info(`Telegram sent the code via ${method}`);
            return await input(`Please enter the code you received via ${method}: `);
        },
        onError: (err) => logger.error({ err }, 'Telegram client error'),
    });

    logger.info('Telegram client started');

    // Populate entity cache by fetching some dialogs
    try {
        await client.getDialogs({ limit: 50 });
        logger.debug('Entity cache populated from dialogs');
    } catch (err) {
        logger.warn({ err: err.message }, 'Failed to fetch dialogs, entity resolution might be unstable');
    }

    // Save session
    const finalSession = client.session.save();
    fs.writeFileSync(sessionFile, finalSession, 'utf8');
    logger.info('Session saved to ' + sessionFile);

    return client;
}

/**
 * Fetch new messages from a channel since the given minId.
 * Uses iterMessages with reverse=true to get messages in chronological order.
 * 
 * @param {TelegramClient} client - GramJS client
 * @param {object} channel - Channel config with resolvedId
 * @param {number} minId - Last processed message ID (exclusive)
 * @param {number} [limit] - Max messages to fetch (default: 100)
 * @returns {Promise<Array>} Array of GramJS Message objects, oldest first
 */
export async function fetchNewMessages(client, channel, minId, limit = 100) {
    const entity = channel.resolvedEntity || channel.id;
    const messages = [];

    try {
        for await (const msg of client.iterMessages(entity, {
            minId: minId,
            reverse: true,
            limit: limit,
            waitTime: 2,
        })) {
            messages.push(msg);
        }
    } catch (err) {
        if (err.errorMessage === 'FLOOD_WAIT' || err.className === 'FloodWaitError' ||
            (err.message && err.message.includes('FLOOD'))) {
            const waitSeconds = err.seconds || 30;
            logger.warn({ channel: channel.label, waitSeconds }, 'FloodWait hit, skipping channel this cycle');
            return messages; // return whatever we got so far
        }
        throw err;
    }

    return messages;
}

/**
 * Get the ID of the most recent message in a channel.
 * Used for cold start checkpoint initialization.
 * iterMessages WITHOUT reverse=true returns newest messages first.
 *
 * @param {TelegramClient} client
 * @param {object} channel - Channel config with .id
 * @returns {Promise<number|null>} Latest message ID, or null if channel is empty
 */
export async function fetchLatestMessageId(client, channel) {
    try {
        const entity = channel.resolvedEntity || channel.id;
        for await (const msg of client.iterMessages(entity, { limit: 1 })) {
            return msg.id;
        }
        return null;
    } catch (err) {
        if (err.errorMessage === 'FLOOD_WAIT' || err.className === 'FloodWaitError' ||
            (err.message && err.message.includes('FLOOD'))) {
            logger.warn({ channel: channel.label }, 'FloodWait during cold start, will retry');
            return null;
        }
        throw err;
    }
}

export async function resolveChannelId(client, identifier) {
    try {
        const entity = await client.getEntity(identifier);
        return entity.id.toString();
    } catch (error) {
        logger.error({ error, identifier }, 'Failed to resolve channel identifier');
        return null;
    }
}
