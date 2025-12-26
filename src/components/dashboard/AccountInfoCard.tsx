import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { type AccountInfo } from '@/lib/actions/dashboard'

interface AccountInfoCardProps {
  account: AccountInfo | null
}

export default function AccountInfoCard({ account }: AccountInfoCardProps) {
  if (!account) {
    return null
  }

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="h-5 w-5"
          >
            <rect width="20" height="14" x="2" y="5" rx="2" />
            <path d="M2 10h20" />
          </svg>
          ข้อมูลบัญชี
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-6">
          {account.accountNumber && (
            <div>
              <p className="text-sm text-muted-foreground">เลขที่บัญชี</p>
              <p className="text-lg font-semibold font-mono">{account.accountNumber}</p>
            </div>
          )}
          {account.accountName && (
            <div>
              <p className="text-sm text-muted-foreground">ชื่อบัญชี</p>
              <p className="text-lg font-semibold">{account.accountName}</p>
            </div>
          )}
          {account.accountType && (
            <div>
              <p className="text-sm text-muted-foreground">ประเภทบัญชี</p>
              <Badge variant="secondary" className="mt-1">
                {account.accountType}
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
