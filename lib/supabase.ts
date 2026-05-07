import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Wine = {
  id: string
  name: string
  vintage: number | null
  winery: string | null
  varietal: string | null
  region: string | null
  country: string | null
  barcode: string | null
  location: string
  quantity: number
  purchase_price: number | null
  purchase_date: string | null
  notes: string | null
  image_url: string | null
  rating: number | null
  vivino_url: string | null
  vivino_rating: number | null
  vivino_price: number | null
  created_at: string
  updated_at: string
}

export type Location = {
  id: string
  name: string
  created_at: string
}
