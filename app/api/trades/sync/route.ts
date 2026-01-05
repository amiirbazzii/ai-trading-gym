import { NextResponse } from 'next/server';
import { syncTrades } from '@/lib/trade-sync';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        console.log('[API] Starting trade sync...');
        await syncTrades();
        return NextResponse.json({ success: true, message: 'Trades synchronized' });
    } catch (error: any) {
        console.error('[API] Trade sync failed:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
