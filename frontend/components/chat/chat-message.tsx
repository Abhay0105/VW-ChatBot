'use client'

import { Bot, User } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import type { ChatSource } from '@/lib/api'

interface ChatMessageProps {
  role: 'user' | 'assistant'
  content: string
  sources?: ChatSource[]
  isStreaming?: boolean
}

export function ChatMessage({ role, content, sources, isStreaming }: ChatMessageProps) {
  const isUser = role === 'user'

  return (
    <div
      className={cn(
        'flex gap-4 px-4 py-6',
        isUser ? 'bg-background' : 'bg-muted/30'
      )}
    >
      <div
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-lg',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
        )}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>

      <div className="flex-1 space-y-3 overflow-hidden">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {isUser ? 'You' : 'Whizzy'}
          </span>
          {isStreaming && (
            <Badge variant="secondary" className="text-xs">
              Thinking...
            </Badge>
          )}
        </div>

        <div className="prose-chat">
          {isUser ? (
            <p className="whitespace-pre-wrap">{content}</p>
          ) : (
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                code: ({ className, children, ...props }) => {
                  const isInline = !className
                  return isInline ? (
                    <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                      {children}
                    </code>
                  ) : (
                    <code className={className} {...props}>
                      {children}
                    </code>
                  )
                },
                pre: ({ children }) => (
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto my-3 text-sm">
                    {children}
                  </pre>
                ),
                ul: ({ children }) => <ul className="list-disc pl-6 mb-3">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-6 mb-3">{children}</ol>,
                li: ({ children }) => <li className="mb-1">{children}</li>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-primary/30 pl-4 italic my-3">
                    {children}
                  </blockquote>
                ),
                h1: ({ children }) => <h1 className="text-xl font-semibold mt-4 mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-lg font-semibold mt-4 mb-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-base font-semibold mt-4 mb-2">{children}</h3>,
                a: ({ href, children }) => (
                  <a href={href} className="text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
              }}
            >
              {content || (isStreaming ? '...' : '')}
            </ReactMarkdown>
          )}
        </div>

        {sources && sources.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Sources:</p>
            <div className="flex flex-wrap gap-2">
              {sources.map((source, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {source.document}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
