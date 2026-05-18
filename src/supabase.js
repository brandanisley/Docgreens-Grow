import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://cweypmxtuhx.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_sBdeyJx4FyA7NHNECaydiA_RX1Qclfx'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
