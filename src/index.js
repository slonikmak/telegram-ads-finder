import 'dotenv/config';
import path from 'path';
import pino from 'pino';
import { loadAppConfig, loadChannelsConfig, loadRulesConfig, validateConfigs } from './config.js';
import { initDb, insertMessage, insertMatch, insertNotification, findRecentDuplicateByHash } from './db.js';
import { normalizeText } from './normalize.js';
import { extractPrice } from './price.js';
import { getContentHash } from './hash.js';
import { matchMessage } from './matcher.js';
import { initNotifier, sendTelegramNotification } from './notifier.js';
import { startTelegramClient } from './telegram.js';
import { startPollingLoop } from './poller.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

/**
 * GramJS может возвращать channelId как BigInt из PeerChannel
 * и как обычное Number из entity.id — нормализуем оба к строке.
 */
function normalizeChannelId(id) {
    if (id === null || id === undefined) return null;
    // BigInt → string, Number → string, убираем знак минус если есть
    return BigInt(id).toString().replace('-', '');
}

/**
 * Process a single Telegram message through the full pipeline:
 * topic filtering → normalization → price extraction → dedup → matching → notification.
 *
 * @param {object} tgMsg - GramJS Message object
 * @param {object} channelConfig - Channel config from channels.yaml (with resolvedId, resolvedTitle, etc.)
 * @param {object} context - { channels, rules, appConfig, client }
 */
async function processMessage(tgMsg, channelConfig, context) {
    const { rules, appConfig } = context;

    const channelId = channelConfig.resolvedId;
    const channelName = channelConfig.resolvedTitle || channelConfig.label || `Channel ${channelId}`;
    const username = channelConfig.resolvedUsername;

    const msgLink = username
        ? `https://t.me/${username}/${tgMsg.id}`
        : (channelId ? `https://t.me/c/${channelId}/${tgMsg.id}` : null);

    logger.debug({ link: msgLink, channel: channelName }, 'Processing message');

    // Determine the actual topic ID for forum supergroups
    const replyTo = tgMsg.replyTo || tgMsg.reply_to || null;
    const replyToTopId = replyTo?.replyToTopId ?? replyTo?.reply_to_top_id ?? null;
    const replyToMsgId = replyTo?.replyToMsgId ?? replyTo?.reply_to_msg_id ?? null;
    const isTopicCreate = tgMsg.action && tgMsg.action.className === "MessageActionTopicCreate";

    let topicId = replyToTopId;
    if (!topicId && (replyTo?.forumTopic || replyTo?.forum_topic)) {
        topicId = replyToMsgId;
    }
    if (isTopicCreate) {
        topicId = tgMsg.id;
    }

    // Filter by topic if topics are specified for this channel
    if (channelConfig && channelConfig.topics && channelConfig.topics.length > 0) {
        if (topicId) {
            if (!channelConfig.topics.includes(topicId)) {
                logger.debug({ channelId, topicId, allowedTopics: channelConfig.topics }, 'Message skipped: not in allowed topics');
                return;
            }
            logger.debug({ channelId, channel: channelName, topicId }, 'Topic filter passed');
        } else {
            logger.debug({ channelId, hasReplyTo: !!replyTo }, 'Message in forum group has no topic info, skipping');
            return;
        }
    }

    const textRaw = tgMsg.message || '';
    if (!textRaw || !channelId) {
        logger.trace({ channelId, hasText: !!textRaw, isTopicCreate, topicId }, 'Message skipped: no text or no channel ID');
        return;
    }

    const textNormalized = normalizeText(textRaw);
    const price = extractPrice(textNormalized, appConfig);
    const hash = getContentHash(textNormalized, price.value, price.currency);

    // Deduplication check
    const existing = findRecentDuplicateByHash(hash);
    if (existing) {
        logger.trace({ hash }, 'Duplicate message skipped');
        return;
    }

    // Build message entity
    const msgEntity = {
        channel_id: channelId,
        channel_label: channelName,
        telegram_message_id: tgMsg.id,
        topic_id: topicId,
        message_date: new Date(tgMsg.date * 1000).toISOString(),
        text_raw: textRaw,
        text_normalized: textNormalized,
        price_raw: price.raw,
        price_value: price.value,
        price_currency: price.currency,
        price_value_eur: price.value_eur,
        fx_rate_used: price.fx_rate_used,
        fx_date: new Date().toISOString(),
        message_link: msgLink,
        content_hash: hash
    };

    const messageId = insertMessage(msgEntity);
    if (!messageId) {
        logger.trace({ channelId, tgId: tgMsg.id }, 'Message already exists in DB, skipping');
        return;
    }
    msgEntity.id = messageId;

    // Matching
    const matches = matchMessage(msgEntity, rules, appConfig);
    for (const m of matches) {
        const matchId = insertMatch(m);
        logger.info({ ruleId: m.ruleId, messageId }, 'Match found!');

        if (!appConfig.app.dry_run && appConfig.notifications.enabled) {
            const rule = rules.find(r => r.id === m.ruleId);
            const result = await sendTelegramNotification({ match: m, message: msgEntity, rule });
            insertNotification({
                matchId,
                method: 'telegram',
                status: result.status,
                errorText: result.error
            });
        }
    }
}

async function main() {
    try {
        const configDir = path.join(process.cwd(), 'config');
        const appConfig = loadAppConfig(configDir);
        const channels = loadChannelsConfig(configDir);
        const rules = loadRulesConfig(configDir);

        validateConfigs(appConfig, channels, rules);
        logger.info('Configs loaded and validated');

        // Init DB
        const dbPath = process.env.SQLITE_PATH || './data/app.db';
        initDb(dbPath);
        logger.info(`DB initialized at ${dbPath}`);

        // Init Notifier
        if (appConfig.notifications.enabled) {
            initNotifier(process.env.NOTIFY_BOT_TOKEN, process.env.ALLOWED_USERS || process.env.NOTIFY_CHAT_ID, {
                getChannels: () => loadChannelsConfig(configDir),
                getRules: () => loadRulesConfig(configDir)
            });
            logger.info('Notifier initialized');
        }

        // 1. Connect Telegram Client
        const client = await startTelegramClient({
            apiId: process.env.API_ID,
            apiHash: process.env.API_HASH,
            sessionPath: process.env.SESSION_DIR,
        });

        // 2. Resolve channel IDs before polling
        for (const ch of channels) {
            try {
                const isNumericId = /^\d+$/.test(ch.id);
                if (isNumericId) {
                    ch.resolvedId = normalizeChannelId(ch.id);
                    logger.info({ id: ch.id, resolvedId: ch.resolvedId, label: ch.label }, 'Channel registered by numeric ID');
                    continue;
                }
                // @username — resolve via GramJS
                const entity = await client.getEntity(ch.id);
                ch.resolvedId = normalizeChannelId(entity.id);
                if (entity.title) ch.resolvedTitle = entity.title;
                if (entity.username) ch.resolvedUsername = entity.username;
                logger.info({ id: ch.id, resolvedId: ch.resolvedId, title: ch.resolvedTitle }, 'Resolved channel details');
            } catch (err) {
                logger.error({ id: ch.id, err: err.message }, 'Could not resolve channel details on startup');
            }
        }

        // 3. Polling interval from config
        const intervalMs = (appConfig.polling?.interval_seconds || 60) * 1000;

        // 4. Create bound processMessage with shared context
        const context = { channels, rules, appConfig, client };
        const boundProcessMessage = (tgMsg, channelConfig) => processMessage(tgMsg, channelConfig, context);

        // 5. Start polling loop (runs indefinitely)
        logger.info('Starting polling-based message ingestion...');
        await startPollingLoop(client, channels, boundProcessMessage, { intervalMs });

    } catch (error) {
        logger.error({ error }, 'Fatal error during startup');
        process.exit(1);
    }
}

main();
