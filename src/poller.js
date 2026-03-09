import pino from 'pino';
import { fetchNewMessages, fetchLatestMessageId } from './telegram.js';
import { getState, setState } from './db.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Initialize checkpoints for channels that have no saved cursor (cold start).
 * Fetches the latest message ID and saves it so polling starts from "now".
 */
async function initCheckpoints(client, channels) {
    for (const channel of channels) {
        if (!channel.enabled || !channel.resolvedId) continue;

        const cursorKey = `poll_cursor:${channel.resolvedId}`;
        if (getState(cursorKey)) continue;

        try {
            // Fetch the LATEST message ID (no reverse — newest first, limit 1)
            const latestId = await fetchLatestMessageId(client, channel);
            if (latestId !== null) {
                setState(cursorKey, latestId.toString());
                logger.info({ channel: channel.label, cursor: latestId }, 'Cold start: checkpoint set to latest message');
            } else {
                // Empty channel — set cursor to 0
                setState(cursorKey, '0');
                logger.info({ channel: channel.label }, 'Cold start: channel is empty, cursor set to 0');
            }
        } catch (err) {
            logger.warn({ channel: channel.label, err: err.message }, 'Cold start: failed to initialize checkpoint, will retry next cycle');
        }
    }
}

/**
 * Main polling loop. Iterates over channels, fetches new messages since last checkpoint,
 * processes each message, and updates the checkpoint after each successful processing.
 *
 * @param {object} client - GramJS TelegramClient
 * @param {Array} channels - Array of channel configs with resolvedId
 * @param {Function} processMessage - async (tgMsg, channelConfig) => void
 * @param {object} options - { intervalMs, logger }
 */
export async function startPollingLoop(client, channels, processMessage, options = {}) {
    const { intervalMs = 60000 } = options;

    // Cold start: initialize checkpoints for new channels
    await initCheckpoints(client, channels);

    logger.info({ intervalMs, channelCount: channels.filter(c => c.enabled).length }, 'Polling loop started');

    while (true) {
        logger.debug('Polling cycle started');

        for (const channel of channels) {
            if (!channel.enabled || !channel.resolvedId) continue;

            try {
                const cursorKey = `poll_cursor:${channel.resolvedId}`;
                const lastId = parseInt(getState(cursorKey) || '0', 10);

                const messages = await fetchNewMessages(client, channel, lastId);

                if (messages.length > 0) {
                    logger.info({ channel: channel.label, count: messages.length, fromId: lastId }, 'Fetched new messages');
                } else {
                    logger.debug({ channel: channel.label, cursor: lastId }, 'No new messages');
                }

                for (const msg of messages) {
                    try {
                        await processMessage(msg, channel);
                    } catch (msgErr) {
                        logger.error({ channel: channel.label, msgId: msg.id, err: msgErr.message }, 'Error processing message, continuing');
                    }
                    // Update checkpoint after each message regardless of processing result
                    // to avoid reprocessing (dedup in DB handles safety)
                    setState(cursorKey, msg.id.toString());
                }
            } catch (err) {
                logger.error({ channel: channel.label, err: err.message }, 'Error polling channel, skipping to next');
            }
        }

        logger.debug('Polling cycle finished, sleeping');
        await sleep(intervalMs);
    }
}
