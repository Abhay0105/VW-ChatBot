'use client'

import { useState, useCallback } from 'react'
import { FileText, Trash2, Upload, X, AlertCircle, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Document } from '@/lib/api'
import { cn } from '@/lib/utils'

interface DocumentManagerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  documents: Document[]
  onUpload: (file: File) => Promise<void>
  onDelete: (docId: string) => Promise<void>
  isLoading?: boolean
}

export function DocumentManager({
  open,
  onOpenChange,
  documents,
  onUpload,
  onDelete,
  isLoading,
}: DocumentManagerProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle')
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    const textFile = files.find(f => 
      f.type === 'text/plain' || 
      f.name.endsWith('.txt') || 
      f.name.endsWith('.md') ||
      f.name.endsWith('.csv')
    )

    if (textFile) {
      await handleUpload(textFile)
    } else {
      setUploadError('Please upload a text file (.txt, .md, or .csv)')
      setUploadStatus('error')
    }
  }, [])

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      await handleUpload(file)
    }
    e.target.value = ''
  }, [])

  const handleUpload = async (file: File) => {
    setUploadStatus('uploading')
    setUploadError(null)
    try {
      await onUpload(file)
      setUploadStatus('success')
      setTimeout(() => setUploadStatus('idle'), 2000)
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed')
      setUploadStatus('error')
    }
  }

  const handleDelete = async (docId: string) => {
    setDeletingId(docId)
    try {
      await onDelete(docId)
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatSize = (chars: number) => {
    if (chars < 1000) return `${chars} chars`
    if (chars < 1000000) return `${(chars / 1000).toFixed(1)}K chars`
    return `${(chars / 1000000).toFixed(1)}M chars`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5" />
            Knowledge Base
          </DialogTitle>
          <DialogDescription>
            Upload documents to enhance AI responses with your own content.
            The AI will search these documents to provide context-aware answers.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload Area */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'relative rounded-lg border-2 border-dashed p-8 text-center transition-colors',
              isDragging
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-primary/50',
              uploadStatus === 'uploading' && 'pointer-events-none opacity-50'
            )}
          >
            <input
              type="file"
              accept=".txt,.md,.csv,text/plain,text/markdown,text/csv"
              onChange={handleFileSelect}
              className="absolute inset-0 cursor-pointer opacity-0"
              disabled={uploadStatus === 'uploading'}
            />
            
            {uploadStatus === 'uploading' ? (
              <div className="flex flex-col items-center gap-2">
                <Spinner className="size-8" />
                <p className="text-sm text-muted-foreground">Uploading and processing...</p>
              </div>
            ) : uploadStatus === 'success' ? (
              <div className="flex flex-col items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="size-8" />
                <p className="text-sm font-medium">Upload successful!</p>
              </div>
            ) : uploadStatus === 'error' ? (
              <div className="flex flex-col items-center gap-2 text-destructive">
                <AlertCircle className="size-8" />
                <p className="text-sm font-medium">{uploadError}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setUploadStatus('idle')}
                >
                  Try Again
                </Button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="size-8 text-muted-foreground" />
                <p className="text-sm font-medium">Drop files here or click to upload</p>
                <p className="text-xs text-muted-foreground">
                  Supports .txt, .md, and .csv files
                </p>
              </div>
            )}
          </div>

          {/* Document List */}
          {documents.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">
                  Uploaded Documents ({documents.length})
                </h3>
              </div>
              <ScrollArea className="h-200">
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center gap-3 rounded-lg border bg-card p-3"
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <FileText className="size-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="truncate font-medium text-sm">
                          {doc.filename}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{formatSize(doc.total_characters)}</span>
                          <span>·</span>
                          <span>{doc.chunk_count} chunks</span>
                          <span>·</span>
                          <span>{formatDate(doc.uploaded_at)}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => handleDelete(doc.id)}
                        disabled={deletingId === doc.id}
                      >
                        {deletingId === doc.id ? (
                          <Spinner className="size-4" />
                        ) : (
                          <Trash2 className="size-4 text-destructive" />
                        )}
                        <span className="sr-only">Delete</span>
                      </Button>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No documents uploaded yet. Upload files to build your knowledge base.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
