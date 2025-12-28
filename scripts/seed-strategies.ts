import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars from .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const strategies = [
    { name: 'Trend Master 3000', description: 'Follows strong trends on 15m timeframe' },
    { name: 'Mean Reversion X', description: 'Buys oversold RSI and sells overbought' },
    { name: 'ETH Whale Tracker', description: 'Tracks large wallet movements' },
];

async function seed() {
    console.log('Seeding AI strategies...');

    for (const strategy of strategies) {
        const { data, error } = await supabase
            .from('ai_strategies')
            .select('*')
            .eq('name', strategy.name)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found"
            console.error(`Error checking strategy ${strategy.name}:`, error.message);
            continue;
        }

        if (!data) {
            const { error: insertError } = await supabase
                .from('ai_strategies')
                .insert(strategy);

            if (insertError) {
                console.error(`Error inserting ${strategy.name}:`, insertError.message);
            } else {
                console.log(`Created strategy: ${strategy.name}`);
            }
        } else {
            console.log(`Strategy already exists: ${strategy.name}`);
        }
    }

    console.log('Seeding complete.');
}

seed();
