'use client'

import { useState, useEffect, useCallback } from 'react'
import { format, differenceInMinutes, differenceInHours, differenceInDays, isToday, isYesterday } from 'date-fns'
import { MessageSquare, Plus, Trash2, ChevronLeft, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  listConversations,
  clearConversation,
  type Conversation,
} from '@/lib/api'

interface ConversationListProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentConversationId?: string
  onSelectConversation: (conversationId: string) => void
  onNewConversation: () => void
  isMobile: boolean
  width: number
  onStartResize: (event: React.PointerEvent<HTMLButtonElement>) => void
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()

  const minutesAgo = differenceInMinutes(now, date)
  const hoursAgo = differenceInHours(now, date)
  const daysAgo = differenceInDays(now, date)

  if (minutesAgo < 1) {
    return 'Just now'
  }

  if (minutesAgo < 60) {
    return `${minutesAgo} ${minutesAgo === 1 ? 'minute' : 'minutes'} ago`
  }

  if (hoursAgo < 24 && isToday(date)) {
    return `${hoursAgo} ${hoursAgo === 1 ? 'hour' : 'hours'} ago`
  }

  if (isYesterday(date)) {
    return `Yesterday at ${format(date, 'h:mm a')}`
  }

  if (daysAgo < 7) {
    return format(date, 'EEEE')
  }

  if (daysAgo < 365) {
    return format(date, 'MMM d')
  }

  return format(date, 'MMM d, yyyy')
}

export function ConversationList({
  open,
  onOpenChange,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  isMobile,
  width,
  onStartResize,
}: ConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [, setTick] = useState(0)

  const loadConversations = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await listConversations()
      setConversations(response.conversations)
    } catch (error) {
      console.error('Failed to load conversations:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      loadConversations()
    }
  }, [open, loadConversations])

  useEffect(() => {
    if (!open || conversations.length === 0) return

    const interval = setInterval(() => {
      setTick((tick) => tick + 1)
    }, 60000)

    return () => clearInterval(interval)
  }, [open, conversations.length])

  const handleDelete = async (e: React.MouseEvent, conversationId: string) => {
    e.stopPropagation()
    try {
      await clearConversation(conversationId)
      setConversations((prev) => prev.filter((conversation) => conversation.id !== conversationId))
      if (currentConversationId === conversationId) {
        onNewConversation()
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error)
    }
  }

  const sidebarContent = (
    <>
      <div className="flex items-center justify-between border-b px-3 py-3">
        <h2 className="text-sm font-semibold">Chat History</h2>
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onNewConversation}
              >
                <Plus className="size-4" />
                <span className="sr-only">New chat</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>New chat</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => onOpenChange(false)}
              >
                <ChevronLeft className="size-4" />
                <span className="sr-only">Collapse</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Collapse sidebar</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1 p-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="size-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <MessageSquare className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No conversations yet</p>
              <Button
                variant="outline"
                size="sm"
                onClick={onNewConversation}
                className="mt-2"
              >
                <Plus className="mr-2 size-4" />
                Start a chat
              </Button>
            </div>
          ) : (
            conversations.map((conversation) => (
              <div
                key={conversation.id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectConversation(conversation.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelectConversation(conversation.id)
                  }
                }}
                className={cn(
                  'group flex w-full cursor-pointer flex-col items-start gap-1 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  currentConversationId === conversation.id && 'bg-accent'
                )}
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">
                    {conversation.title || 'New Conversation'}
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-6 opacity-0 transition-opacity group-hover:opacity-100"
                        onClick={(e) => handleDelete(e, conversation.id)}
                      >
                        <Trash2 className="size-3" />
                        <span className="sr-only">Delete</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete conversation</TooltipContent>
                  </Tooltip>
                </div>
                <div className="flex w-full flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                  <span className="max-w-full truncate">
                    {conversation.last_message || 'No messages'}
                  </span>
                  <span className="shrink-0">
                    {formatRelativeTime(conversation.updated_at)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </>
  )

  if (isMobile) {
    if (!open) {
      return null
    }

    return (
      <>
        <button
          type="button"
          aria-label="Close chat history"
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => onOpenChange(false)}
        />
        <aside className="fixed inset-y-0 left-0 z-50 flex h-[100dvh] w-[85vw] max-w-sm flex-col border-r bg-background shadow-xl md:hidden">
          {sidebarContent}
        </aside>
      </>
    )
  }

  if (!open) {
    return (
      <div className="hidden h-full w-14 flex-col items-center border-r bg-muted/30 py-3 md:flex">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(true)}
              className="mb-2"
            >
              <History className="size-5" />
              <span className="sr-only">Open history</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Chat history</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={onNewConversation}
            >
              <Plus className="size-5" />
              <span className="sr-only">New chat</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">New chat</TooltipContent>
        </Tooltip>
      </div>
    )
  }

  return (
    <aside
      className="relative hidden h-full shrink-0 md:flex"
      style={{ width }}
    >
      <div className="flex h-full w-full min-w-0 flex-col border-r bg-muted/30">
        {sidebarContent}
      </div>
      <button
        type="button"
        aria-label="Resize chat history sidebar"
        onPointerDown={onStartResize}
        className="group absolute inset-y-0 -right-2 z-10 hidden w-4 cursor-col-resize md:flex"
      >
        <span className="mx-auto h-16 w-1 rounded-full bg-border transition-colors group-hover:bg-primary/40" />
      </button>
    </aside>
  )
}
