import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { type SummaryData, type AccountBalance } from '@/lib/actions/dashboard'

interface SummaryCardsProps {
  data: SummaryData
  accountBalances?: AccountBalance[]
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 2,
  }).format(amount)
}

export default function SummaryCards({ data, accountBalances = [] }: SummaryCardsProps) {
  const totalBalance = accountBalances.length > 0
    ? accountBalances.reduce((sum, acc) => sum + acc.balance, 0)
    : data.netBalance

  const showMultipleAccounts = accountBalances.length > 1

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Total Income */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">รายรับทั้งหมด</CardTitle>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="h-4 w-4 text-green-600"
          >
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(data.totalIncome)}
          </div>
          <p className="text-xs text-muted-foreground">
            ยอดเงินฝากทั้งหมด
          </p>
        </CardContent>
      </Card>

      {/* Total Expense */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">รายจ่ายทั้งหมด</CardTitle>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="h-4 w-4 text-red-600"
          >
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {formatCurrency(data.totalExpense)}
          </div>
          <p className="text-xs text-muted-foreground">
            ยอดเงินถอนทั้งหมด
          </p>
        </CardContent>
      </Card>

      {/* Net Balance - Show all accounts when multiple */}
      <Card className={showMultipleAccounts ? 'lg:col-span-2' : ''}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">ยอดคงเหลือ</CardTitle>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="h-4 w-4 text-blue-600"
          >
            <rect width="20" height="14" x="2" y="5" rx="2" />
            <path d="M2 10h20" />
          </svg>
        </CardHeader>
        <CardContent>
          {showMultipleAccounts ? (
            <div className="space-y-3">
              {/* Total */}
              <div className="pb-2 border-b">
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(totalBalance)}
                </div>
                <p className="text-xs text-muted-foreground">
                  รวมทุกบัญชี ({accountBalances.length} บัญชี)
                </p>
              </div>
              {/* Each account */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {accountBalances.map((acc) => (
                  <div key={acc.accountNumber} className="p-2 bg-muted rounded-lg">
                    <div className="text-sm font-medium text-blue-600">
                      {formatCurrency(acc.balance)}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {acc.accountName || acc.accountNumber}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="text-2xl font-bold text-blue-600">
                {formatCurrency(data.netBalance)}
              </div>
              <p className="text-xs text-muted-foreground">
                ยอดเงินคงเหลือล่าสุด
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Transaction Count - Only show when not showing multiple accounts */}
      {!showMultipleAccounts && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">จำนวนรายการ</CardTitle>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              className="h-4 w-4 text-muted-foreground"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.transactionCount.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              รายการทั้งหมด
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
