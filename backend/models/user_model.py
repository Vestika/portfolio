from .base_model import BaseFeatureModel
from pydantic import Field


class User(BaseFeatureModel):
    name: str = Field(..., min_length=1, max_length=100)
    email: str
    firebase_uid: str
