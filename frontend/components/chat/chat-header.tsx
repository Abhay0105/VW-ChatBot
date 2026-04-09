'use client'

import { Bot, FileText, Moon, Sun, Trash2, History } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface ChatHeaderProps {
  documentCount: number
  onOpenDocuments: () => void
  onClearChat: () => void
  conversationId?: string
  showSidebarToggle?: boolean
  onOpenSidebar?: () => void
}

export function ChatHeader({
  documentCount,
  onOpenDocuments,
  onClearChat,
  conversationId,
  showSidebarToggle,
  onOpenSidebar,
}: ChatHeaderProps) {
  const { theme, setTheme } = useTheme()

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-background px-3 py-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-3">
        {showSidebarToggle && onOpenSidebar && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="md:hidden"
                onClick={onOpenSidebar}
              >
                <History className="size-4" />
                <span className="sr-only">Open chat history</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Chat history</TooltipContent>
          </Tooltip>
        )}
        <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Bot className="size-5" />
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold">Whizzy</h1>
          <p className="truncate text-xs text-muted-foreground">
            AI-powered knowledge assistant
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 px-3"
              onClick={onOpenDocuments}
            >
              <FileText className="size-4" />
              <span className="hidden sm:inline">Documents</span>
              {documentCount > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {documentCount}
                </Badge>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Manage knowledge base</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="hidden h-6 sm:block" />

        {conversationId && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onClearChat}
              >
                <Trash2 className="size-4" />
                <span className="sr-only">Clear chat</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Clear conversation</TooltipContent>
          </Tooltip>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Toggle theme</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle theme</TooltipContent>
        </Tooltip>
      </div>
    </header>
  )
}
