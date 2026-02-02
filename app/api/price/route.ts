import { NextResponse } from 'next/server';
import { getEthPrice } from '@/lib/price';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const price = await getEthPrice();
        return NextResponse.json({ price });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
