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

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [conversationId, setConversationId] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(false)
  const [useRag, setUseRag] = useState(true)
  const [documents, setDocuments] = useState<Document[]>([])
  const [isDocumentsOpen, setIsDocumentsOpen] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isLoadingConversation, setIsLoadingConversation] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load saved conversation ID from localStorage on mount
  useEffect(() => {
    const savedConversationId = localStorage.getItem(CONVERSATION_ID_KEY)
    if (savedConversationId) {
      loadConversation(savedConversationId)
    }
    loadDocuments()
  }, [])

  // Save conversation ID to localStorage when it changes
  useEffect(() => {
    if (conversationId) {
      localStorage.setItem(CONVERSATION_ID_KEY, conversationId)
    }
  }, [conversationId])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadDocuments = async () => {
    try {
      const response = await listDocuments()
      setDocuments(response.documents)
    } catch (error) {
      console.error('Failed to load documents:', error)
    }
  }

  const loadConversation = async (convId: string) => {
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
        // Conversation exists but is empty, start fresh
        setConversationId(convId)
        setMessages([])
      }
    } catch (error) {
      console.error('Failed to load conversation:', error)
      // If conversation doesn't exist, clear the saved ID
      localStorage.removeItem(CONVERSATION_ID_KEY)
    } finally {
      setIsLoadingConversation(false)
    }
  }

  const handleSelectConversation = useCallback((convId: string) => {
    if (convId !== conversationId) {
      loadConversation(convId)
    }
  }, [conversationId])

  const handleNewConversation = useCallback(() => {
    setMessages([])
    setConversationId(undefined)
    localStorage.removeItem(CONVERSATION_ID_KEY)
  }, [])

  const handleSendMessage = useCallback(async (content: string) => {
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content,
    }

    setMessages(prev => [...prev, userMessage])
    setIsLoading(true)

    // Add placeholder for assistant message
    const assistantId = `assistant-${Date.now()}`
    setMessages(prev => [
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
      
      // Update the assistant message with the response
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantId
            ? {
                ...msg,
                content: response.response,
                sources: response.sources,
              }
            : msg
        )
      )
    } catch (error) {
      toast.error('Failed to send message', {
        description: error instanceof Error ? error.message : 'Please try again',
      })
      // Remove the placeholder message on error
      setMessages(prev => prev.filter(msg => msg.id !== assistantId))
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
  }, [])

  const handleDeleteDocument = useCallback(async (docId: string) => {
    await deleteDocument(docId)
    toast.success('Document deleted')
    await loadDocuments()
  }, [])

  const handleSuggestionClick = (suggestion: string) => {
    handleSendMessage(suggestion)
  }

  return (
    <div className="flex h-screen bg-background">
      <ConversationList
        open={isSidebarOpen}
        onOpenChange={setIsSidebarOpen}
        currentConversationId={conversationId}
        onSelectConversation={handleSelectConversation}
        onNewConversation={handleNewConversation}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <ChatHeader
          documentCount={documents.length}
          onOpenDocuments={() => setIsDocumentsOpen(true)}
          onClearChat={handleClearChat}
          conversationId={conversationId}
        />

        <div className="flex-1 overflow-hidden">
          {isLoadingConversation ? (
            <div className="flex h-full items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm text-muted-foreground">Loading conversation...</p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <ChatEmpty
              onOpenDocuments={() => setIsDocumentsOpen(true)}
              onSuggestionClick={handleSuggestionClick}
            />
          ) : (
            <ScrollArea className="h-full" ref={scrollRef}>
              <div className="mx-auto max-w-3xl">
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
