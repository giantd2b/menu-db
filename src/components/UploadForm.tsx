'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { previewTransactions, type TransactionPreview, type PreviewResult } from '@/lib/actions/preview-transactions'
import { saveReviewedTransactions, type SaveResult } from '@/lib/actions/save-reviewed-transactions'
import { SearchableSelect } from '@/components/ui/searchable-select'

type Step = 'upload' | 'review' | 'done'

export default function UploadForm() {
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>('upload')
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null)
  const [previews, setPreviews] = useState<TransactionPreview[]>([])
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null)
  const [categories, setCategories] = useState<string[]>([])
  const [filter, setFilter] = useState<'all' | 'withdrawal' | 'deposit'>('withdrawal')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load categories on mount
  useEffect(() => {
    fetch('/api/sync-categories')
      .then(res => res.json())
      .then(data => {
        if (data.categories) {
          setCategories(data.categories.map((c: { name: string }) => c.name))
        }
      })
      .catch(console.error)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const isValidFile = (filename: string) => {
    const lower = filename.toLowerCase()
    return lower.endsWith('.csv') || lower.endsWith('.xlsx') || lower.endsWith('.xls')
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && isValidFile(droppedFile.name)) {
      setFile(droppedFile)
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
    }
  }

  // Step 1: Upload and Preview with AI
  const handlePreview = async () => {
    if (!file) return

    setIsProcessing(true)
    setPreviewResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const result = await previewTransactions(formData)
      setPreviewResult(result)

      if (result.success && result.previews) {
        setPreviews(result.previews)
        setStep('review')
      }
    } catch (error) {
      setPreviewResult({
        success: false,
        message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  // Update category for a preview
  const handleCategoryChange = (index: number, newCategory: string) => {
    setPreviews(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], selectedCategory: newCategory }
      return updated
    })
  }

  // Step 2: Save reviewed transactions
  const handleSave = async () => {
    setIsProcessing(true)

    try {
      const result = await saveReviewedTransactions(previews)
      setSaveResult(result)

      if (result.success) {
        // Invalidate all dashboard-related queries to refresh data
        await queryClient.invalidateQueries({ queryKey: ['summary'] })
        await queryClient.invalidateQueries({ queryKey: ['balanceTrend'] })
        await queryClient.invalidateQueries({ queryKey: ['expensesByCategory'] })
        await queryClient.invalidateQueries({ queryKey: ['transactions'] })

        setStep('done')
        setFile(null)
        setPreviews([])
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }
    } catch (error) {
      setSaveResult({
        success: false,
        message: error instanceof Error ? error.message : 'เกิดข้อผิดพลาด',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleReset = () => {
    setStep('upload')
    setFile(null)
    setPreviewResult(null)
    setPreviews([])
    setSaveResult(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  const formatAmount = (amount: number | null) => {
    if (!amount) return '-'
    return amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })
  }

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'text-green-600 bg-green-100'
      case 'medium': return 'text-yellow-600 bg-yellow-100'
      case 'low': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  // Filter previews
  const filteredPreviews = previews.filter(p => {
    if (filter === 'withdrawal') return p.transaction.withdrawal && p.transaction.withdrawal > 0
    if (filter === 'deposit') return p.transaction.deposit && p.transaction.deposit > 0
    return true
  })

  // Count changes
  const changesCount = previews.filter(p => p.selectedCategory !== p.aiCategory).length

  // Step 1: Upload
  if (step === 'upload') {
    return (
      <div className="w-full max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-center mb-6">
          Bank Statement Upload
        </h1>

        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer
            transition-all duration-200 ease-in-out
            ${isDragging
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
              : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
            }
            ${file ? 'bg-green-50 dark:bg-green-950 border-green-400' : ''}
          `}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />

          {file ? (
            <div className="space-y-2">
              <div className="w-16 h-16 mx-auto bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="font-medium text-gray-900 dark:text-gray-100">{file.name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{formatFileSize(file.size)}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <div>
                <p className="font-medium text-gray-700 dark:text-gray-300">
                  ลากไฟล์มาวางที่นี่ หรือ คลิกเพื่อเลือกไฟล์
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  รองรับไฟล์ CSV และ Excel (.xlsx, .xls)
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        {file && (
          <div className="flex gap-3 mt-4">
            <button
              onClick={handlePreview}
              disabled={isProcessing}
              className={`
                flex-1 py-3 px-4 rounded-lg font-medium text-white
                transition-all duration-200
                ${isProcessing
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
                }
              `}
            >
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  AI กำลังวิเคราะห์...
                </span>
              ) : (
                'วิเคราะห์ด้วย AI'
              )}
            </button>
            <button
              onClick={handleReset}
              disabled={isProcessing}
              className="py-3 px-4 rounded-lg font-medium border border-gray-300 dark:border-gray-600
                         text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800
                         transition-all duration-200 disabled:opacity-50"
            >
              ยกเลิก
            </button>
          </div>
        )}

        {/* Error */}
        {previewResult && !previewResult.success && (
          <div className="mt-6 p-4 rounded-lg border bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800">
            <p className="text-red-800 dark:text-red-200">{previewResult.message}</p>
          </div>
        )}
      </div>
    )
  }

  // Step 2: Review
  if (step === 'review') {
    return (
      <div className="w-full max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">ตรวจสอบการจัดหมวดหมู่</h1>
            <p className="text-gray-500">
              AI วิเคราะห์แล้ว {previews.length} รายการ
              {changesCount > 0 && (
                <span className="ml-2 text-blue-600">
                  (แก้ไขแล้ว {changesCount} รายการ)
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSave}
              disabled={isProcessing}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {isProcessing ? 'กำลังบันทึก...' : `บันทึก ${previews.length} รายการ`}
            </button>
          </div>
        </div>

        {/* Stats */}
        {previewResult?.stats && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
              <p className="text-sm text-gray-500">ทั้งหมด</p>
              <p className="text-2xl font-bold">{previewResult.stats.validRows}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
              <p className="text-sm text-gray-500">รายจ่าย</p>
              <p className="text-2xl font-bold text-red-600">{previewResult.stats.withdrawalRows}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
              <p className="text-sm text-gray-500">รายรับ</p>
              <p className="text-2xl font-bold text-green-600">{previewResult.stats.depositRows}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
              <p className="text-sm text-gray-500">แก้ไขแล้ว</p>
              <p className="text-2xl font-bold text-blue-600">{changesCount}</p>
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg ${filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}
          >
            ทั้งหมด ({previews.length})
          </button>
          <button
            onClick={() => setFilter('withdrawal')}
            className={`px-4 py-2 rounded-lg ${filter === 'withdrawal' ? 'bg-red-600 text-white' : 'bg-gray-100'}`}
          >
            รายจ่าย ({previews.filter(p => p.transaction.withdrawal && p.transaction.withdrawal > 0).length})
          </button>
          <button
            onClick={() => setFilter('deposit')}
            className={`px-4 py-2 rounded-lg ${filter === 'deposit' ? 'bg-green-600 text-white' : 'bg-gray-100'}`}
          >
            รายรับ ({previews.filter(p => p.transaction.deposit && p.transaction.deposit > 0).length})
          </button>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border overflow-hidden">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">วันที่</th>
                  <th className="px-4 py-3 text-left font-medium">Note</th>
                  <th className="px-4 py-3 text-right font-medium">จำนวน</th>
                  <th className="px-4 py-3 text-left font-medium">AI Confidence</th>
                  <th className="px-4 py-3 text-left font-medium min-w-[250px]">หมวดหมู่</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredPreviews.map((preview, index) => {
                  const originalIndex = previews.indexOf(preview)
                  const isChanged = preview.selectedCategory !== preview.aiCategory
                  const isWithdrawal = preview.transaction.withdrawal && preview.transaction.withdrawal > 0

                  return (
                    <tr
                      key={index}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${isChanged ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        {new Date(preview.transaction.date).toLocaleDateString('th-TH')}
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-[300px]">
                          <p className="font-medium truncate">{preview.transaction.note || '-'}</p>
                          {preview.transaction.description && (
                            <p className="text-xs text-blue-500 truncate" title={`Tr Description: ${preview.transaction.description}`}>
                              {preview.transaction.description}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 truncate" title={`Description: ${preview.transaction.rawDescription}`}>
                            {preview.transaction.rawDescription}
                          </p>
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-right font-medium ${isWithdrawal ? 'text-red-600' : 'text-green-600'}`}>
                        {isWithdrawal
                          ? `-${formatAmount(preview.transaction.withdrawal)}`
                          : `+${formatAmount(preview.transaction.deposit)}`
                        }
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getConfidenceColor(preview.aiConfidence)}`}>
                          {preview.aiConfidence}
                        </span>
                        {preview.aiReasoning && (
                          <p className="text-xs text-gray-500 mt-1 max-w-[150px] truncate" title={preview.aiReasoning}>
                            {preview.aiReasoning}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <SearchableSelect
                          value={preview.selectedCategory}
                          onChange={(value) => handleCategoryChange(originalIndex, value)}
                          options={categories}
                          isChanged={isChanged}
                          placeholder="เลือกหมวดหมู่..."
                        />
                        {isChanged && (
                          <p className="text-xs text-blue-600 mt-1">
                            AI: {preview.aiCategory}
                          </p>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Save Error */}
        {saveResult && !saveResult.success && (
          <div className="mt-4 p-4 rounded-lg border bg-red-50 border-red-200">
            <p className="text-red-800 font-medium">{saveResult.message}</p>
            {saveResult.validationIssues && saveResult.validationIssues.length > 0 && (
              <div className="mt-3">
                <p className="text-sm text-red-700 font-medium mb-2">รายการที่มีปัญหา:</p>
                <ul className="text-sm text-red-600 space-y-1">
                  {saveResult.validationIssues.slice(0, 10).map((issue, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="font-mono bg-red-100 px-1 rounded">#{issue.index + 1}</span>
                      <span>{issue.issue}: {JSON.stringify(issue.value)}</span>
                    </li>
                  ))}
                  {saveResult.validationIssues.length > 10 && (
                    <li className="text-red-500">...และอีก {saveResult.validationIssues.length - 10} รายการ</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // Step 3: Done
  return (
    <div className="w-full max-w-2xl mx-auto p-6 text-center">
      <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>

      <h1 className="text-2xl font-bold mb-2">บันทึกสำเร็จ!</h1>
      <p className="text-gray-500 mb-6">{saveResult?.message}</p>

      {saveResult?.stats && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
              <p className="text-sm text-gray-500">เพิ่มใหม่</p>
              <p className="text-2xl font-bold text-green-600">{saveResult.stats.insertedRows}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
              <p className="text-sm text-gray-500">อัพเดท</p>
              <p className="text-2xl font-bold text-blue-600">{saveResult.stats.updatedRows}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border">
              <p className="text-sm text-gray-500">AI เรียนรู้</p>
              <p className="text-2xl font-bold text-purple-600">{saveResult.stats.correctionsLearned}</p>
            </div>
          </div>

          {/* Show skipped rows if any */}
          {saveResult.stats.skippedRows && saveResult.stats.skippedRows > 0 && (
            <div className="mb-6 p-4 rounded-lg border bg-yellow-50 border-yellow-200 text-left">
              <p className="text-yellow-800 font-medium">
                ข้ามไป {saveResult.stats.skippedRows} รายการ (มีข้อผิดพลาด)
              </p>
              {saveResult.stats.errors && saveResult.stats.errors.length > 0 && (
                <ul className="mt-2 text-sm text-yellow-700 space-y-1">
                  {saveResult.stats.errors.slice(0, 5).map((err, idx) => (
                    <li key={idx} className="truncate">{err}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Show validation warnings if any */}
          {saveResult.validationIssues && saveResult.validationIssues.length > 0 && (
            <div className="mb-6 p-4 rounded-lg border bg-orange-50 border-orange-200 text-left">
              <p className="text-orange-800 font-medium">
                คำเตือน: พบ {saveResult.validationIssues.length} รายการที่ไม่มียอดเงิน
              </p>
              <ul className="mt-2 text-sm text-orange-700 space-y-1">
                {saveResult.validationIssues.slice(0, 5).map((issue, idx) => (
                  <li key={idx}>
                    รายการ #{issue.index + 1}: {issue.issue}
                  </li>
                ))}
                {saveResult.validationIssues.length > 5 && (
                  <li>...และอีก {saveResult.validationIssues.length - 5} รายการ</li>
                )}
              </ul>
            </div>
          )}
        </>
      )}

      <div className="flex gap-4 justify-center">
        <button
          onClick={handleReset}
          className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          อัปโหลดไฟล์ใหม่
        </button>
        <button
          onClick={() => {
            window.location.href = '/dashboard'
          }}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          ไปที่ Dashboard
        </button>
      </div>
    </div>
  )
}
