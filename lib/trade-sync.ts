import { TradeService } from './trade/trade-service';

/**
 * Trade Sync Logic
 * ================
 * Now delegated to TradeService (Component-based architecture)
 */
export async function syncTrades() {
    const service = new TradeService();
    await service.syncTrades();
}
