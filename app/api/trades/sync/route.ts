import { NextResponse } from 'next/server';
import { syncTrades } from '@/lib/trade-sync';

export async function GET() {
    try {
        await syncTrades();
        return NextResponse.json({ success: true, message: 'Trades synchronized' });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
