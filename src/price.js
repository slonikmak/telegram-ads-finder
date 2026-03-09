export function extractPrice(text, fxConfig) {
    if (!text) return { raw: null, value: null, currency: null, value_eur: null, fx_rate_used: null };

    const eurMarkers = ['€', 'eur', 'euro', 'evra', 'evro', 'евро'];
    const rsdMarkers = ['rsd', 'din', 'dinar', 'dinara', 'дин', 'динар', 'динара', 'рсд'];

    // regex to find number near currency marker
    // supports 1000, 1000.00, 1000,00, 1 000, 1.000
    const numberPattern = '(?:\\d{1,3}(?:[\\s\\.]\\d{3})*(?:,\\d{2})?|\\d+(?:[\\.\\,]\\d{2})?)';

    const allMarkers = [...eurMarkers, ...rsdMarkers];
    const combinedMarkers = allMarkers.map(m => m.replace(/[€$]/g, '\\$&')).join('|');

    // Regex for marker before or after number
    // Captures: marker then space? then number OR number then space? then marker
    const regex = new RegExp(`(?:(${combinedMarkers})\\s*(${numberPattern}))| (?:(${numberPattern})\\s*(${combinedMarkers}))`, 'gi');

    let match;
    while ((match = regex.exec(text)) !== null) {
        let rawMarker = match[1] || match[4];
        let rawValue = match[2] || match[3];

        if (!rawMarker || !rawValue) continue;

        let currency = eurMarkers.includes(rawMarker.toLowerCase()) ? 'EUR' : 'RSD';

        // Normalize number: 105.000 -> 105000, 105 000 -> 105000, 105,00 -> 105.00
        let cleanValue = rawValue.replace(/[\s\.]/g, '').replace(',', '.');
        let value = parseFloat(cleanValue);

        if (isNaN(value)) continue;

        let value_eur = null;
        let fx_rate_used = 1;

        if (currency === 'EUR') {
            value_eur = value;
        } else if (currency === 'RSD') {
            fx_rate_used = fxConfig.exchange_rates.RSD;
            value_eur = value / fx_rate_used;
        }

        return {
            raw: `${rawValue} ${rawMarker}`,
            value,
            currency,
            value_eur: parseFloat(value_eur.toFixed(2)),
            fx_rate_used
        };
    }

    return { raw: null, value: null, currency: null, value_eur: null, fx_rate_used: null };
}

export function convertPrice(value, from, to, rates) {
    if (from === to) return value;
    if (from === 'RSD' && to === 'EUR') return value / rates.RSD;
    if (from === 'EUR' && to === 'RSD') return value * rates.RSD;
    return value;
}
