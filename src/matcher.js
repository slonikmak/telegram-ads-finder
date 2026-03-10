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
        if (rule.exclude_stemmed && rule.exclude_stemmed.length > 0) {
            const hasExclude = rule.exclude_stemmed.some(phraseStems =>
                phraseStems.every(stem => message.tokens_stemmed.includes(stem))
            );
            if (hasExclude) continue;
        } else if (rule.exclude && rule.exclude.length > 0) {
            const hasExclude = rule.exclude.some(kw => message.text_normalized.includes(kw.toLowerCase()));
            if (hasExclude) continue;
        }

        // 3. Check keywords_any
        if (rule.keywords_any_stemmed && rule.keywords_any_stemmed.length > 0) {
            const hasAny = rule.keywords_any_stemmed.some(phraseStems =>
                phraseStems.every(stem => message.tokens_stemmed.includes(stem))
            );
            if (!hasAny) continue;
        } else if (rule.keywords_any && rule.keywords_any.length > 0) {
            const hasAny = rule.keywords_any.some(kw => message.text_normalized.includes(kw.toLowerCase()));
            if (!hasAny) continue;
        }

        // 4. Check keywords_all
        if (rule.keywords_all_stemmed && rule.keywords_all_stemmed.length > 0) {
            const hasAll = rule.keywords_all_stemmed.every(phraseStems =>
                phraseStems.every(stem => message.tokens_stemmed.includes(stem))
            );
            if (!hasAll) continue;
        } else if (rule.keywords_all && rule.keywords_all.length > 0) {
            const hasAll = rule.keywords_all.every(kw => message.text_normalized.includes(kw.toLowerCase()));
            if (!hasAll) continue;
        }

        // 5. Check price
        if (rule.price) {
            const pricesToCheck = message.prices || (message.price_value !== null ? [{
                value: message.price_value,
                currency: message.price_currency
            }] : []);

            if (rule.price.require_detected && pricesToCheck.length === 0) {
                continue;
            }

            let triggeredPrice = null;

            if (pricesToCheck.length > 0) {
                const ruleCurrency = rule.price.currency || appConfig.app.base_currency;

                triggeredPrice = pricesToCheck.find(p => {
                    const priceInRuleCurrency = convertPrice(
                        p.value,
                        p.currency,
                        ruleCurrency,
                        appConfig.exchange_rates
                    );

                    if (rule.price.min !== null && priceInRuleCurrency < rule.price.min) return false;
                    if (rule.price.max !== null && priceInRuleCurrency > rule.price.max) return false;

                    return true;
                });

                if (!triggeredPrice) continue;
            }

            // Everything passed!
            matches.push({
                ruleId: rule.id,
                messageId: message.id,
                matchedPrice: triggeredPrice ? triggeredPrice.value : message.price_value,
                matchedCurrency: triggeredPrice ? triggeredPrice.currency : message.price_currency,
                score: 1.0
            });
        } else {
            // No price filter in rule, everything passed!
            matches.push({
                ruleId: rule.id,
                messageId: message.id,
                matchedPrice: message.price_value,
                matchedCurrency: message.price_currency,
                score: 1.0
            });
        }
    }

    return matches;
}
