from .base_model import BaseFeatureModel, FeatureConfig, AuthType
from pydantic import Field
from typing import Optional

class Product(BaseFeatureModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=1000)
    price: float = Field(..., gt=0)
    category: str

    @classmethod
    def get_feature_config(cls) -> FeatureConfig:
        return FeatureConfig(
            collection_name="products",
            auth_required=AuthType.BEARER,
            nested_children=["colors", "reviews"]  # Define child relationships
        )


# # Color model (nested under product)
# class ProductColor(BaseFeatureModel):
#     product_id: str = Field(..., description="ID of the parent product")
#     color_name: str = Field(..., min_length=1, max_length=50)
#     color_code: str = Field(..., regex="^#[0-9A-Fa-f]{6}$")
#     stock_quantity: int = Field(..., ge=0)
#
#     @classmethod
#     def get_feature_config(cls) -> FeatureConfig:
#         return FeatureConfig(
#             collection_name="product_colors",
#             auth_required=AuthType.BEARER,
#             nested_under=NestedRelation(
#                 parent_field="product_id",
#                 parent_collection="products",
#                 route_name="colors"
#             ),
#             post_hooks={
#                 "create": [cls.update_product_color_count],
#                 "delete": [cls.update_product_color_count]
#             }
#         )
#
#     @staticmethod
#     async def update_product_color_count(parent_id: str, *args):
#         """Update product's color count after color changes"""
#         # Custom logic to update parent product
#         pass
#
#
# # Review model (nested under product)
# class ProductReview(BaseFeatureModel):
#     product_id: str = Field(..., description="ID of the parent product")
#     reviewer_name: str = Field(..., min_length=1, max_length=100)
#     rating: int = Field(..., ge=1, le=5)
#     comment: str = Field(..., min_length=10, max_length=1000)
#
#     @classmethod
#     def get_feature_config(cls) -> FeatureConfig:
#         return FeatureConfig(
#             collection_name="product_reviews",
#             auth_required=AuthType.BEARER,
#             nested_under=NestedRelation(
#                 parent_field="product_id",
#                 parent_collection="products",
#                 route_name="reviews"
#             ),
#             post_hooks={
#                 "create": [cls.update_product_rating],
#                 "update": [cls.update_product_rating],
#                 "delete": [cls.update_product_rating]
#             }
#         )
#
#     @staticmethod
#     async def update_product_rating(parent_id: str, *args):
#         """Recalculate product's average rating"""
#         # Custom logic to update parent product rating
#         pass
