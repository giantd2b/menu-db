import { importLearnedRules } from '@/lib/actions/import-learned-rules'
import { NextResponse } from 'next/server'

export async function POST() {
  const result = await importLearnedRules()
  return NextResponse.json(result)
}
