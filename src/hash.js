import crypto from 'crypto';

export function getContentHash(textNormalized, priceValue, priceCurrency) {
    const data = `${textNormalized}|${priceValue || ''}|${priceCurrency || ''}`;
    return crypto.createHash('sha256').update(data).digest('hex');
}
