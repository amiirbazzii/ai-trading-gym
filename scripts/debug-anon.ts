import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function debug() {
    const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    console.log('Testing select id, name, balance, user_id from ai_strategies...');
    const { data, error } = await supabase.from('ai_strategies').select('id, name, balance, user_id').limit(1);

    if (error) {
        console.log('FAILED (likely user_id missing):', error.message);

        console.log('Testing select id, name, balance (original columns)...');
        const { data: d2, error: e2 } = await supabase.from('ai_strategies').select('id, name, balance').limit(1);
        if (e2) {
            console.log('FAILED even with original columns:', e2.message);
        } else {
            console.log('SUCCESS with original columns. This confirms user_id column is missing.');
        }
    } else {
        console.log('SUCCESS! Columns exist.');
    }
}

debug();
