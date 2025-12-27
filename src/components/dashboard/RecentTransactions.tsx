'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X, Split } from 'lucide-react'
import { usePaginatedTransactions } from '@/hooks/useDashboardData'
import { type PaginatedTransactions, bulkUpdateTransactionCategory } from '@/lib/actions/dashboard'
import { useQueryClient } from '@tanstack/react-query'
import SplitTransactionDialog from './SplitTransactionDialog'

interface DateRange {
  from?: Date
  to?: Date
}

interface RecentTransactionsProps {
  initialData: PaginatedTransactions
  categories: { id: string; name: string }[]
  dateRange?: DateRange
  accountNumber?: string
  showAccountColumn?: boolean
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatAccountType(type: string | null): string {
  if (!type) return '-'
  const typeMap: Record<string, string> = {
    'Savings': 'ออมทรัพย์',
    'Current': 'กระแสรายวัน',
    'Fixed': 'ฝากประจำ',
  }
  return typeMap[type] || type
}

type TransactionType = 'all' | 'withdrawal' | 'deposit'

export default function RecentTransactions({
  initialData,
  categories,
  dateRange,
  accountNumber,
  showAccountColumn = false,
}: RecentTransactionsProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [transactionType, setTransactionType] = useState<TransactionType>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkCategory, setBulkCategory] = useState<string>('')
  const [splitTransactionId, setSplitTransactionId] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const queryClient = useQueryClient()

  // Use React Query hook with pagination
  const {
    transactions,
    total,
    page,
    totalPages,
    isLoading,
    goToPage,
    nextPage,
    prevPage,
    hasNextPage,
    hasPrevPage,
  } = usePaginatedTransactions({
    initialData,
    categoryFilter: selectedCategory,
    transactionType,
    dateRange,
    accountNumber,
    pageSize: 20,
    debounceMs: 300,
  })

  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(id)) {
        newSet.delete(id)
      } else {
        newSet.add(id)
      }
      return newSet
    })
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(transactions.map((tx) => tx.id)))
    }
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
    setBulkCategory('')
  }

  const handleBulkUpdate = () => {
    if (selectedIds.size === 0) return

    const categoryId = bulkCategory === 'none' ? null : bulkCategory

    startTransition(async () => {
      const result = await bulkUpdateTransactionCategory(
        Array.from(selectedIds),
        categoryId
      )

      if (result.success) {
        clearSelection()
        // Invalidate queries to refresh data
        queryClient.invalidateQueries({ queryKey: ['transactions'] })
      }
    })
  }

  // Get categories that have transactions (from initialData to show all possible categories)
  const categoriesWithTransactions = categories.filter((cat) =>
    initialData.data.some((tx) => tx.category === cat.name)
  )

  const isAllSelected = transactions.length > 0 && selectedIds.size === transactions.length
  const isSomeSelected = selectedIds.size > 0

  return (
    <Card className="col-span-7">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>รายการล่าสุด</CardTitle>
        <div className="flex items-center gap-2">
          {/* Transaction Type Filter */}
          <Select value={transactionType} onValueChange={(v) => setTransactionType(v as TransactionType)}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทั้งหมด</SelectItem>
              <SelectItem value="withdrawal">รายจ่าย</SelectItem>
              <SelectItem value="deposit">รายรับ</SelectItem>
            </SelectContent>
          </Select>

          {/* Category Filter - แสดงเฉพาะหมวดหมู่ที่มีรายการ */}
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="เลือกหมวดหมู่" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">ทุกหมวดหมู่</SelectItem>
              {categoriesWithTransactions.map((cat) => (
                <SelectItem key={cat.id} value={cat.name}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {/* Bulk Action Bar */}
        {isSomeSelected && (
          <div className="flex items-center gap-3 mb-4 p-3 bg-muted rounded-lg">
            <span className="text-sm font-medium">
              เลือก {selectedIds.size} รายการ
            </span>
            <Select value={bulkCategory} onValueChange={setBulkCategory}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="เลือกหมวดหมู่" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ไม่มีหมวดหมู่</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={handleBulkUpdate}
              disabled={!bulkCategory || isPending}
            >
              {isPending ? 'กำลังอัพเดท...' : 'อัพเดท'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={clearSelection}
            >
              <X className="h-4 w-4 mr-1" />
              ยกเลิก
            </Button>
          </div>
        )}

        <div className="relative overflow-x-auto">
          {isLoading && (
            <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40px]">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="เลือกทั้งหมด"
                  />
                </TableHead>
                <TableHead>วันที่</TableHead>
                <TableHead>ชื่อบัญชี</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-right">ถอน</TableHead>
                <TableHead className="text-right">ฝาก</TableHead>
                <TableHead className="text-right">คงเหลือ</TableHead>
                <TableHead>หมวดหมู่</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                    ไม่มีข้อมูล
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx) => (
                  <TableRow key={tx.id} className={selectedIds.has(tx.id) ? 'bg-muted/50' : ''}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(tx.id)}
                        onCheckedChange={() => toggleSelect(tx.id)}
                        aria-label={`เลือกรายการ ${tx.id}`}
                      />
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {formatDate(tx.date)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {tx.accountName || tx.accountNumber || '-'}
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatAccountType(tx.accountType)}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate" title={tx.rawDescription}>
                      {tx.rawDescription || '-'}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate text-muted-foreground" title={tx.note || ''}>
                      {tx.note || '-'}
                    </TableCell>
                    <TableCell className="text-right text-red-600 font-medium">
                      {tx.withdrawal ? formatCurrency(tx.withdrawal) : '-'}
                    </TableCell>
                    <TableCell className="text-right text-green-600 font-medium">
                      {tx.deposit ? formatCurrency(tx.deposit) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(tx.balance)}
                    </TableCell>
                    <TableCell>
                      {tx.category ? (
                        <Badge
                          variant="outline"
                          style={{
                            borderColor: tx.categoryColor || undefined,
                            color: tx.categoryColor || undefined,
                          }}
                        >
                          {tx.category}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setSplitTransactionId(tx.id)}
                        title="แบ่งรายการ"
                      >
                        <Split className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Total count and Pagination */}
        {total > 0 && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {totalPages > 1
                ? `แสดง ${((page - 1) * 20) + 1} - ${Math.min(page * 20, total)} จาก ${total} รายการ`
                : `ทั้งหมด ${total} รายการ`}
            </div>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(1)}
                  disabled={!hasPrevPage || isLoading}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={prevPage}
                  disabled={!hasPrevPage || isLoading}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                {/* Page numbers */}
                <div className="flex items-center gap-1 mx-2">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number
                    if (totalPages <= 5) {
                      pageNum = i + 1
                    } else if (page <= 3) {
                      pageNum = i + 1
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i
                    } else {
                      pageNum = page - 2 + i
                    }
                    return (
                      <Button
                        key={pageNum}
                        variant={page === pageNum ? 'default' : 'outline'}
                        size="sm"
                        className="w-8 h-8 p-0"
                        onClick={() => goToPage(pageNum)}
                        disabled={isLoading}
                      >
                        {pageNum}
                      </Button>
                    )
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={nextPage}
                  disabled={!hasNextPage || isLoading}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(totalPages)}
                  disabled={!hasNextPage || isLoading}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Split Transaction Dialog */}
        <SplitTransactionDialog
          transactionId={splitTransactionId}
          categories={categories}
          onClose={() => setSplitTransactionId(null)}
        />
      </CardContent>
    </Card>
  )
}
