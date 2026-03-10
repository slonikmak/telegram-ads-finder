import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import pino from 'pino';
import { tokenizeAndStem } from './nlp.js';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export function loadYaml(filePath) {
    if (!fs.existsSync(filePath)) {
        throw new Error(`Config file not found: ${filePath}`);
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return yaml.parse(content);
}

export function loadAppConfig(configDir) {
    return loadYaml(path.join(configDir, 'app.yaml'));
}

export function loadChannelsConfig(configDir) {
    const data = loadYaml(path.join(configDir, 'channels.yaml'));
    return data.channels || [];
}

export function loadRulesConfig(configDir) {
    const data = loadYaml(path.join(configDir, 'rules.yaml'));
    const rules = data.rules || [];

    for (const rule of rules) {
        if (rule.keywords_any) {
            rule.keywords_any_stemmed = rule.keywords_any.map(kw => tokenizeAndStem(kw));
        }
        if (rule.keywords_all) {
            rule.keywords_all_stemmed = rule.keywords_all.map(kw => tokenizeAndStem(kw));
        }
        if (rule.exclude) {
            rule.exclude_stemmed = rule.exclude.map(kw => tokenizeAndStem(kw));
        }
    }

    return rules;
}

export function validateConfigs(app, channels, rules) {
    // Simple validation based on specs
    if (!app.app || app.app.base_currency !== 'EUR') {
        throw new Error('Invalid app.yaml: base_currency must be EUR');
    }

    if (!Array.isArray(channels)) {
        throw new Error('Invalid channels.yaml: channels must be an array');
    }

    const channelIds = new Set();
    for (const ch of channels) {
        if (!ch.id) throw new Error('Channel missing id');
        if (ch.topics && !Array.isArray(ch.topics)) throw new Error(`Invalid topics for channel ${ch.id}: must be an array`);
        if (channelIds.has(ch.id)) throw new Error(`Duplicate channel id: ${ch.id}`);
        channelIds.add(ch.id);
    }

    if (!Array.isArray(rules)) {
        throw new Error('Invalid rules.yaml: rules must be an array');
    }

    const ruleIds = new Set();
    for (const rule of rules) {
        if (!rule.id || !rule.name) throw new Error('Rule missing id or name');
        if (ruleIds.has(rule.id)) throw new Error(`Duplicate rule id: ${rule.id}`);
        ruleIds.add(rule.id);

        if (rule.price) {
            if (rule.price.currency && !['EUR', 'RSD'].includes(rule.price.currency)) {
                throw new Error(`Unsupported currency in rule ${rule.id}: ${rule.price.currency}`);
            }
            if (rule.price.min !== null && rule.price.max !== null && rule.price.min > rule.price.max) {
                throw new Error(`Invalid price range in rule ${rule.id}: min > max`);
            }
        }
    }

    return true;
}
