'use client'

import { useMemo } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { type CategoryData } from '@/lib/actions/dashboard'

interface ChartData {
  name: string
  value: number
  color: string
  percent: number
}

interface CategoryPieChartProps {
  data: CategoryData[]
}

const COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#22c55e', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#6366f1', // indigo
  '#94a3b8', // gray (for others)
]

function formatCurrency(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(0)}K`
  }
  return value.toFixed(0)
}

function formatFullCurrency(value: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const MAX_CATEGORIES = 8

export default function CategoryPieChart({ data }: CategoryPieChartProps) {
  const { chartData, total } = useMemo(() => {
    const total = data.reduce((sum, item) => sum + item.value, 0)

    if (data.length <= MAX_CATEGORIES) {
      return {
        chartData: data.map((d, i) => ({
          name: d.name,
          value: d.value,
          color: d.color || COLORS[i % COLORS.length],
          percent: (d.value / total) * 100,
        })),
        total,
      }
    }

    // Sort by value and take top categories
    const sorted = [...data].sort((a, b) => b.value - a.value)
    const topCategories = sorted.slice(0, MAX_CATEGORIES - 1)
    const others = sorted.slice(MAX_CATEGORIES - 1)
    const othersTotal = others.reduce((sum, item) => sum + item.value, 0)

    const result: ChartData[] = topCategories.map((d, i) => ({
      name: d.name,
      value: d.value,
      color: d.color || COLORS[i % COLORS.length],
      percent: (d.value / total) * 100,
    }))

    if (othersTotal > 0) {
      result.push({
        name: `อื่นๆ (${others.length} หมวด)`,
        value: othersTotal,
        color: '#94a3b8',
        percent: (othersTotal / total) * 100,
      })
    }

    return { chartData: result, total }
  }, [data])

  if (data.length === 0) {
    return (
      <Card className="col-span-3">
        <CardHeader>
          <CardTitle>สัดส่วนรายจ่ายตามหมวดหมู่</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[350px] flex items-center justify-center text-muted-foreground">
            ไม่มีข้อมูล
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="col-span-3">
      <CardHeader>
        <CardTitle>สัดส่วนรายจ่ายตามหมวดหมู่</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Pie Chart */}
          <div className="h-[200px] lg:h-[280px] flex-1 min-w-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius="50%"
                  outerRadius="90%"
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

          {/* Legend */}
          <div className="flex-1 space-y-1 overflow-y-auto max-h-[280px]">
            {chartData.map((item, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-2 py-1 px-2 rounded hover:bg-muted/50"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-3 h-3 rounded-sm shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-sm truncate">{item.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-medium">
                    {formatCurrency(item.value)}
                  </span>
                  <span className="text-xs text-muted-foreground w-12 text-right">
                    {item.percent.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}

            {/* Total */}
            <div className="flex items-center justify-between gap-2 py-2 px-2 border-t mt-2">
              <span className="text-sm font-medium">รวมทั้งหมด</span>
              <span className="text-sm font-bold">
                {formatFullCurrency(total)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
