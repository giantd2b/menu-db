import { importFinalRules } from '@/lib/actions/import-final-rules'
import { NextResponse } from 'next/server'

export async function POST() {
  const result = await importFinalRules()
  return NextResponse.json(result)
}
