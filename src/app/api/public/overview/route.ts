import { NextResponse } from 'next/server'
import { getPublicOverviewData } from '@/lib/public-overview'

export const dynamic = 'force-dynamic'

const noStore = { headers: { 'Cache-Control': 'no-store' } }

export async function GET() {
  try {
    const data = await getPublicOverviewData()
    return NextResponse.json(data, noStore)
  } catch (err) {
    console.error('[Public overview GET]', err)
    return NextResponse.json({ error: 'Failed to load overview' }, { status: 500, ...noStore })
  }
}
