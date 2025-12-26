import { getRules, getCategoriesForSelect } from '@/lib/actions/category-rules'
import RulesClient from './RulesClient'

export default async function RulesPage() {
  const [rules, categories] = await Promise.all([
    getRules(),
    getCategoriesForSelect(),
  ])

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">จัดการกฎหมวดหมู่อัตโนมัติ</h1>
        <p className="text-muted-foreground mt-1">
          กำหนดกฎสำหรับจัดหมวดหมู่ transaction อัตโนมัติ
        </p>
      </div>
      <RulesClient initialRules={rules} categories={categories} />
    </div>
  )
}
