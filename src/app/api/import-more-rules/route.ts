import { importMoreRules } from '@/lib/actions/import-more-rules'
import { NextResponse } from 'next/server'

export async function POST() {
  const result = await importMoreRules()
  return NextResponse.json(result)
}
