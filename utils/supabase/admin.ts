import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
    const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const sbServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!sbUrl || !sbServiceKey) {
        return null;
    }

    return createClient(sbUrl, sbServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    });
}
