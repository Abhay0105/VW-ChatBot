/**
 * API client for communicating with the Python FastAPI backend
 */

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  sources?: ChatSource[]
}

export interface ChatSource {
  document: string
  excerpt: string
  relevance: number
}

export interface ChatResponse {
  response: string
  conversation_id: string
  sources: ChatSource[]
}

export interface Document {
  id: string
  filename: string
  uploaded_at: string
  chunk_count: number
  total_characters: number
}

export interface UploadResponse {
  success: boolean
  document_id: string
  filename: string
  chunks_created: number
  total_characters: number
}

export interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
  last_message?: string
  message_count: number
}

export interface ConversationDetail {
  conversation_id: string
  title?: string
  created_at?: string
  updated_at?: string
  messages: ChatMessage[]
}

// Use environment variable for API URL in production, fallback to /api for local dev
const API_BASE = process.env.NEXT_PUBLIC_API_URL 
  ? `https://${process.env.NEXT_PUBLIC_API_URL}` 
  : '/api'

  // const API_BASE = '/api'

export async function sendChatMessage(
  message: string,
  conversationId?: string,
  useRag: boolean = true
): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
      use_rag: useRag,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Chat request failed: ${error}`)
  }

  return response.json()
}

export async function streamChatMessage(
  message: string,
  conversationId?: string,
  useRag: boolean = true,
  onChunk: (chunk: string) => void = () => {},
  onSources: (sources: ChatSource[]) => void = () => {},
  onMetadata: (metadata: { conversation_id: string }) => void = () => {}
): Promise<void> {
  const response = await fetch(`${API_BASE}/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      conversation_id: conversationId,
      use_rag: useRag,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Chat stream failed: ${error}`)
  }

  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('No response body')
  }

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.slice(6))
          if (data.type === 'content') {
            onChunk(data.content)
          } else if (data.type === 'sources') {
            onSources(data.sources)
          } else if (data.type === 'metadata') {
            onMetadata({ conversation_id: data.conversation_id })
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }
  }
}

export async function uploadDocument(file: File): Promise<UploadResponse> {
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${API_BASE}/documents/upload`, {
    method: 'POST',
    body: formData,
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Upload failed: ${error}`)
  }

  return response.json()
}

export async function listDocuments(): Promise<{ documents: Document[]; total: number }> {
  const response = await fetch(`${API_BASE}/documents`)

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to list documents: ${error}`)
  }

  return response.json()
}

export async function deleteDocument(docId: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/documents/${docId}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to delete document: ${error}`)
  }

  return response.json()
}

export async function getConversation(conversationId: string): Promise<ConversationDetail> {
  const response = await fetch(`${API_BASE}/conversations/${conversationId}`)

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get conversation: ${error}`)
  }

  return response.json()
}

export async function listConversations(limit: number = 50, offset: number = 0): Promise<{
  conversations: Conversation[]
  total: number
}> {
  const response = await fetch(`${API_BASE}/conversations?limit=${limit}&offset=${offset}`)

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to list conversations: ${error}`)
  }

  return response.json()
}

export async function createConversation(title?: string): Promise<{
  success: boolean
  conversation: { id: string; title?: string; created_at: string }
}> {
  const response = await fetch(`${API_BASE}/conversations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title }),
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to create conversation: ${error}`)
  }

  return response.json()
}

export async function clearConversation(conversationId: string): Promise<{ success: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/conversations/${conversationId}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to clear conversation: ${error}`)
  }

  return response.json()
}

export async function checkHealth(): Promise<{ status: string; service: string }> {
  const response = await fetch(`${API_BASE}/health`)

  if (!response.ok) {
    throw new Error('Backend health check failed')
  }

  return response.json()
}
