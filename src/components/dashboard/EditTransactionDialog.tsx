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
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { AlertCircle, Check, ChevronDown, Search, Trash2 } from 'lucide-react'
import {
  getTransactionWithSplits,
  updateTransaction,
  deleteTransaction,
  type TransactionWithSplits,
} from '@/lib/actions/transactions'
import { useQueryClient } from '@tanstack/react-query'

interface EditTransactionDialogProps {
  transactionId: string | null
  categories: { id: string; name: string }[]
  onClose: () => void
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('th-TH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Searchable Category Select Component
function CategorySelect({
  categories,
  value,
  onChange,
}: {
  categories: { id: string; name: string }[]
  value: string | null
  onChange: (value: string | null) => void
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
          {selectedCategory?.name || 'ไม่ระบุหมวดหมู่'}
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
          {/* No category option */}
          <button
            className={`w-full text-left px-3 py-2 text-sm rounded hover:bg-muted flex items-center justify-between ${
              !value ? 'bg-muted' : ''
            }`}
            onClick={() => {
              onChange(null)
              setOpen(false)
              setSearch('')
            }}
          >
            <span className="text-muted-foreground">ไม่ระบุหมวดหมู่</span>
            {!value && <Check className="h-4 w-4" />}
          </button>

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

export default function EditTransactionDialog({
  transactionId,
  categories,
  onClose,
}: EditTransactionDialogProps) {
  const [transaction, setTransaction] = useState<TransactionWithSplits | null>(null)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const queryClient = useQueryClient()

  // Load transaction data
  useEffect(() => {
    if (!transactionId) {
      setTransaction(null)
      setCategoryId(null)
      setNote('')
      return
    }

    setIsLoading(true)
    getTransactionWithSplits(transactionId).then((data) => {
      setTransaction(data)
      if (data) {
        setCategoryId(data.categoryId)
        setNote(data.note || '')
      }
      setIsLoading(false)
    })
  }, [transactionId])

  const handleSave = () => {
    setError(null)

    startTransition(async () => {
      const result = await updateTransaction(transactionId!, {
        categoryId,
        note: note || null,
      })

      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['transactions'] })
        onClose()
      } else {
        setError(result.error || 'เกิดข้อผิดพลาด')
      }
    })
  }

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteTransaction(transactionId!)

      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['transactions'] })
        onClose()
      } else {
        setError(result.error || 'เกิดข้อผิดพลาด')
      }
    })
  }

  const isWithdrawal = transaction?.withdrawal !== null

  return (
    <Dialog open={!!transactionId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>แก้ไขรายการ</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">กำลังโหลด...</div>
        ) : transaction ? (
          <div className="space-y-4">
            {/* Transaction Info (Read-only) */}
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">วันที่</span>
                <span className="text-sm">{formatDate(transaction.date)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">ประเภท</span>
                <Badge variant={isWithdrawal ? 'destructive' : 'default'}>
                  {isWithdrawal ? 'รายจ่าย' : 'รายรับ'}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">จำนวนเงิน</span>
                <span className={`text-lg font-bold ${isWithdrawal ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(transaction.withdrawal || transaction.deposit || 0)} บาท
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">ยอดคงเหลือ</span>
                <span className="text-sm">{formatCurrency(transaction.balance)} บาท</span>
              </div>

              <div className="pt-2 border-t">
                <span className="text-sm text-muted-foreground">Description</span>
                <p className="text-sm mt-1">{transaction.rawDescription || '-'}</p>
              </div>
            </div>

            {/* Split Warning */}
            {transaction.isSplit && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-700 text-sm">
                รายการนี้ถูกแบ่งเป็น {transaction.splits.length} หมวดหมู่
                กรุณาใช้ปุ่ม "แบ่งรายการ" เพื่อแก้ไข
              </div>
            )}

            {/* Editable Fields */}
            {!transaction.isSplit && (
              <>
                <div className="space-y-2">
                  <Label>หมวดหมู่</Label>
                  <CategorySelect
                    categories={categories}
                    value={categoryId}
                    onChange={setCategoryId}
                  />
                </div>

                <div className="space-y-2">
                  <Label>หมายเหตุ</Label>
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="เพิ่มหมายเหตุ..."
                    rows={3}
                  />
                </div>
              </>
            )}

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
          {transaction && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" className="sm:mr-auto">
                  <Trash2 className="h-4 w-4 mr-1" />
                  ลบรายการ
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>ยืนยันการลบ</AlertDialogTitle>
                  <AlertDialogDescription>
                    ต้องการลบรายการนี้หรือไม่? การดำเนินการนี้ไม่สามารถย้อนกลับได้
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>
                    ลบรายการ
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              ยกเลิก
            </Button>
            {transaction && !transaction.isSplit && (
              <Button onClick={handleSave} disabled={isPending}>
                {isPending ? 'กำลังบันทึก...' : 'บันทึก'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
