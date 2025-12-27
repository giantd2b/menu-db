'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
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
import {
  ArrowLeft,
  RefreshCw,
  Calendar,
  TrendingUp,
  Trash2,
} from 'lucide-react'
import {
  type RecurringPatternData,
  runRecurringDetection,
  updateRecurringPattern,
  deleteRecurringPattern,
} from '@/lib/actions/recurring'
import { useRouter } from 'next/navigation'

interface RecurringClientProps {
  initialPatterns: RecurringPatternData[]
  initialSummary: {
    totalPatterns: number
    activePatterns: number
    monthlyEstimate: number
  }
  categories: { id: string; name: string }[]
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  })
}

function formatFrequency(freq: string): string {
  switch (freq) {
    case 'weekly':
      return 'รายสัปดาห์'
    case 'monthly':
      return 'รายเดือน'
    case 'yearly':
      return 'รายปี'
    default:
      return freq
  }
}

export default function RecurringClient({
  initialPatterns,
  initialSummary,
  categories,
}: RecurringClientProps) {
  const [patterns, setPatterns] = useState(initialPatterns)
  const [summary, setSummary] = useState(initialSummary)
  const [isPending, startTransition] = useTransition()
  const [isDetecting, setIsDetecting] = useState(false)
  const router = useRouter()

  const handleDetect = async () => {
    setIsDetecting(true)
    startTransition(async () => {
      const result = await runRecurringDetection()
      router.refresh()
      setIsDetecting(false)
    })
  }

  const handleToggleActive = async (id: string, isActive: boolean) => {
    startTransition(async () => {
      await updateRecurringPattern(id, { isActive })
      setPatterns((prev) =>
        prev.map((p) => (p.id === id ? { ...p, isActive } : p))
      )
    })
  }

  const handleCategoryChange = async (id: string, categoryId: string) => {
    startTransition(async () => {
      await updateRecurringPattern(id, {
        categoryId: categoryId === 'none' ? null : categoryId,
      })
      const cat = categories.find((c) => c.id === categoryId)
      setPatterns((prev) =>
        prev.map((p) =>
          p.id === id
            ? { ...p, categoryId: categoryId === 'none' ? null : categoryId, categoryName: cat?.name || null }
            : p
        )
      )
    })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('ต้องการลบรายจ่ายประจำนี้?')) return

    startTransition(async () => {
      await deleteRecurringPattern(id)
      setPatterns((prev) => prev.filter((p) => p.id !== id))
    })
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">รายจ่ายประจำ</h1>
            <p className="text-muted-foreground">ตรวจจับและจัดการรายจ่ายที่เกิดขึ้นซ้ำ</p>
          </div>
        </div>
        <Button onClick={handleDetect} disabled={isDetecting || isPending}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isDetecting ? 'animate-spin' : ''}`} />
          {isDetecting ? 'กำลังตรวจจับ...' : 'ตรวจจับใหม่'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>รายการทั้งหมด</CardDescription>
            <CardTitle className="text-3xl">{patterns.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4 inline mr-1" />
              {patterns.filter((p) => p.isActive).length} รายการที่ใช้งาน
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>ประมาณการต่อเดือน</CardDescription>
            <CardTitle className="text-3xl text-red-600">
              {formatCurrency(summary.monthlyEstimate)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 inline mr-1" />
              รวมทุกความถี่
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>ประมาณการต่อปี</CardDescription>
            <CardTitle className="text-3xl text-red-600">
              {formatCurrency(summary.monthlyEstimate * 12)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              คำนวณจากค่าเฉลี่ย
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Patterns Table */}
      <Card>
        <CardHeader>
          <CardTitle>รายการที่ตรวจจับได้</CardTitle>
        </CardHeader>
        <CardContent>
          {patterns.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>ยังไม่พบรายจ่ายประจำ</p>
              <p className="text-sm mt-2">คลิก &quot;ตรวจจับใหม่&quot; เพื่อวิเคราะห์รายการ</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">ใช้งาน</TableHead>
                  <TableHead>ชื่อ/Pattern</TableHead>
                  <TableHead>ความถี่</TableHead>
                  <TableHead className="text-right">ยอดเฉลี่ย</TableHead>
                  <TableHead>จำนวนครั้ง</TableHead>
                  <TableHead>ล่าสุด</TableHead>
                  <TableHead>หมวดหมู่</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patterns.map((pattern) => (
                  <TableRow key={pattern.id} className={!pattern.isActive ? 'opacity-50' : ''}>
                    <TableCell>
                      <Switch
                        checked={pattern.isActive}
                        onCheckedChange={(checked) => handleToggleActive(pattern.id, checked)}
                        disabled={isPending}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{pattern.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {pattern.field === 'note' ? 'Note' : 'Description'}
                          {pattern.isAutoDetected && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              Auto
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {formatFrequency(pattern.frequency)}
                      </Badge>
                      {pattern.expectedDay && (
                        <span className="text-xs text-muted-foreground ml-1">
                          (วันที่ {pattern.expectedDay})
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium text-red-600">
                      {formatCurrency(pattern.averageAmount)}
                    </TableCell>
                    <TableCell>{pattern.occurrenceCount} ครั้ง</TableCell>
                    <TableCell>{formatDate(pattern.lastOccurrence)}</TableCell>
                    <TableCell>
                      <Select
                        value={pattern.categoryId || 'none'}
                        onValueChange={(v) => handleCategoryChange(pattern.id, v)}
                        disabled={isPending}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">ไม่ระบุ</SelectItem>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(pattern.id)}
                        disabled={isPending}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
