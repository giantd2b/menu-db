'use client'

import { useState, useEffect, useTransition, useMemo } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Plus, X, AlertCircle, Check, ChevronDown, Search } from 'lucide-react'
import {
  splitTransaction,
  unsplitTransaction,
  getTransactionWithSplits,
  type TransactionWithSplits,
} from '@/lib/actions/transactions'
import { useQueryClient } from '@tanstack/react-query'

interface SplitTransactionDialogProps {
  transactionId: string | null
  categories: { id: string; name: string }[]
  onClose: () => void
}

interface SplitRow {
  id: string
  categoryId: string
  amount: string
  note: string
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

// Searchable Category Select Component
function CategorySelect({
  categories,
  value,
  onChange,
}: {
  categories: { id: string; name: string }[]
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filteredCategories = useMemo(() => {
    if (!search) return categories
    const searchLower = search.toLowerCase()
    return categories.filter((cat) =>
      cat.name.toLowerCase().includes(searchLower)
    )
  }, [categories, search])

  const selectedCategory = categories.find((c) => c.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selectedCategory?.name || 'เลือกหมวดหมู่'}
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <div className="p-2 border-b">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="พิมพ์ค้นหา..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-[250px] overflow-y-auto p-1">
          {filteredCategories.length === 0 ? (
            <div className="py-4 text-center text-sm text-muted-foreground">
              ไม่พบหมวดหมู่
            </div>
          ) : (
            filteredCategories.map((cat) => (
              <button
                key={cat.id}
                className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-muted flex items-center justify-between ${
                  value === cat.id ? 'bg-muted' : ''
                }`}
                onClick={() => {
                  onChange(cat.id)
                  setOpen(false)
                  setSearch('')
                }}
              >
                {cat.name}
                {value === cat.id && <Check className="h-4 w-4" />}
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export default function SplitTransactionDialog({
  transactionId,
  categories,
  onClose,
}: SplitTransactionDialogProps) {
  const [transaction, setTransaction] = useState<TransactionWithSplits | null>(null)
  const [splits, setSplits] = useState<SplitRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const queryClient = useQueryClient()

  const originalAmount = transaction?.withdrawal ?? transaction?.deposit ?? 0
  const splitTotal = splits.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0)
  const remaining = originalAmount - splitTotal
  const isBalanced = Math.abs(remaining) < 0.01

  // Load transaction data
  useEffect(() => {
    if (!transactionId) {
      setTransaction(null)
      setSplits([])
      return
    }

    setIsLoading(true)
    getTransactionWithSplits(transactionId).then((data) => {
      setTransaction(data)
      if (data) {
        if (data.isSplit && data.splits.length > 0) {
          setSplits(
            data.splits.map((s) => ({
              id: s.id,
              categoryId: s.categoryId,
              amount: s.amount.toString(),
              note: s.note || '',
            }))
          )
        } else {
          // Start with one empty split
          setSplits([
            { id: crypto.randomUUID(), categoryId: '', amount: '', note: '' },
          ])
        }
      }
      setIsLoading(false)
    })
  }, [transactionId])

  const addSplit = () => {
    setSplits([
      ...splits,
      { id: crypto.randomUUID(), categoryId: '', amount: '', note: '' },
    ])
  }

  const removeSplit = (id: string) => {
    if (splits.length <= 1) return
    setSplits(splits.filter((s) => s.id !== id))
  }

  const updateSplit = (id: string, field: keyof SplitRow, value: string) => {
    setSplits(
      splits.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    )
  }

  const handleSave = () => {
    setError(null)

    const validSplits = splits.filter((s) => s.categoryId && parseFloat(s.amount) > 0)
    if (validSplits.length < 2) {
      setError('ต้องแบ่งอย่างน้อย 2 รายการ')
      return
    }

    if (!isBalanced) {
      setError(`ยอดรวมไม่ตรง เหลืออีก ${formatCurrency(Math.abs(remaining))} บาท`)
      return
    }

    startTransition(async () => {
      const result = await splitTransaction(
        transactionId!,
        validSplits.map((s) => ({
          categoryId: s.categoryId,
          amount: parseFloat(s.amount),
          note: s.note || undefined,
        }))
      )

      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['transactions'] })
        onClose()
      } else {
        setError(result.error || 'เกิดข้อผิดพลาด')
      }
    })
  }

  const handleUnsplit = () => {
    startTransition(async () => {
      const result = await unsplitTransaction(transactionId!)

      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['transactions'] })
        onClose()
      } else {
        setError(result.error || 'เกิดข้อผิดพลาด')
      }
    })
  }

  const useRemaining = (id: string) => {
    if (remaining > 0) {
      updateSplit(id, 'amount', remaining.toFixed(2))
    }
  }

  return (
    <Dialog open={!!transactionId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>แบ่งรายการ</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">กำลังโหลด...</div>
        ) : transaction ? (
          <div className="space-y-4">
            {/* Original Transaction */}
            <div className="p-4 bg-muted rounded-lg text-center">
              <div className="text-sm text-muted-foreground mb-1">
                {transaction.note || transaction.rawDescription}
              </div>
              <div className="text-3xl font-bold">
                {formatCurrency(originalAmount)}
                <span className="text-lg font-normal text-muted-foreground ml-1">บาท</span>
              </div>
              <Badge variant={transaction.withdrawal ? 'destructive' : 'default'} className="mt-2">
                {transaction.withdrawal ? 'รายจ่าย' : 'รายรับ'}
              </Badge>
            </div>

            {/* Remaining */}
            <div className={`p-3 rounded-lg text-center ${isBalanced ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
              {isBalanced ? (
                <div className="flex items-center justify-center gap-2 text-green-700">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">แบ่งครบแล้ว</span>
                </div>
              ) : (
                <div>
                  <div className="text-sm text-amber-700">ยังเหลือที่ต้องแบ่ง</div>
                  <div className="text-2xl font-bold text-amber-700">
                    {formatCurrency(remaining)} บาท
                  </div>
                </div>
              )}
            </div>

            {/* Split Items */}
            <div className="space-y-3">
              <div className="text-sm font-medium">แบ่งเป็น:</div>

              {splits.map((split, index) => (
                <div key={split.id} className="p-3 border rounded-lg space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">รายการที่ {index + 1}</span>
                    {splits.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => removeSplit(split.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {/* Amount Input */}
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="จำนวนเงิน"
                        value={split.amount}
                        onChange={(e) => updateSplit(split.id, 'amount', e.target.value)}
                        className="text-lg font-medium"
                      />
                    </div>
                    {remaining > 0.01 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => useRemaining(split.id)}
                        className="whitespace-nowrap"
                      >
                        ใส่ {formatCurrency(remaining)}
                      </Button>
                    )}
                  </div>

                  {/* Category Select with Search */}
                  <CategorySelect
                    categories={categories}
                    value={split.categoryId}
                    onChange={(v) => updateSplit(split.id, 'categoryId', v)}
                  />
                </div>
              ))}

              {/* Add Button */}
              <Button
                variant="outline"
                className="w-full"
                onClick={addSplit}
              >
                <Plus className="h-4 w-4 mr-2" />
                เพิ่มรายการ
              </Button>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm p-3 bg-red-50 rounded-lg">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center text-muted-foreground">ไม่พบรายการ</div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {transaction?.isSplit && (
            <Button variant="outline" onClick={handleUnsplit} disabled={isPending} className="w-full sm:w-auto">
              ยกเลิกการแบ่ง
            </Button>
          )}
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="ghost" onClick={onClose} className="flex-1 sm:flex-none">
              ยกเลิก
            </Button>
            <Button
              onClick={handleSave}
              disabled={isPending || !isBalanced}
              className="flex-1 sm:flex-none"
            >
              {isPending ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
