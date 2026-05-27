import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  await supabase.auth.signOut()

  const requestUrl = new URL(request.url)
  return NextResponse.redirect(`${requestUrl.origin}/login`, { status: 303 })
}
