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
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
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
    <div className="border-t bg-background p-4">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Switch
              id="rag-toggle"
              checked={useRag}
              onCheckedChange={onToggleRag}
            />
            <label
              htmlFor="rag-toggle"
              className="text-sm text-muted-foreground cursor-pointer flex items-center gap-1.5"
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
              <span className="text-xs text-muted-foreground cursor-help">
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

        <div className="relative flex items-end gap-2 rounded-xl border bg-background p-2 shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
          {onFileUpload && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0"
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
              'flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none',
              'placeholder:text-muted-foreground',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'min-h-36 max-h-200'
            )}
          />

          <Button
            type="button"
            size="icon-sm"
            className="shrink-0"
            onClick={handleSubmit}
            disabled={!message.trim() || isLoading}
          >
            <Send className="size-4" />
            <span className="sr-only">Send message</span>
          </Button>
        </div>

        <p className="mt-2 text-center text-xs text-muted-foreground">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  )
}
