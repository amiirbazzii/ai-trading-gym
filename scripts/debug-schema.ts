import { createAdminClient } from '../utils/supabase/admin';

async function debugSchema() {
    const supabase = createAdminClient();
    if (!supabase) {
        console.error('No admin client found. Check your SUPABASE_SERVICE_ROLE_KEY.');
        return;
    }

    console.log('Checking ai_strategies columns...');
    const { data, error } = await supabase.from('ai_strategies').select('*').limit(1);

    if (error) {
        console.error('Error fetching strategies:', error.message);
    } else {
        console.log('Successfully fetched sample strategy:', data);
        if (data && data.length > 0) {
            console.log('Columns available:', Object.keys(data[0]));
        } else {
            console.log('Table is empty, checking if user_id column exists...');
            const { error: colError } = await supabase.from('ai_strategies').select('user_id').limit(1);
            if (colError) {
                console.log('user_id column check failed:', colError.message);
            } else {
                console.log('user_id column exists.');
            }
        }
    }
}

debugSchema().catch(console.error);
