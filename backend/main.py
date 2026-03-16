"""
RAG-Powered AI Chatbot Backend
FastAPI backend with Retrieval-Augmented Generation (RAG) capabilities
Now with SQLite persistence for documents and conversations.
"""

import os
import json
import hashlib
from typing import Optional
from datetime import datetime
from contextlib import asynccontextmanager
from config import GROQ_API_KEY

import fastapi
import fastapi.middleware.cors

# Get allowed origins from environment (for Render deployment)
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "").split(",")
if ALLOWED_ORIGINS == [""]:
    ALLOWED_ORIGINS = ["*"]  # Default to allow all for local development
else:
    # Add https:// prefix if not present
    ALLOWED_ORIGINS = [f"https://{o}" if not o.startswith("http") else o for o in ALLOWED_ORIGINS]
from fastapi import UploadFile, File, Form, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import httpx

from database import init_db
from models import (
    create_document,
    get_document,
    list_documents as db_list_documents,
    delete_document as db_delete_document,
    search_chunks,
    create_conversation,
    get_conversation,
    list_conversations as db_list_conversations,
    delete_conversation as db_delete_conversation,
    add_message,
    get_messages,
)


@asynccontextmanager
async def lifespan(app: fastapi.FastAPI):
    """Initialize database on startup."""
    await init_db()
    yield


app = fastapi.FastAPI(title="RAG Chatbot API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    fastapi.middleware.cors.CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Message(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    use_rag: bool = True


class ChatResponse(BaseModel):
    response: str
    conversation_id: str
    sources: list[dict] = []


class DocumentChunk(BaseModel):
    id: str
    content: str
    metadata: dict
    relevance_score: float = 0.0


class ConversationCreate(BaseModel):
    title: Optional[str] = None


def build_rag_context(chunks: list[dict]) -> str:
    """Build context string from retrieved chunks."""
    if not chunks:
        return ""
    
    context_parts = ["Relevant context from uploaded documents:\n"]
    for i, chunk in enumerate(chunks, 1):
        context_parts.append(f"[Source {i}: {chunk.get('document', 'Unknown')}]\n{chunk['content']}\n")
    
    return "\n".join(context_parts)


async def call_ai_gateway(messages: list[dict], stream: bool = False):
    """Call Groq API for LLM inference (free tier: 14,400 requests/day)."""
    api_key = GROQ_API_KEY
    
    if not api_key:
        raise HTTPException(
            status_code=500, 
            detail="GROQ_API_KEY not set. Get your free key at https://console.groq.com"
        )
    
    url = "https://api.groq.com/openai/v1/chat/completions"
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}"
    }
    
    payload = {
        "model": "llama-3.1-8b-instant",
        "messages": messages,
        "max_tokens": 2048,
        "temperature": 0.7,
        "stream": stream
    }
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        if stream:
            async with client.stream("POST", url, headers=headers, json=payload) as response:
                if response.status_code != 200:
                    error_text = await response.aread()
                    raise HTTPException(status_code=response.status_code, detail=f"AI Gateway error: {error_text.decode()}")
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = line[6:]
                        if data.strip() == "[DONE]":
                            break
                        yield data
        else:
            response = await client.post(url, headers=headers, json=payload)
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=f"AI Gateway error: {response.text}")
            result = response.json()
            yield result["choices"][0]["message"]["content"]


@app.get("/health")
async def health() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "ok", "service": "rag-chatbot-backend", "version": "2.0.0"}


@app.post("/chat")
async def chat(request: ChatRequest) -> ChatResponse:
    """Main chat endpoint with optional RAG enhancement and persistent storage."""
    conversation_id = request.conversation_id or hashlib.md5(
        f"{datetime.now().isoformat()}".encode()
    ).hexdigest()[:12]
    
    # Build messages for the LLM
    messages = []
    
    system_prompt = """You are a helpful AI assistant with access to a knowledge base of uploaded documents. 
When relevant context is provided, use it to give accurate, well-sourced answers.
Always be helpful, clear, and concise. If the context doesn't contain relevant information, 
say so and provide the best answer you can based on your general knowledge."""
    
    # Retrieve relevant context if RAG is enabled
    sources = []
    if request.use_rag:
        relevant_chunks = await search_chunks(request.message)
        if relevant_chunks:
            rag_context = build_rag_context(relevant_chunks)
            system_prompt += f"\n\n{rag_context}"
            sources = [
                {
                    "document": chunk.get("document", "Unknown"),
                    "excerpt": chunk["content"][:200] + "..." if len(chunk["content"]) > 200 else chunk["content"],
                    "relevance": round(chunk["relevance_score"], 3)
                }
                for chunk in relevant_chunks
            ]
    
    messages.append({"role": "system", "content": system_prompt})
    
    # Load conversation history from database (last 10 messages)
    history = await get_messages(conversation_id, limit=10, order="desc")
    for msg in history:
        messages.append({"role": msg["role"], "content": msg["content"]})
    
    # Add current message
    messages.append({"role": "user", "content": request.message})
    
    # Get AI response
    response_text = ""
    async for chunk in call_ai_gateway(messages, stream=False):
        response_text = chunk
        break
    
    # Save messages to database
    await add_message(conversation_id, "user", request.message)
    await add_message(conversation_id, "assistant", response_text, sources=sources)
    
    return ChatResponse(
        response=response_text,
        conversation_id=conversation_id,
        sources=sources
    )


@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """Streaming chat endpoint for real-time responses with persistence."""
    conversation_id = request.conversation_id or hashlib.md5(
        f"{datetime.now().isoformat()}".encode()
    ).hexdigest()[:12]
    
    messages = []
    system_prompt = """You are a helpful AI assistant with access to a knowledge base of uploaded documents. 
When relevant context is provided, use it to give accurate, well-sourced answers.
Always be helpful, clear, and concise."""
    
    sources = []
    if request.use_rag:
        relevant_chunks = await search_chunks(request.message)
        if relevant_chunks:
            rag_context = build_rag_context(relevant_chunks)
            system_prompt += f"\n\n{rag_context}"
            sources = [{"document": c.get("document"), "relevance": c["relevance_score"]} for c in relevant_chunks]
    
    messages.append({"role": "system", "content": system_prompt})
    
    # Load conversation history from database
    history = await get_messages(conversation_id, limit=10, order="desc")
    for msg in history:
        messages.append({"role": msg["role"], "content": msg["content"]})
    
    messages.append({"role": "user", "content": request.message})
    
    # Save user message immediately
    await add_message(conversation_id, "user", request.message)
    
    async def generate():
        full_response = ""
        if sources:
            yield f"data: {json.dumps({'type': 'sources', 'sources': sources})}\n\n"
        
        yield f"data: {json.dumps({'type': 'metadata', 'conversation_id': conversation_id})}\n\n"
        
        async for chunk in call_ai_gateway(messages, stream=True):
            try:
                data = json.loads(chunk)
                if "choices" in data and data["choices"]:
                    delta = data["choices"][0].get("delta", {})
                    content = delta.get("content", "")
                    if content:
                        full_response += content
                        yield f"data: {json.dumps({'type': 'content', 'content': content})}\n\n"
            except json.JSONDecodeError:
                continue
        
        # Save assistant response to database
        await add_message(conversation_id, "assistant", full_response, sources=sources)
        
        yield f"data: {json.dumps({'type': 'done'})}\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")


# ==================== Document Endpoints ====================

@app.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    chunk_size: int = Form(default=500),
    overlap: int = Form(default=50)
) -> dict:
    """Upload a document to the knowledge base with persistent storage."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
    
    content = await file.read()
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=400, detail="Could not decode file. Please upload a text file.")
    
    result = await create_document(
        filename=file.filename,
        content=text,
        chunk_size=chunk_size,
        overlap=overlap
    )
    
    return {
        "success": True,
        "document_id": result["id"],
        "filename": result["filename"],
        "chunks_created": result["chunk_count"],
        "total_characters": result["total_characters"]
    }


@app.get("/documents")
async def list_documents() -> dict:
    """List all documents in the knowledge base."""
    documents = await db_list_documents()
    return {"documents": documents, "total": len(documents)}


@app.get("/documents/{doc_id}")
async def get_document_details(doc_id: str) -> dict:
    """Get details of a specific document."""
    doc = await get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@app.delete("/documents/{doc_id}")
async def delete_document(doc_id: str) -> dict:
    """Delete a document from the knowledge base."""
    doc = await get_document(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    
    filename = doc["filename"]
    await db_delete_document(doc_id)
    
    return {"success": True, "message": f"Document '{filename}' deleted"}


# ==================== Conversation Endpoints ====================

@app.get("/conversations")
async def list_conversations(
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0)
) -> dict:
    """List all conversations with pagination."""
    conversations = await db_list_conversations(limit=limit, offset=offset)
    return {"conversations": conversations, "total": len(conversations)}


@app.post("/conversations")
async def create_new_conversation(data: ConversationCreate) -> dict:
    """Create a new conversation."""
    result = await create_conversation(title=data.title)
    return {"success": True, "conversation": result}


@app.get("/conversations/{conversation_id}")
async def get_conversation_details(conversation_id: str) -> dict:
    """Get conversation with all messages."""
    conv = await get_conversation(conversation_id)
    if not conv:
        return {"messages": [], "conversation_id": conversation_id}
    
    return {
        "conversation_id": conv["id"],
        "title": conv["title"],
        "created_at": conv["created_at"],
        "updated_at": conv["updated_at"],
        "messages": [
            {"role": msg["role"], "content": msg["content"], "sources": msg.get("sources", [])}
            for msg in conv["messages"]
        ],
    }


@app.get("/conversations/{conversation_id}/messages")
async def get_conversation_messages(
    conversation_id: str,
    limit: int = Query(default=50, le=100),
    offset: int = Query(default=0, ge=0)
) -> dict:
    """Get paginated messages from a conversation."""
    messages = await get_messages(conversation_id, limit=limit, offset=offset)
    return {"messages": messages, "conversation_id": conversation_id}


@app.delete("/conversations/{conversation_id}")
async def clear_conversation(conversation_id: str) -> dict:
    """Delete a conversation and all its messages."""
    await db_delete_conversation(conversation_id)
    return {"success": True, "message": "Conversation deleted"}
