const BINANCE_API = 'https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT';
const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd';
const CRYPTOCOMPARE_API = 'https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD';

// Module-level cache to prevent total failure when APIs are down
let lastKnownPrice: number | null = null;
let lastFetchTime: number = 0;
const CACHE_TTL = 60000; // 1 minute

/**
 * Fetch current ETH price with multiple fallback providers
 */
export async function getEthPrice(): Promise<number> {
    const now = Date.now();

    const fetchWithTimeout = async (url: string, options: any = {}) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 8000);
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
                cache: 'no-store',
            });
            clearTimeout(id);
            return response;
        } catch (e) {
            clearTimeout(id);
            throw e;
        }
    };

    const updateCache = (price: number) => {
        lastKnownPrice = price;
        lastFetchTime = Date.now();
        return price;
    };

    // Try Binance first (Primary)
    try {
        const response = await fetchWithTimeout(BINANCE_API);
        if (response.ok) {
            const data = await response.json();
            return updateCache(parseFloat(data.price));
        }
    } catch (error) {
        console.warn('[Price] Binance failed');
    }

    // Try CryptoCompare (Secondary)
    try {
        const response = await fetchWithTimeout(CRYPTOCOMPARE_API);
        if (response.ok) {
            const data = await response.json();
            return updateCache(data.USD);
        }
    } catch (error) {
        console.warn('[Price] CryptoCompare failed');
    }

    // Try CoinGecko (Tertiary)
    try {
        const response = await fetchWithTimeout(COINGECKO_API);
        if (response.ok) {
            const data = await response.json();
            return updateCache(data.ethereum.usd);
        }
    } catch (error) {
        console.warn('[Price] CoinGecko failed');
    }

    // If all failed, use cache if it's not too stale
    if (lastKnownPrice && (now - lastFetchTime) < CACHE_TTL) {
        console.warn(`[Price] All providers failed. Using cached price: $${lastKnownPrice}`);
        return lastKnownPrice;
    }

    throw new Error('All price providers failed and no valid cache available');
}
