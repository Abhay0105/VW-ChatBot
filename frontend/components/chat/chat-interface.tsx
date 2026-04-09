'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { ChatHeader } from './chat-header'
import { ChatMessage } from './chat-message'
import { ChatInput } from './chat-input'
import { ChatEmpty } from './chat-empty'
import { DocumentManager } from './document-manager'
import { ConversationList } from './conversation-list'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  sendChatMessage,
  uploadDocument,
  listDocuments,
  deleteDocument,
  clearConversation,
  getConversation,
  type ChatMessage as ChatMessageType,
  type ChatSource,
  type Document,
} from '@/lib/api'

interface Message extends ChatMessageType {
  id: string
  sources?: ChatSource[]
}

const CONVERSATION_ID_KEY = 'whizzy_conversation_id'
const SIDEBAR_WIDTH_KEY = 'whizzy_sidebar_width'
const MOBILE_BREAKPOINT = 768
const DEFAULT_SIDEBAR_WIDTH = 320
const MIN_SIDEBAR_WIDTH = 260
const MAX_SIDEBAR_WIDTH = 420

function clampSidebarWidth(width: number) {
  return Math.min(Math.max(width, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH)
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(false)
  const [useRag, setUseRag] = useState(true)
  const [documents, setDocuments] = useState<Document[]>([])
  const [isDocumentsOpen, setIsDocumentsOpen] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isLoadingConversation, setIsLoadingConversation] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH)
  const [isResizingSidebar, setIsResizingSidebar] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const loadDocuments = useCallback(async () => {
    try {
      const response = await listDocuments()
      setDocuments(response.documents)
    } catch (error) {
      console.error('Failed to load documents:', error)
    }
  }, [])

  const loadConversation = useCallback(async (convId: string) => {
    setIsLoadingConversation(true)
    try {
      const response = await getConversation(convId)
      if (response.messages && response.messages.length > 0) {
        setMessages(
          response.messages.map((msg, index) => ({
            id: `${msg.role}-${index}-${Date.now()}`,
            role: msg.role,
            content: msg.content,
            sources: msg.sources,
          }))
        )
        setConversationId(convId)
      } else {
        setConversationId(convId)
        setMessages([])
      }
    } catch (error) {
      console.error('Failed to load conversation:', error)
      localStorage.removeItem(CONVERSATION_ID_KEY)
    } finally {
      setIsLoadingConversation(false)
    }
  }, [])

  useEffect(() => {
    const savedConversationId = localStorage.getItem(CONVERSATION_ID_KEY)
    if (savedConversationId) {
      loadConversation(savedConversationId)
    }

    const savedSidebarWidth = localStorage.getItem(SIDEBAR_WIDTH_KEY)
    if (savedSidebarWidth) {
      const parsedWidth = Number(savedSidebarWidth)
      if (!Number.isNaN(parsedWidth)) {
        setSidebarWidth(clampSidebarWidth(parsedWidth))
      }
    }

    loadDocuments()

    const mediaQuery = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const handleViewportChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }

    handleViewportChange()
    mediaQuery.addEventListener('change', handleViewportChange)

    return () => mediaQuery.removeEventListener('change', handleViewportChange)
  }, [loadConversation, loadDocuments])

  useEffect(() => {
    if (conversationId) {
      localStorage.setItem(CONVERSATION_ID_KEY, conversationId)
    }
  }, [conversationId])

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth))
  }, [sidebarWidth])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false)
      setIsResizingSidebar(false)
    }
  }, [isMobile])

  useEffect(() => {
    if (!isResizingSidebar || isMobile || !isSidebarOpen) {
      return
    }

    const handlePointerMove = (event: PointerEvent) => {
      setSidebarWidth(clampSidebarWidth(event.clientX))
    }

    const stopResizing = () => {
      setIsResizingSidebar(false)
    }

    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'col-resize'

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', stopResizing)

    return () => {
      document.body.style.userSelect = ''
      document.body.style.cursor = ''
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', stopResizing)
    }
  }, [isMobile, isResizingSidebar, isSidebarOpen])

  const handleSelectConversation = useCallback((convId: string) => {
    if (convId !== conversationId) {
      loadConversation(convId)
    }

    if (isMobile) {
      setIsSidebarOpen(false)
    }
  }, [conversationId, isMobile, loadConversation])

  const handleNewConversation = useCallback(() => {
    setMessages([])
    setConversationId(undefined)
    localStorage.removeItem(CONVERSATION_ID_KEY)

    if (isMobile) {
      setIsSidebarOpen(false)
    }
  }, [isMobile])

  const handleSendMessage = useCallback(async (content: string) => {
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
    }

    setMessages((prev) => [...prev, userMessage])
    setIsLoading(true)

    const assistantId = `assistant-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      {
        id: assistantId,
        role: 'assistant',
        content: '',
      },
    ])

    try {
      const response = await sendChatMessage(content, conversationId, useRag)

      setConversationId(response.conversation_id)

      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantId
            ? {
                ...message,
                content: response.response,
                sources: response.sources,
              }
            : message
        )
      )
    } catch (error) {
      toast.error('Failed to send message', {
        description: error instanceof Error ? error.message : 'Please try again',
      })
      setMessages((prev) => prev.filter((message) => message.id !== assistantId))
    } finally {
      setIsLoading(false)
    }
  }, [conversationId, useRag])

  const handleClearChat = useCallback(async () => {
    if (conversationId) {
      try {
        await clearConversation(conversationId)
        toast.success('Conversation cleared')
      } catch (error) {
        console.error('Failed to clear conversation:', error)
      }
    }

    setMessages([])
    setConversationId(undefined)
    localStorage.removeItem(CONVERSATION_ID_KEY)
  }, [conversationId])

  const handleUploadDocument = useCallback(async (file: File) => {
    const response = await uploadDocument(file)
    toast.success(`Uploaded ${response.filename}`, {
      description: `${response.chunks_created} chunks created`,
    })
    await loadDocuments()
  }, [loadDocuments])

  const handleDeleteDocument = useCallback(async (docId: string) => {
    await deleteDocument(docId)
    toast.success('Document deleted')
    await loadDocuments()
  }, [loadDocuments])

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion)
  }

  const handleSidebarResizeStart = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    event.preventDefault()
    setIsResizingSidebar(true)
  }, [])

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] overflow-hidden bg-background">
      <ConversationList
        open={isSidebarOpen}
        onOpenChange={setIsSidebarOpen}
        currentConversationId={conversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
        isMobile={isMobile}
        width={sidebarWidth}
        onStartResize={handleSidebarResizeStart}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <ChatHeader
          documentCount={documents.length}
          onOpenDocuments={() => setIsDocumentsOpen(true)}
          onClearChat={handleClearChat}
          conversationId={conversationId}
          showSidebarToggle={isMobile}
          onOpenSidebar={() => setIsSidebarOpen(true)}
        />

        <div className="flex-1 overflow-hidden">
          {isLoadingConversation ? (
            <div className="flex h-full items-center justify-center px-4">
              <div className="flex flex-col items-center gap-3 text-center">
                <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">Loading conversation...</p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <ScrollArea className="h-full">
              <div className="mx-auto flex min-h-full w-full max-w-4xl">
                <ChatEmpty
                  onOpenDocuments={() => setIsDocumentsOpen(true)}
                  onSuggestionClick={handleSuggestionClick}
                />
              </div>
            </ScrollArea>
          ) : (
            <ScrollArea className="h-full" ref={scrollRef}>
              <div className="mx-auto w-full max-w-3xl pb-4">
                {messages.map((message) => (
                  <ChatMessage
                    key={message.id}
                    role={message.role as 'user' | 'assistant'}
                    content={message.content}
                    sources={message.sources}
                    isStreaming={isLoading && message.role === 'assistant' && !message.content}
                  />
                ))}
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          )}
        </div>

        <ChatInput
          onSend={handleSendMessage}
          onFileUpload={() => setIsDocumentsOpen(true)}
          isLoading={isLoading}
          useRag={useRag}
          onToggleRag={setUseRag}
        />

        <DocumentManager
          open={isDocumentsOpen}
          onOpenChange={setIsDocumentsOpen}
          documents={documents}
          onUpload={handleUploadDocument}
          onDelete={handleDeleteDocument}
        />
      </div>
    </div>
  )
}
