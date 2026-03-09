import { convertPrice } from './price.js';

export function matchMessage(message, rules, appConfig) {
    const matches = [];

    for (const rule of rules) {
        if (!rule.enabled) continue;

        // 1. Check scope
        if (rule.scope && rule.scope.include_channels && rule.scope.include_channels.length > 0) {
            if (!rule.scope.include_channels.includes(message.channel_id)) continue;
        }

        if (rule.scope && rule.scope.exclude_channels && rule.scope.exclude_channels.length > 0) {
            if (rule.scope.exclude_channels.includes(message.channel_id)) continue;
        }

        // 2. Check exclude keywords
        if (rule.exclude && rule.exclude.length > 0) {
            const hasExclude = rule.exclude.some(kw => message.text_normalized.includes(kw.toLowerCase()));
            if (hasExclude) continue;
        }

        // 3. Check keywords_any
        if (rule.keywords_any && rule.keywords_any.length > 0) {
            const hasAny = rule.keywords_any.some(kw => message.text_normalized.includes(kw.toLowerCase()));
            if (!hasAny) continue;
        }

        // 4. Check keywords_all
        if (rule.keywords_all && rule.keywords_all.length > 0) {
            const hasAll = rule.keywords_all.every(kw => message.text_normalized.includes(kw.toLowerCase()));
            if (!hasAll) continue;
        }

        // 5. Check price
        if (rule.price) {
            if (rule.price.require_detected && message.price_value === null) {
                continue;
            }

            if (message.price_value !== null) {
                const ruleCurrency = rule.price.currency || appConfig.app.base_currency;
                const messagePriceInRuleCurrency = convertPrice(
                    message.price_value,
                    message.price_currency,
                    ruleCurrency,
                    appConfig.exchange_rates
                );

                if (rule.price.min !== null && messagePriceInRuleCurrency < rule.price.min) continue;
                if (rule.price.max !== null && messagePriceInRuleCurrency > rule.price.max) continue;
            }
        }

        // Everything passed!
        matches.push({
            ruleId: rule.id,
            messageId: message.id,
            matchedPrice: message.price_value,
            matchedCurrency: message.price_currency,
            score: 1.0
        });
    }

    return matches;
}
