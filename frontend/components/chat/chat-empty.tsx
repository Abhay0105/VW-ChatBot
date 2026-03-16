'use client'

import { Bot, FileText, MessageSquare, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ChatEmptyProps {
  onOpenDocuments: () => void
  onSuggestionClick: (suggestion: string) => void
}

const suggestions = [
  'What information do you have about my uploaded documents?',
  'Summarize the key points from my knowledge base.',
  'Help me understand a complex topic from my files.',
  'What questions can I ask about my documents?',
]

export function ChatEmpty({ onOpenDocuments, onSuggestionClick }: ChatEmptyProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
      <div className="mb-6 flex size-16 items-center justify-center rounded-2xl bg-primary/10">
        <Bot className="size-8 text-primary" />
      </div>

      <h2 className="mb-2 text-2xl font-semibold text-balance">
        Welcome to Whizzy
      </h2>
      <p className="mb-8 max-w-md text-muted-foreground text-balance">
        Upload documents to build your knowledge base, then ask questions to get 
        context-aware responses powered by retrieval-augmented generation.
      </p>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 max-w-2xl">
        <div className="flex items-start gap-3 rounded-lg border bg-card p-4 text-left">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <FileText className="size-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium">Upload Documents</h3>
            <p className="text-sm text-muted-foreground">
              Add text files to your knowledge base for context-aware responses.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-lg border bg-card p-4 text-left">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="size-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium">RAG-Enhanced Answers</h3>
            <p className="text-sm text-muted-foreground">
              Get accurate responses grounded in your documents.
            </p>
          </div>
        </div>
      </div>

      <div className="w-full max-w-2xl">
        <p className="mb-3 text-sm font-medium text-muted-foreground">
          Try asking:
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {suggestions.map((suggestion, index) => (
            <Button
              key={index}
              variant="outline"
              className="h-auto justify-start whitespace-normal py-3 px-4 text-left text-sm"
              onClick={() => onSuggestionClick(suggestion)}
            >
              <MessageSquare className="mr-2 size-4 shrink-0" />
              <span className="line-clamp-2">{suggestion}</span>
            </Button>
          ))}
        </div>
      </div>

      <Button
        variant="default"
        className="mt-8"
        onClick={onOpenDocuments}
      >
        <FileText className="mr-2 size-4" />
        Upload Your First Document
      </Button>
    </div>
  )
}
