'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Sparkles, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

interface AIResult {
  processed: number
  categorized: number
  results: { id: string; category: string; confidence: string }[]
}

export default function AICategorizeButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [limit, setLimit] = useState(20)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AIResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleCategorize = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/ai-categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'AI categorization failed')
      }

      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setOpen(false)
    if (result && result.categorized > 0) {
      // Refresh to show updated categories
      router.refresh()
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Sparkles className="h-4 w-4" />
          AI จัดหมวดหมู่
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            AI จัดหมวดหมู่อัตโนมัติ
          </DialogTitle>
          <DialogDescription>
            ใช้ AI วิเคราะห์รายการที่ยังไม่มีหมวดหมู่ หรือหมวดหมู่ "ไม่ระบุ"
          </DialogDescription>
        </DialogHeader>

        {!result && !loading && (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="limit">จำนวนรายการที่ต้องการวิเคราะห์</Label>
              <Input
                id="limit"
                type="number"
                min={1}
                max={100}
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value) || 20)}
              />
              <p className="text-xs text-muted-foreground">
                แนะนำ 10-50 รายการต่อครั้ง (ใช้เวลาประมาณ 1 วินาทีต่อรายการ)
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            <p className="text-sm text-muted-foreground">
              กำลังวิเคราะห์... อาจใช้เวลาสักครู่
            </p>
          </div>
        )}

        {result && (
          <div className="py-4">
            <div className="flex items-center gap-2 text-green-600 mb-4">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">เสร็จสิ้น!</span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-muted rounded-lg p-3 text-center">
                <div className="text-2xl font-bold">{result.processed}</div>
                <div className="text-xs text-muted-foreground">รายการที่วิเคราะห์</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-bold text-green-600">{result.categorized}</div>
                <div className="text-xs text-muted-foreground">จัดหมวดหมู่สำเร็จ</div>
              </div>
            </div>

            {result.results.length > 0 && (
              <div className="max-h-48 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-1">หมวดหมู่</th>
                      <th className="text-right py-1">ความมั่นใจ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.results.slice(0, 10).map((r, i) => (
                      <tr key={i} className="border-b border-dashed">
                        <td className="py-1 truncate max-w-[200px]">{r.category}</td>
                        <td className="py-1 text-right">
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            r.confidence === 'high' ? 'bg-green-100 text-green-700' :
                            r.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {r.confidence}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.results.length > 10 && (
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    และอีก {result.results.length - 10} รายการ...
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="outline" onClick={() => setOpen(false)}>
                ยกเลิก
              </Button>
              <Button onClick={handleCategorize} disabled={loading} className="gap-2">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    กำลังวิเคราะห์...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    เริ่มวิเคราะห์
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose}>
              ปิด
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
