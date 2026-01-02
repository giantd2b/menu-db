'use client'

import { useState, useTransition, useMemo } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { ArrowLeft, TrendingUp, TrendingDown, Wallet, RefreshCw, X, Loader2 } from 'lucide-react'
import {
  type PnLSummary,
  type AvailablePeriods,
  type PeriodOption,
  type PeriodType,
  type PnLCategoryData,
  type CategoryTransactionData,
  getPnLSummary,
  getTransactionsByCategory,
} from '@/lib/actions/profit-loss'
import { type AccountInfo } from '@/lib/actions/dashboard'
import DateRangePicker, { type DateRange } from '@/components/dashboard/DateRangePicker'

// Thai month names for client-side use
const THAI_MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน',
  'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม',
  'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
]

function getThaiMonthName(month: number): string {
  return THAI_MONTHS[month - 1] || ''
}

interface ProfitLossClientProps {
  initialSummary: PnLSummary
  availablePeriods: AvailablePeriods
  categories: { id: string; name: string }[]
  accounts: AccountInfo[]
  defaultPeriod: PeriodOption
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatFullCurrency(value: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function toBuddhistYear(year: number): number {
  return year + 543
}

const COLORS = [
  '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1',
]

interface CategoryBreakdownProps {
  title: string
  data: PnLCategoryData[]
  total: number
  colorScheme: 'green' | 'red'
  onCategoryClick?: (category: PnLCategoryData) => void
  selectedCategoryId?: string | null
}

function CategoryBreakdown({ title, data, total, colorScheme, onCategoryClick, selectedCategoryId }: CategoryBreakdownProps) {
  const chartData = useMemo(() => {
    return data.slice(0, 8).map((item, i) => ({
      name: item.categoryName,
      value: item.amount,
      color: COLORS[i % COLORS.length],
      percent: item.percentage,
    }))
  }, [data])

  const baseColor = colorScheme === 'green' ? 'text-green-600' : 'text-red-600'

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            ไม่มีข้อมูล
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>{title}</span>
          <span className={`text-xl font-bold ${baseColor}`}>
            {formatFullCurrency(total)}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Pie Chart */}
          <div className="h-[180px] w-full lg:w-[180px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius="45%"
                  outerRadius="85%"
                  paddingAngle={1}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [formatFullCurrency(Number(value)), 'ยอดเงิน']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto max-h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>หมวดหมู่</TableHead>
                  <TableHead className="text-right">จำนวนเงิน</TableHead>
                  <TableHead className="text-right w-20">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item, index) => {
                  const isSelected = selectedCategoryId === item.categoryId ||
                    (selectedCategoryId === 'uncategorized' && item.categoryId === null)
                  return (
                    <TableRow
                      key={item.categoryName}
                      className={`cursor-pointer hover:bg-muted/50 ${isSelected ? 'bg-muted' : ''}`}
                      onClick={() => onCategoryClick?.(item)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-sm shrink-0"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="truncate max-w-[150px]">{item.categoryName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.amount)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {item.percentage.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function ProfitLossClient({
  initialSummary,
  availablePeriods,
  categories,
  accounts,
  defaultPeriod,
}: ProfitLossClientProps) {
  const [summary, setSummary] = useState(initialSummary)
  const [periodType, setPeriodType] = useState<PeriodType>(defaultPeriod.type)
  const [selectedYear, setSelectedYear] = useState(defaultPeriod.year)
  const [selectedMonth, setSelectedMonth] = useState(defaultPeriod.month || 1)
  const [selectedQuarter, setSelectedQuarter] = useState(defaultPeriod.quarter || 1)
  const [customRange, setCustomRange] = useState<DateRange>({ from: undefined, to: undefined })
  const [selectedAccount, setSelectedAccount] = useState<string>('all')
  const [excludeTransfers, setExcludeTransfers] = useState(true) // Default: exclude transfers
  const [isPending, startTransition] = useTransition()

  // Category transaction detail state
  const [selectedCategory, setSelectedCategory] = useState<{
    id: string | null
    name: string
    type: 'income' | 'expense'
    color: string
  } | null>(null)
  const [categoryTransactions, setCategoryTransactions] = useState<CategoryTransactionData[]>([])
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false)

  const availableMonths = availablePeriods.monthsByYear[selectedYear] || []
  const availableQuarters = availablePeriods.quartersByYear[selectedYear] || []

  const handleRefresh = () => {
    startTransition(async () => {
      const period: PeriodOption = {
        type: periodType,
        year: selectedYear,
        month: periodType === 'monthly' ? selectedMonth : undefined,
        quarter: periodType === 'quarterly' ? selectedQuarter : undefined,
        from: periodType === 'custom' && customRange?.from ? customRange.from.toISOString() : undefined,
        to: periodType === 'custom' && customRange?.to ? customRange.to.toISOString() : undefined,
      }
      const accountNumber = selectedAccount === 'all' ? undefined : selectedAccount
      const newSummary = await getPnLSummary(period, accountNumber, excludeTransfers)
      setSummary(newSummary)
    })
  }

  const handleExcludeTransfersChange = (checked: boolean) => {
    setExcludeTransfers(checked)
    setTimeout(() => handleRefresh(), 0)
  }

  const handlePeriodTypeChange = (type: string) => {
    setPeriodType(type as PeriodType)
    // Auto refresh after type change
    setTimeout(() => handleRefresh(), 0)
  }

  const handleYearChange = (year: string) => {
    const yearNum = parseInt(year)
    setSelectedYear(yearNum)
    // Reset month/quarter to first available
    const months = availablePeriods.monthsByYear[yearNum] || []
    const quarters = availablePeriods.quartersByYear[yearNum] || []
    if (months.length > 0) setSelectedMonth(months[0])
    if (quarters.length > 0) setSelectedQuarter(quarters[0])
    setTimeout(() => handleRefresh(), 0)
  }

  const handleMonthChange = (month: string) => {
    setSelectedMonth(parseInt(month))
    setTimeout(() => handleRefresh(), 0)
  }

  const handleQuarterChange = (quarter: string) => {
    setSelectedQuarter(parseInt(quarter))
    setTimeout(() => handleRefresh(), 0)
  }

  const handleAccountChange = (account: string) => {
    setSelectedAccount(account)
    setTimeout(() => handleRefresh(), 0)
  }

  const handleDateRangeChange = (range: DateRange) => {
    setCustomRange(range)
    if (range.from && range.to) {
      setTimeout(() => handleRefresh(), 0)
    }
  }

  const handleCategoryClick = async (category: PnLCategoryData, type: 'income' | 'expense') => {
    // If clicking the same category, close the panel
    if (selectedCategory?.id === category.categoryId && selectedCategory?.type === type) {
      setSelectedCategory(null)
      setCategoryTransactions([])
      return
    }

    setSelectedCategory({
      id: category.categoryId,
      name: category.categoryName,
      type,
      color: category.categoryColor,
    })
    setIsLoadingTransactions(true)

    try {
      const accountNumber = selectedAccount === 'all' ? undefined : selectedAccount
      const transactions = await getTransactionsByCategory(
        category.categoryId,
        summary.period.from,
        summary.period.to,
        type,
        accountNumber
      )
      setCategoryTransactions(transactions)
    } catch (error) {
      console.error('Error fetching transactions:', error)
      setCategoryTransactions([])
    } finally {
      setIsLoadingTransactions(false)
    }
  }

  const closeCategoryDetail = () => {
    setSelectedCategory(null)
    setCategoryTransactions([])
  }

  const isProfit = summary.netProfit >= 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">งบกำไรขาดทุน</h1>
            <p className="text-muted-foreground">Profit & Loss Statement</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={isPending}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isPending ? 'animate-spin' : ''}`} />
          รีเฟรช
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center">
            {/* Account Filter */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">บัญชี:</span>
              <Select value={selectedAccount} onValueChange={handleAccountChange}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="เลือกบัญชี" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">ทุกบัญชี</SelectItem>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.accountNumber} value={acc.accountNumber || ''}>
                      {acc.accountNumber} - {acc.accountName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Exclude Transfers Toggle */}
            <div className="flex items-center gap-2">
              <Switch
                id="exclude-transfers"
                checked={excludeTransfers}
                onCheckedChange={handleExcludeTransfersChange}
              />
              <Label htmlFor="exclude-transfers" className="text-sm cursor-pointer">
                ไม่รวมโอนระหว่างบัญชี
              </Label>
            </div>

            {/* Period Type Tabs */}
            <Tabs value={periodType} onValueChange={handlePeriodTypeChange}>
              <TabsList>
                <TabsTrigger value="monthly">รายเดือน</TabsTrigger>
                <TabsTrigger value="quarterly">รายไตรมาส</TabsTrigger>
                <TabsTrigger value="custom">กำหนดเอง</TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Period Selectors */}
            <div className="flex items-center gap-2">
              {periodType !== 'custom' && (
                <Select value={selectedYear.toString()} onValueChange={handleYearChange}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue placeholder="ปี" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePeriods.years.map((year) => (
                      <SelectItem key={year} value={year.toString()}>
                        {toBuddhistYear(year)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {periodType === 'monthly' && (
                <Select value={selectedMonth.toString()} onValueChange={handleMonthChange}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="เดือน" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMonths.map((month) => (
                      <SelectItem key={month} value={month.toString()}>
                        {getThaiMonthName(month)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {periodType === 'quarterly' && (
                <Select value={selectedQuarter.toString()} onValueChange={handleQuarterChange}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="ไตรมาส" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableQuarters.map((quarter) => (
                      <SelectItem key={quarter} value={quarter.toString()}>
                        ไตรมาส {quarter}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {periodType === 'custom' && (
                <DateRangePicker
                  value={customRange}
                  onChange={handleDateRangeChange}
                />
              )}
            </div>
          </div>

          {/* Period Label */}
          <div className="mt-4 text-center">
            <span className="text-lg font-medium text-muted-foreground">
              ช่วงเวลา: {summary.period.label}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Income */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">รายรับ</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(summary.totalIncome)}
                </p>
              </div>
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-full">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Expense */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">รายจ่าย</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(summary.totalExpense)}
                </p>
              </div>
              <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full">
                <TrendingDown className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Net Profit/Loss */}
        <Card className={isProfit ? 'border-green-200 dark:border-green-800' : 'border-red-200 dark:border-red-800'}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {isProfit ? 'กำไรสุทธิ' : 'ขาดทุนสุทธิ'}
                </p>
                <p className={`text-2xl font-bold ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                  {isProfit ? '' : '-'}{formatCurrency(Math.abs(summary.netProfit))}
                </p>
              </div>
              <div className={`p-3 rounded-full ${isProfit ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                <Wallet className={`h-6 w-6 ${isProfit ? 'text-green-600' : 'text-red-600'}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CategoryBreakdown
          title="รายรับตามหมวดหมู่"
          data={summary.incomeByCategory}
          total={summary.totalIncome}
          colorScheme="green"
          onCategoryClick={(cat) => handleCategoryClick(cat, 'income')}
          selectedCategoryId={selectedCategory?.type === 'income' ? selectedCategory.id : undefined}
        />
        <CategoryBreakdown
          title="รายจ่ายตามหมวดหมู่"
          data={summary.expenseByCategory}
          total={summary.totalExpense}
          colorScheme="red"
          onCategoryClick={(cat) => handleCategoryClick(cat, 'expense')}
          selectedCategoryId={selectedCategory?.type === 'expense' ? selectedCategory.id : undefined}
        />
      </div>

      {/* Category Transaction Detail */}
      {selectedCategory && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-sm"
                  style={{ backgroundColor: selectedCategory.color }}
                />
                <span>
                  รายการ: {selectedCategory.name}
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    ({selectedCategory.type === 'income' ? 'รายรับ' : 'รายจ่าย'})
                  </span>
                </span>
              </div>
              <Button variant="ghost" size="icon" onClick={closeCategoryDetail}>
                <X className="h-4 w-4" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingTransactions ? (
              <div className="h-[200px] flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : categoryTransactions.length === 0 ? (
              <div className="h-[100px] flex items-center justify-center text-muted-foreground">
                ไม่พบรายการ
              </div>
            ) : (
              <div className="overflow-auto max-h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[120px]">วันที่</TableHead>
                      <TableHead>รายละเอียด</TableHead>
                      <TableHead>หมายเหตุ</TableHead>
                      <TableHead>บัญชี</TableHead>
                      <TableHead className="text-right w-[120px]">จำนวนเงิน</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categoryTransactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-sm">
                          {new Date(tx.date).toLocaleDateString('th-TH', {
                            day: '2-digit',
                            month: 'short',
                            year: '2-digit',
                          })}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={tx.description}>
                          {tx.description}
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate text-muted-foreground" title={tx.note || ''}>
                          {tx.note || '-'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {tx.accountName || tx.accountNumber || '-'}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${selectedCategory.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(tx.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-2 text-sm text-muted-foreground text-center">
                  รวม {categoryTransactions.length} รายการ
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Loading Overlay */}
      {isPending && (
        <div className="fixed inset-0 bg-background/50 flex items-center justify-center z-50">
          <div className="flex items-center gap-2 bg-background p-4 rounded-lg shadow-lg">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span>กำลังโหลด...</span>
          </div>
        </div>
      )}
    </div>
  )
}
