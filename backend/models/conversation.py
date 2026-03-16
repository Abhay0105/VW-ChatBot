"""
Conversation and message storage operations.
"""

import json
import hashlib
from datetime import datetime
from typing import Optional
from database import get_db


def generate_message_id() -> str:
    """Generate a unique message ID."""
    return hashlib.md5(f"{datetime.now().isoformat()}".encode()).hexdigest()[:12]


async def create_conversation(title: Optional[str] = None, metadata: Optional[dict] = None) -> dict:
    """Create a new conversation."""
    conv_id = hashlib.md5(f"{datetime.now().isoformat()}".encode()).hexdigest()[:12]
    
    db = await get_db()
    try:
        await db.execute(
            """
            INSERT INTO conversations (id, title, metadata)
            VALUES (?, ?, ?)
            """,
            (conv_id, title, json.dumps(metadata or {}))
        )
        await db.commit()
        
        return {
            "id": conv_id,
            "title": title,
            "created_at": datetime.now().isoformat(),
        }
    finally:
        await db.close()


async def get_conversation(conversation_id: str) -> Optional[dict]:
    """Get conversation with all messages."""
    db = await get_db()
    try:
        # Get conversation
        cursor = await db.execute(
            "SELECT id, title, created_at, updated_at, metadata FROM conversations WHERE id = ?",
            (conversation_id,)
        )
        row = await cursor.fetchone()
        
        if not row:
            return None
        
        # Get messages
        cursor = await db.execute(
            """
            SELECT id, role, content, sources, created_at
            FROM messages
            WHERE conversation_id = ?
            ORDER BY created_at ASC
            """,
            (conversation_id,)
        )
        messages = await cursor.fetchall()
        
        return {
            "id": row["id"],
            "title": row["title"],
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
            "messages": [
                {
                    "id": msg["id"],
                    "role": msg["role"],
                    "content": msg["content"],
                    "sources": json.loads(msg["sources"]) if msg["sources"] else [],
                    "created_at": msg["created_at"],
                }
                for msg in messages
            ],
        }
    finally:
        await db.close()


async def list_conversations(limit: int = 50, offset: int = 0) -> list[dict]:
    """List all conversations ordered by last activity."""
    db = await get_db()
    try:
        cursor = await db.execute(
            """
            SELECT c.id, c.title, c.created_at, c.updated_at,
                   (SELECT content FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message,
                   (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count
            FROM conversations c
            ORDER BY c.updated_at DESC
            LIMIT ? OFFSET ?
            """,
            (limit, offset)
        )
        rows = await cursor.fetchall()
        
        return [
            {
                "id": row["id"],
                "title": row["title"] or _generate_title_from_message(row["last_message"]),
                "created_at": row["created_at"],
                "updated_at": row["updated_at"],
                "last_message": row["last_message"][:100] + "..." if row["last_message"] and len(row["last_message"]) > 100 else row["last_message"],
                "message_count": row["message_count"],
            }
            for row in rows
        ]
    finally:
        await db.close()


def _generate_title_from_message(message: Optional[str]) -> str:
    """Generate a title from the first message content."""
    if not message:
        return "New Conversation"
    # Take first 50 chars as title
    title = message[:50].strip()
    if len(message) > 50:
        title += "..."
    return title


async def delete_conversation(conversation_id: str) -> bool:
    """Delete a conversation and all its messages (cascading delete)."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "DELETE FROM conversations WHERE id = ?",
            (conversation_id,)
        )
        await db.commit()
        return cursor.rowcount > 0
    finally:
        await db.close()


async def add_message(
    conversation_id: str,
    role: str,
    content: str,
    sources: Optional[list] = None
) -> dict:
    """Add a message to a conversation."""
    msg_id = generate_message_id()
    
    db = await get_db()
    try:
        # Check if conversation exists, create if not
        cursor = await db.execute(
            "SELECT id FROM conversations WHERE id = ?",
            (conversation_id,)
        )
        if not await cursor.fetchone():
            # Auto-create conversation
            await db.execute(
                "INSERT INTO conversations (id) VALUES (?)",
                (conversation_id,)
            )
        
        # Insert message
        await db.execute(
            """
            INSERT INTO messages (id, conversation_id, role, content, sources)
            VALUES (?, ?, ?, ?, ?)
            """,
            (msg_id, conversation_id, role, content, json.dumps(sources or []))
        )
        
        # Update conversation's updated_at
        await db.execute(
            "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
            (conversation_id,)
        )
        
        await db.commit()
        
        return {
            "id": msg_id,
            "conversation_id": conversation_id,
            "role": role,
            "content": content,
            "sources": sources or [],
        }
    finally:
        await db.close()


async def get_messages(
    conversation_id: str,
    limit: int = 50,
    offset: int = 0,
    order: str = "asc"
) -> list[dict]:
    """Get messages from a conversation with pagination."""
    db = await get_db()
    try:
        order_direction = "ASC" if order.lower() == "asc" else "DESC"
        cursor = await db.execute(
            f"""
            SELECT id, role, content, sources, created_at
            FROM messages
            WHERE conversation_id = ?
            ORDER BY created_at {order_direction}
            LIMIT ? OFFSET ?
            """,
            (conversation_id, limit, offset)
        )
        rows = await cursor.fetchall()
        
        messages = [
            {
                "id": row["id"],
                "role": row["role"],
                "content": row["content"],
                "sources": json.loads(row["sources"]) if row["sources"] else [],
                "created_at": row["created_at"],
            }
            for row in rows
        ]
        
        # If descending order was used, reverse to get chronological order
        if order.lower() == "desc":
            messages.reverse()
        
        return messages
    finally:
        await db.close()


async def update_conversation_title(conversation_id: str, title: str) -> bool:
    """Update conversation title."""
    db = await get_db()
    try:
        cursor = await db.execute(
            "UPDATE conversations SET title = ? WHERE id = ?",
            (title, conversation_id)
        )
        await db.commit()
        return cursor.rowcount > 0
    finally:
        await db.close()
