import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://dcbgikekmlbetqugjxfq.supabase.co';
const supabaseAnonKey = 'sb_publishable_vx61APyd9qtmqVxVtl517g_AAoGj_6Z';

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);