'use client'

import { useState } from 'react'
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
import { useTransactions } from '@/hooks/useDashboardData'
import { type TransactionData } from '@/lib/actions/dashboard'

interface DateRange {
  from?: Date
  to?: Date
}

interface RecentTransactionsProps {
  initialData: TransactionData[]
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

  // Use React Query hook - shares cache with parent's transactions query
  const { transactions: allTransactions, isLoading } = useTransactions({
    initialData,
    categoryFilter: selectedCategory,
    dateRange,
    accountNumber,
    debounceMs: 300,
  })

  // Filter by transaction type
  const transactions = allTransactions.filter((tx) => {
    if (transactionType === 'all') return true
    if (transactionType === 'withdrawal') return tx.withdrawal && tx.withdrawal > 0
    if (transactionType === 'deposit') return tx.deposit && tx.deposit > 0
    return true
  })

  // Get categories that have transactions (from initialData to show all possible categories)
  const categoriesWithTransactions = categories.filter((cat) =>
    initialData.some((tx) => tx.category === cat.name)
  )

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
        <div className="relative overflow-x-auto">
          {isLoading && (
            <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>วันที่</TableHead>
                <TableHead>ชื่อบัญชี</TableHead>
                <TableHead>ประเภท</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Note</TableHead>
                <TableHead className="text-right">ถอน</TableHead>
                <TableHead className="text-right">ฝาก</TableHead>
                <TableHead className="text-right">คงเหลือ</TableHead>
                <TableHead>หมวดหมู่</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                    ไม่มีข้อมูล
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx) => (
                  <TableRow key={tx.id}>
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
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
