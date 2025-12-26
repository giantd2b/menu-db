import UploadForm from '@/components/UploadForm'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="container mx-auto px-4">
        <div className="flex justify-end mb-4">
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ไปที่ Dashboard
          </Link>
        </div>
        <UploadForm />
      </div>
    </div>
  )
}
