export function extractPrices(text, fxConfig) {
    if (!text) return [];

    const eurMarkers = ['€', 'eur', 'euro', 'evra', 'evro', 'евро'];
    const rsdMarkers = ['rsd', 'din', 'dinar', 'dinara', 'дин', 'динар', 'динара', 'рсд'];

    // Updated number pattern for more flexibility:
    // 1. Matches digits with optional thousands separators (space, dot, comma) 
    // 2. Optional decimal (dot or comma) with 1, 2 or more digits
    // Supports 1 000, 1.000, 1000.5, 1,5 EUR, 1.500 EUR, etc.
    const numberPattern = '(?:\\d{1,3}(?:[\\s\\.,]\\d{3})*(?:[\\,\\.]\\d+)?|\\d+(?:[\\.,]\\d+)?)';

    const allMarkers = [...eurMarkers, ...rsdMarkers];
    const combinedMarkers = allMarkers.map(m => m.replace(/[€$]/g, '\\$&')).join('|');

    // Regex for marker before or after number. Using non-capturing groups for the alternation.
    // Group 1: marker before, Group 2: number
    // Group 3: number, Group 4: marker after
    const regex = new RegExp(`(?:(${combinedMarkers})\\s*(${numberPattern}))|(?:(${numberPattern})\\s*(${combinedMarkers}))`, 'gi');

    const matches = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
        const rawMarker = match[1] || match[4];
        const rawValue = match[2] || match[3];

        if (!rawMarker || !rawValue) continue;

        const currency = eurMarkers.includes(rawMarker.toLowerCase()) ? 'EUR' : 'RSD';
        const value = parseFuzzyPrice(rawValue);

        if (value === null || isNaN(value)) continue;

        let value_eur = null;
        let fx_rate_used = 1;

        if (currency === 'EUR') {
            value_eur = value;
        } else if (currency === 'RSD') {
            fx_rate_used = fxConfig.exchange_rates.RSD;
            value_eur = value / fx_rate_used;
        }

        matches.push({
            raw: `${rawValue} ${rawMarker}`,
            value,
            currency,
            value_eur: parseFloat((value_eur || 0).toFixed(2)),
            fx_rate_used
        });
    }

    return matches;
}

export function extractPrice(text, fxConfig) {
    const prices = extractPrices(text, fxConfig);
    if (prices.length > 0) return prices[0];
    return { raw: null, value: null, currency: null, value_eur: null, fx_rate_used: null };
}

export function convertPrice(value, from, to, rates) {
    if (from === to) return value;
    if (from === 'RSD' && to === 'EUR') return value / rates.RSD;
    if (from === 'EUR' && to === 'RSD') return value * rates.RSD;
    return value;
}

function parseFuzzyPrice(val) {
    // 1. Remove obvious thousand separators (spaces)
    let s = val.replace(/\s/g, '');

    // Check points and commas
    const dots = (s.match(/\./g) || []).length;
    const commas = (s.match(/,/g) || []).length;

    // Case 1: Multiple dots or multiple commas -> they are thousands.
    if (dots > 1) s = s.replace(/\./g, '');
    if (commas > 1) s = s.replace(/,/g, '');

    // Re-count after multiple removal
    const dotsNew = (s.match(/\./g) || []).length;
    const commasNew = (s.match(/,/g) || []).length;

    // Case 2: One dot AND one comma -> distinguish thousand/decimal
    if (dotsNew === 1 && commasNew === 1) {
        if (s.lastIndexOf('.') > s.lastIndexOf(',')) {
            // 1,000.50
            return parseFloat(s.replace(/,/g, ''));
        } else {
            // 1.000,50
            return parseFloat(s.replace(/\./g, '').replace(',', '.'));
        }
    }

    // Case 3: Only one type of delimiter left
    if (dotsNew === 1 && commasNew === 0) {
        const parts = s.split('.');
        // Common heuristic: if length is 3, it's thousands separator in prices
        // UNLESS it's the only dot and we expect it to be decimal (REQ-001: 1.5 = 1.5)
        if (parts[1].length === 3) {
            // In Serbian ads "1.000" or "2.500" almost always means digits.
            // But "1.5" or "1.50" means decimals.
            return parseFloat(s.replace('.', ''));
        }
        return parseFloat(s);
    }

    if (commasNew === 1 && dotsNew === 0) {
        const parts = s.split(',');
        if (parts[1].length === 3) {
            return parseFloat(s.replace(',', ''));
        }
        return parseFloat(s.replace(',', '.'));
    }

    return parseFloat(s);
}
