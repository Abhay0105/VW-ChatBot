"""
Document storage and retrieval operations.
"""

import json
import hashlib
from datetime import datetime
from typing import Optional
from database import get_db


def generate_chunk_id(content: str, doc_id: str, index: int) -> str:
    """Generate a unique ID for each chunk."""
    hash_input = f"{doc_id}:{index}:{content[:50]}"
    return hashlib.md5(hash_input.encode()).hexdigest()[:12]


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """Split text into overlapping chunks for better retrieval."""
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        if chunk.strip():
            chunks.append(chunk.strip())
        start = end - overlap
    return chunks


async def create_document(
    filename: str,
    content: str,
    chunk_size: int = 500,
    overlap: int = 50,
    metadata: Optional[dict] = None
) -> dict:
    """
    Create a document with its chunks in the database.
    Returns document info with ID and chunk count.
    """
    doc_id = hashlib.md5(f"{filename}:{datetime.now().isoformat()}".encode()).hexdigest()[:12]
    chunks = chunk_text(content, chunk_size=chunk_size, overlap=overlap)
    
    db = await get_db()
    try:
        # Insert document
        await db.execute(
            """
            INSERT INTO documents (id, filename, original_content, total_characters, chunk_count, metadata)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (doc_id, filename, content, len(content), len(chunks), json.dumps(metadata or {}))
        )
        
        # Insert chunks
        for i, chunk_content in enumerate(chunks):
            chunk_id = generate_chunk_id(chunk_content, doc_id, i)
            word_count = len(chunk_content.split())
            await db.execute(
                """
                INSERT INTO document_chunks (id, document_id, content, chunk_index, word_count)
                VALUES (?, ?, ?, ?, ?)
                """,
                (chunk_id, doc_id, chunk_content, i, word_count)
            )
        
        await db.commit()
        
        return {
            "id": doc_id,
            "filename": filename,
            "chunk_count": len(chunks),
            "total_characters": len(content),
        }
    finally:
        await db.close()


async def get_document(doc_id: str) -> Optional[dict]:
    """Get document metadata by ID."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id, filename, total_characters, chunk_count, uploaded_at, metadata FROM documents WHERE id = ?",
            (doc_id,)
        )
        row = await cursor.fetchone()
        
        if not row:
            return None
        
        return {
            "id": row["id"],
            "filename": row["filename"],
            "total_characters": row["total_characters"],
            "chunk_count": row["chunk_count"],
            "uploaded_at": row["uploaded_at"],
            "metadata": json.loads(row["metadata"]) if row["metadata"] else {},
        }
    finally:
        await db.close()


async def list_documents() -> list[dict]:
    """List all documents in the knowledge base."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "SELECT id, filename, total_characters, chunk_count, uploaded_at FROM documents ORDER BY uploaded_at DESC"
        )
        rows = await cursor.fetchall()
        
        return [
            {
                "id": row["id"],
                "filename": row["filename"],
                "total_characters": row["total_characters"],
                "chunk_count": row["chunk_count"],
                "uploaded_at": row["uploaded_at"],
            }
            for row in rows
        ]
    finally:
        await db.close()


async def delete_document(doc_id: str) -> bool:
    """Delete a document and its chunks (cascading delete)."""
    db = await get_db()
    try:
        cursor = await db.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
        await db.commit()
        return cursor.rowcount > 0
    finally:
        await db.close()


async def get_all_chunks() -> list[dict]:
    """Get all chunks from all documents for retrieval."""
    db = await get_db()
    try:
        cursor = await db.execute(
            """
            SELECT c.id, c.content, c.document_id, d.filename
            FROM document_chunks c
            JOIN documents d ON c.document_id = d.id
            ORDER BY c.document_id, c.chunk_index
            """
        )
        rows = await cursor.fetchall()
        
        return [
            {
                "id": row["id"],
                "content": row["content"],
                "document_id": row["document_id"],
                "filename": row["filename"],
            }
            for row in rows
        ]
    finally:
        await db.close()


async def search_chunks(query: str, top_k: int = 3) -> list[dict]:
    """
    Retrieve relevant document chunks based on keyword matching.
    Uses simple Jaccard similarity - upgrade to vector search for production.
    """
    query_terms = set(query.lower().split())
    chunks = await get_all_chunks()
    
    scored_chunks = []
    for chunk in chunks:
        chunk_terms = set(chunk["content"].lower().split())
        # Simple Jaccard similarity
        intersection = len(query_terms & chunk_terms)
        union = len(query_terms | chunk_terms)
        score = intersection / union if union > 0 else 0
        
        if score > 0:
            scored_chunks.append({
                "id": chunk["id"],
                "content": chunk["content"],
                "document": chunk["filename"],
                "doc_id": chunk["document_id"],
                "relevance_score": score,
            })
    
    # Sort by relevance and return top_k
    scored_chunks.sort(key=lambda x: x["relevance_score"], reverse=True)
    return scored_chunks[:top_k]
