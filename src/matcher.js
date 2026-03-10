import { convertPrice } from './price.js';

/**
 * Check if the message matches the rule scope (include/exclude channels)
 */
function checkScope(rule, message) {
    if (rule.scope && rule.scope.include_channels && rule.scope.include_channels.length > 0) {
        if (!rule.scope.include_channels.includes(message.channel_id)) return false;
    }

    if (rule.scope && rule.scope.exclude_channels && rule.scope.exclude_channels.length > 0) {
        if (rule.scope.exclude_channels.includes(message.channel_id)) return false;
    }

    return true;
}

/**
 * Check if the message contains any excluded keywords
 */
function checkExclude(rule, message) {
    if (rule.exclude_stemmed && rule.exclude_stemmed.length > 0) {
        const hasExclude = rule.exclude_stemmed.some(phraseStems =>
            phraseStems.every(stem => message.tokens_stemmed.includes(stem))
        );
        if (hasExclude) return false;
    } else if (rule.exclude && rule.exclude.length > 0) {
        const hasExclude = rule.exclude.some(kw => message.text_normalized.includes(kw.toLowerCase()));
        if (hasExclude) return false;
    }

    return true;
}

/**
 * Check if the message matches 'keywords_any' requirement
 */
function checkKeywordsAny(rule, message) {
    if (rule.keywords_any_stemmed && rule.keywords_any_stemmed.length > 0) {
        const hasAny = rule.keywords_any_stemmed.some(phraseStems =>
            phraseStems.every(stem => message.tokens_stemmed.includes(stem))
        );
        if (!hasAny) return false;
    } else if (rule.keywords_any && rule.keywords_any.length > 0) {
        const hasAny = rule.keywords_any.some(kw => message.text_normalized.includes(kw.toLowerCase()));
        if (!hasAny) return false;
    }

    return true;
}

/**
 * Check if the message matches 'keywords_all' requirement
 */
function checkKeywordsAll(rule, message) {
    if (rule.keywords_all_stemmed && rule.keywords_all_stemmed.length > 0) {
        const hasAll = rule.keywords_all_stemmed.every(phraseStems =>
            phraseStems.every(stem => message.tokens_stemmed.includes(stem))
        );
        if (!hasAll) return false;
    } else if (rule.keywords_all && rule.keywords_all.length > 0) {
        const hasAll = rule.keywords_all.every(kw => message.text_normalized.includes(kw.toLowerCase()));
        if (!hasAll) return false;
    }

    return true;
}

/**
 * Check if the message matches price filters
 */
function checkPrice(rule, message, appConfig, matchContext) {
    if (!rule.price) return true;

    const pricesToCheck = message.prices || (message.price_value !== null ? [{
        value: message.price_value,
        currency: message.price_currency
    }] : []);

    if (rule.price.require_detected && pricesToCheck.length === 0) {
        return false;
    }

    if (pricesToCheck.length > 0) {
        const ruleCurrency = rule.price.currency || appConfig.app.base_currency;

        const triggeredPrice = pricesToCheck.find(p => {
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

        if (!triggeredPrice) return false;

        matchContext.matchedPrice = triggeredPrice.value;
        matchContext.matchedCurrency = triggeredPrice.currency;
    }

    return true;
}

const checkers = [
    checkScope,
    checkExclude,
    checkKeywordsAny,
    checkKeywordsAll,
    checkPrice
];

/**
 * Main function to match a message against a set of rules
 * @param {object} message - Normalized message object
 * @param {array} rules - List of matching rules
 * @param {object} appConfig - Application configuration
 * @returns {array} - List of match results
 */
export function matchMessage(message, rules, appConfig) {
    const matches = [];

    for (const rule of rules) {
        if (!rule.enabled) continue;

        const matchContext = {
            matchedPrice: message.price_value,
            matchedCurrency: message.price_currency
        };

        const passed = checkers.every(check => check(rule, message, appConfig, matchContext));

        if (passed) {
            matches.push({
                ruleId: rule.id,
                messageId: message.id,
                matchedPrice: matchContext.matchedPrice,
                matchedCurrency: matchContext.matchedCurrency,
                score: 1.0
            });
        }
    }

    return matches;
}
