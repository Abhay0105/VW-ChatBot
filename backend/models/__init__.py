"""
Data models for persistent storage operations.
"""

from .document import (
    create_document,
    get_document,
    list_documents,
    delete_document,
    get_all_chunks,
    search_chunks,
)

from .conversation import (
    create_conversation,
    get_conversation,
    list_conversations,
    delete_conversation,
    add_message,
    get_messages,
    update_conversation_title,
)

__all__ = [
    # Document operations
    "create_document",
    "get_document",
    "list_documents",
    "delete_document",
    "get_all_chunks",
    "search_chunks",
    # Conversation operations
    "create_conversation",
    "get_conversation",
    "list_conversations",
    "delete_conversation",
    "add_message",
    "get_messages",
    "update_conversation_title",
]
