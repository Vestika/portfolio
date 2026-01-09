"""
Models for user account deletion functionality.

Complies with Israeli Privacy Law Amendment 13 ("right to be forgotten").
"""
from typing import List, Optional
from pydantic import BaseModel, Field


class DeleteAccountRequest(BaseModel):
    """Request model for account deletion endpoint"""
    confirmation: str = Field(
        ...,
        description="Must be exactly 'DELETE' to confirm deletion"
    )


class DeleteAccountResponse(BaseModel):
    """Response model for successful account deletion"""
    success: bool
    audit_id: str = Field(
        ...,
        description="Unique ID for the deletion audit log entry"
    )
    message: str


class CollectionDeletionResult(BaseModel):
    """Result of deleting from a single collection"""
    collection: str
    deleted_count: int


class DeletionResult(BaseModel):
    """Complete result of user deletion operation"""
    success: bool
    audit_id: str
    deleted_collections: List[CollectionDeletionResult]
    failed_collections: List[str]
    total_deleted: int
    firebase_deleted: bool
    mixpanel_deleted: bool


class DeletionPartialFailureException(Exception):
    """
    Exception raised when user deletion partially fails.

    Some data was deleted but some operations failed.
    User should be notified and admin should review audit log.
    """

    def __init__(
        self,
        message: str,
        audit_id: str,
        failed_collections: List[str]
    ):
        self.message = message
        self.audit_id = audit_id
        self.failed_collections = failed_collections
        super().__init__(self.message)
