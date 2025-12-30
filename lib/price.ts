const BINANCE_API = 'https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT';
const COINGECKO_API = 'https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd';

/**
 * Fetch current ETH price with fallback providers
 * Primary: Binance, Fallback: CoinGecko
 */
export async function getEthPrice(): Promise<number> {
    // Try Binance first
    try {
        const response = await fetch(BINANCE_API, {
            cache: 'no-store',
            signal: AbortSignal.timeout(5000)
        });
        if (response.ok) {
            const data = await response.json();
            return parseFloat(data.price);
        }
    } catch (error) {
        console.warn('[Price] Binance API failed, trying fallback...');
    }

    // Fallback to CoinGecko
    try {
        const response = await fetch(COINGECKO_API, {
            cache: 'no-store',
            signal: AbortSignal.timeout(5000)
        });
        if (response.ok) {
            const data = await response.json();
            return data.ethereum.usd;
        }
    } catch (error) {
        console.error('[Price] All price providers failed:', error);
    }

    throw new Error('All price providers failed');
}
