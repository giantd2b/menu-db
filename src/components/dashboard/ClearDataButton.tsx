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
import { Trash2, AlertTriangle } from 'lucide-react'
import { clearAllTransactions, clearAllData } from '@/lib/actions/clear-data'

export default function ClearDataButton() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  const handleClearTransactions = async () => {
    setIsLoading(true)
    const res = await clearAllTransactions()
    if (res.success) {
      setResult(`ลบ ${res.deleted} transactions สำเร็จ`)
      setTimeout(() => {
        setIsOpen(false)
        setResult(null)
        router.refresh()
      }, 1500)
    } else {
      setResult(`Error: ${res.error}`)
    }
    setIsLoading(false)
  }

  const handleClearAll = async () => {
    setIsLoading(true)
    const res = await clearAllData()
    if (res.success) {
      setResult(`ลบสำเร็จ: ${res.transactions} transactions, ${res.rules} rules, ${res.categories} categories`)
      setTimeout(() => {
        setIsOpen(false)
        setResult(null)
        router.refresh()
      }, 1500)
    } else {
      setResult(`Error: ${res.error}`)
    }
    setIsLoading(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 className="h-4 w-4 mr-2" />
          ล้างข้อมูล
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            ล้างข้อมูล
          </DialogTitle>
          <DialogDescription>
            เลือกประเภทข้อมูลที่ต้องการลบ การดำเนินการนี้ไม่สามารถย้อนกลับได้
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="py-4 text-center text-sm">
            {result}
          </div>
        ) : (
          <div className="space-y-3 py-4">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={handleClearTransactions}
              disabled={isLoading}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              ล้างเฉพาะ Transactions
              <span className="ml-auto text-xs text-muted-foreground">
                (เก็บ Categories & Rules)
              </span>
            </Button>

            <Button
              variant="destructive"
              className="w-full justify-start"
              onClick={handleClearAll}
              disabled={isLoading}
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              ล้างข้อมูลทั้งหมด
              <span className="ml-auto text-xs">
                (Transactions + Rules + Categories)
              </span>
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => setIsOpen(false)} disabled={isLoading}>
            ยกเลิก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
