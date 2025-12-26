'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Switch } from '@/components/ui/switch'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { type RuleData, toggleRuleActive, deleteRule } from '@/lib/actions/category-rules'
import RuleForm from './RuleForm'

interface RulesClientProps {
  initialRules: RuleData[]
  categories: { id: string; name: string; color: string | null }[]
}

export default function RulesClient({ initialRules, categories }: RulesClientProps) {
  const [rules, setRules] = useState(initialRules)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<RuleData | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleToggleActive = async (id: string) => {
    setIsLoading(true)
    const result = await toggleRuleActive(id)
    if (result.success) {
      setRules(rules.map(r =>
        r.id === id ? { ...r, isActive: !r.isActive } : r
      ))
    }
    setIsLoading(false)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('ต้องการลบ rule นี้หรือไม่?')) return

    setIsLoading(true)
    const result = await deleteRule(id)
    if (result.success) {
      setRules(rules.filter(r => r.id !== id))
    }
    setIsLoading(false)
  }

  const handleEdit = (rule: RuleData) => {
    setEditingRule(rule)
    setIsFormOpen(true)
  }

  const handleAdd = () => {
    setEditingRule(null)
    setIsFormOpen(true)
  }

  const handleFormSuccess = () => {
    setIsFormOpen(false)
    setEditingRule(null)
    // Refresh page to get updated data
    window.location.reload()
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>รายการกฎทั้งหมด ({rules.length})</CardTitle>
          <Button onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            เพิ่มกฎใหม่
          </Button>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              ยังไม่มีกฎ กดปุ่ม "เพิ่มกฎใหม่" เพื่อเริ่มต้น
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">ลำดับ</TableHead>
                  <TableHead>หมวดหมู่</TableHead>
                  <TableHead>ตรวจสอบใน</TableHead>
                  <TableHead>Pattern</TableHead>
                  <TableHead className="w-[80px]">Regex</TableHead>
                  <TableHead className="w-[80px]">สถานะ</TableHead>
                  <TableHead className="w-[100px]">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => (
                  <TableRow key={rule.id} className={!rule.isActive ? 'opacity-50' : ''}>
                    <TableCell className="font-mono">{rule.priority}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        style={{
                          borderColor: rule.categoryColor || undefined,
                          color: rule.categoryColor || undefined,
                        }}
                      >
                        {rule.categoryName}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {rule.field === 'note' ? 'Note' : 'Description'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm max-w-[200px] truncate">
                      {rule.pattern}
                    </TableCell>
                    <TableCell>
                      {rule.isRegex ? (
                        <Badge variant="destructive">Regex</Badge>
                      ) : (
                        <Badge variant="outline">Text</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={rule.isActive}
                        onCheckedChange={() => handleToggleActive(rule.id)}
                        disabled={isLoading}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(rule)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(rule.id)}
                          disabled={isLoading}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingRule ? 'แก้ไขกฎ' : 'เพิ่มกฎใหม่'}
            </DialogTitle>
          </DialogHeader>
          <RuleForm
            categories={categories}
            editingRule={editingRule}
            onSuccess={handleFormSuccess}
            onCancel={() => setIsFormOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
