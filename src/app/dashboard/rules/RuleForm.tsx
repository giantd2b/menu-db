'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, CheckCircle } from 'lucide-react'
import {
  type RuleData,
  type RuleInput,
  createRule,
  updateRule,
  testPattern,
} from '@/lib/actions/category-rules'

interface RuleFormProps {
  categories: { id: string; name: string; color: string | null }[]
  editingRule: RuleData | null
  onSuccess: () => void
  onCancel: () => void
}

export default function RuleForm({
  categories,
  editingRule,
  onSuccess,
  onCancel,
}: RuleFormProps) {
  const [categoryId, setCategoryId] = useState(editingRule?.categoryId || '')
  const [field, setField] = useState<'note' | 'description'>(
    (editingRule?.field as 'note' | 'description') || 'note'
  )
  const [pattern, setPattern] = useState(editingRule?.pattern || '')
  const [isRegex, setIsRegex] = useState(editingRule?.isRegex || false)
  const [priority, setPriority] = useState(editingRule?.priority?.toString() || '10')
  const [isActive, setIsActive] = useState(editingRule?.isActive ?? true)

  const [testText, setTestText] = useState('')
  const [testResult, setTestResult] = useState<{ matches: boolean; error?: string } | null>(null)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleTest = async () => {
    if (!pattern || !testText) return
    const result = await testPattern(pattern, isRegex, testText)
    setTestResult(result)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    const input: RuleInput = {
      categoryId,
      field,
      pattern,
      isRegex,
      priority: parseInt(priority, 10) || 10,
      isActive,
    }

    const result = editingRule
      ? await updateRule(editingRule.id, input)
      : await createRule(input)

    setIsSubmitting(false)

    if (result.success) {
      onSuccess()
    } else {
      setError(result.error || 'เกิดข้อผิดพลาด')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Category */}
      <div className="space-y-2">
        <Label htmlFor="category">หมวดหมู่</Label>
        <Select value={categoryId} onValueChange={setCategoryId} required>
          <SelectTrigger>
            <SelectValue placeholder="เลือกหมวดหมู่" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {categories.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                <div className="flex items-center gap-2">
                  {cat.color && (
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                  )}
                  {cat.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Field */}
      <div className="space-y-2">
        <Label htmlFor="field">ตรวจสอบใน</Label>
        <Select value={field} onValueChange={(v) => setField(v as 'note' | 'description')}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="note">Note (หมายเหตุ)</SelectItem>
            <SelectItem value="description">Description (รายละเอียด)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Pattern */}
      <div className="space-y-2">
        <Label htmlFor="pattern">Pattern</Label>
        <Input
          id="pattern"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder={isRegex ? 'ใส่ Regex เช่น รับ.*พระ' : 'ใส่คำที่ต้องการค้นหา'}
          required
        />
      </div>

      {/* Is Regex */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="isRegex">ใช้ Regex</Label>
          <p className="text-sm text-muted-foreground">
            เปิดใช้งาน Regular Expression
          </p>
        </div>
        <Switch
          id="isRegex"
          checked={isRegex}
          onCheckedChange={setIsRegex}
        />
      </div>

      {/* Priority */}
      <div className="space-y-2">
        <Label htmlFor="priority">ลำดับความสำคัญ</Label>
        <Input
          id="priority"
          type="number"
          min="1"
          max="100"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        />
        <p className="text-sm text-muted-foreground">
          ยิ่งตัวเลขน้อย ยิ่งมีความสำคัญสูง (ตรวจสอบก่อน)
        </p>
      </div>

      {/* Is Active */}
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label htmlFor="isActive">เปิดใช้งาน</Label>
          <p className="text-sm text-muted-foreground">
            กฎนี้จะถูกใช้งานหรือไม่
          </p>
        </div>
        <Switch
          id="isActive"
          checked={isActive}
          onCheckedChange={setIsActive}
        />
      </div>

      {/* Test Pattern */}
      <div className="border rounded-lg p-4 space-y-3 bg-muted/50">
        <Label>ทดสอบ Pattern</Label>
        <div className="flex gap-2">
          <Input
            placeholder="ใส่ข้อความทดสอบ"
            value={testText}
            onChange={(e) => {
              setTestText(e.target.value)
              setTestResult(null)
            }}
          />
          <Button type="button" variant="secondary" onClick={handleTest}>
            ทดสอบ
          </Button>
        </div>
        {testResult && (
          <div className="flex items-center gap-2">
            {testResult.error ? (
              <>
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm text-destructive">{testResult.error}</span>
              </>
            ) : testResult.matches ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <Badge variant="outline" className="text-green-600 border-green-600">
                  ตรงกัน
                </Badge>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 text-orange-500" />
                <Badge variant="outline" className="text-orange-500 border-orange-500">
                  ไม่ตรงกัน
                </Badge>
              </>
            )}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-destructive flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          ยกเลิก
        </Button>
        <Button type="submit" disabled={isSubmitting || !categoryId || !pattern}>
          {isSubmitting ? 'กำลังบันทึก...' : editingRule ? 'บันทึก' : 'สร้างกฎ'}
        </Button>
      </div>
    </form>
  )
}
