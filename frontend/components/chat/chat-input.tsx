'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Paperclip, Sparkles, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface ChatInputProps {
  onSend: (message: string) => void
  onFileUpload?: () => void
  isLoading?: boolean
  useRag: boolean
  onToggleRag: (enabled: boolean) => void
  placeholder?: string
}

export function ChatInput({
  onSend,
  onFileUpload,
  isLoading,
  useRag,
  onToggleRag,
  placeholder = 'Ask me anything...',
}: ChatInputProps) {
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [message])

  const handleSubmit = () => {
    if (message.trim() && !isLoading) {
      onSend(message.trim())
      setMessage('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="shrink-0 border-t bg-background px-3 py-2 sm:px-4 sm:py-2.5">
      <div className="mx-auto max-w-4xl">
        <div className="mb-2 flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2.5">
            <Switch
              id="rag-toggle"
              checked={useRag}
              onCheckedChange={onToggleRag}
            />
            <label
              htmlFor="rag-toggle"
              className="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground"
            >
              {useRag ? (
                <>
                  <Sparkles className="size-3.5 text-primary" />
                  RAG Enabled
                </>
              ) : (
                <>
                  <Zap className="size-3.5" />
                  Direct Chat
                </>
              )}
            </label>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <span className="max-w-full cursor-help text-xs text-muted-foreground">
                {useRag ? 'Using uploaded documents for context' : 'Chatting without document context'}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs">
                {useRag
                  ? 'The AI will search your uploaded documents to provide more accurate, context-aware responses.'
                  : 'The AI will respond using only its general knowledge, without searching your documents.'}
              </p>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="relative flex items-center gap-2 rounded-2xl border bg-background px-2 py-1.5 shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
          {onFileUpload && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 self-center"
                  onClick={onFileUpload}
                  disabled={isLoading}
                >
                  <Paperclip className="size-4" />
                  <span className="sr-only">Upload file</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Upload a document</TooltipContent>
            </Tooltip>
          )}

          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isLoading}
            rows={1}
            className={cn(
              'flex-1 resize-none bg-transparent px-2 py-[9px] text-sm leading-5 outline-none',
              'placeholder:text-muted-foreground',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'min-h-[24px] max-h-[120px] overflow-y-auto'
            )}
          />

          <Button
            type="button"
            size="icon-sm"
            className="shrink-0 self-center"
            onClick={handleSubmit}
            disabled={!message.trim() || isLoading}
          >
            <Send className="size-4" />
            <span className="sr-only">Send message</span>
          </Button>
        </div>

        <p className="mt-1.5 text-center text-xs text-muted-foreground">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
