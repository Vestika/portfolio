from fastapi import APIRouter, HTTPException, Query
from typing import Type, Dict
from models.base_model import BaseFeatureModel, FeatureConfig
from .database import db_manager
from .crud_operations import CRUDOperations
from .auth_middleware import get_auth_dependency
import inspect


class FeatureGenerator:
    def __init__(self):
        self.registered_features = {}
        self.nested_relationships = {}

    def register_feature(self, model_class: Type[BaseFeatureModel]) -> APIRouter:
        """Register a feature model and generate its endpoints"""
        config = model_class.get_feature_config()

        # Determine if this is a nested or standalone feature
        if config.nested_under:
            # This is a nested feature - create nested routes
            return self._create_nested_router(model_class, config)
        else:
            # This is a standalone feature - create regular routes
            return self._create_standalone_router(model_class, config)

    def _create_standalone_router(self, model_class: Type[BaseFeatureModel], config: FeatureConfig) -> APIRouter:
        """Create router for standalone features"""
        router = APIRouter(prefix=f"/{config.collection_name}", tags=[config.collection_name.title()])

        # Get database collection
        collection = db_manager.get_collection(config.collection_name)
        crud = CRUDOperations(collection, model_class)

        # Get auth dependency
        auth_dep = get_auth_dependency(config.auth_required)

        # Generate standard endpoints
        if config.enable_create:
            self._create_endpoint(router, model_class, crud, auth_dep, config)

        if config.enable_read:
            self._read_endpoint(router, model_class, crud, auth_dep, config)

        if config.enable_list:
            self._list_endpoint(router, model_class, crud, auth_dep, config)

        if config.enable_update:
            self._update_endpoint(router, model_class, crud, auth_dep, config)

        if config.enable_delete:
            self._delete_endpoint(router, model_class, crud, auth_dep, config)

        # Generate nested child endpoints if any
        if config.nested_children:
            self._create_nested_child_endpoints(router, model_class, crud, auth_dep, config)

        # Store for reference
        self.registered_features[config.collection_name] = {
            'model': model_class,
            'config': config,
            'crud': crud,
            'router': router
        }

        return router

    def _create_nested_router(self, model_class: Type[BaseFeatureModel], config: FeatureConfig) -> APIRouter:
        """Create router for nested features"""
        nested_config = config.nested_under
        parent_collection = nested_config.parent_collection
        route_name = nested_config.route_name

        # Create nested router - this will be included in parent router
        router = APIRouter()

        # Get database collection
        collection = db_manager.get_collection(config.collection_name)
        crud = CRUDOperations(collection, model_class)

        # Get auth dependency
        auth_dep = get_auth_dependency(config.auth_required)

        # Generate nested endpoints
        self._create_nested_endpoints(router, model_class, crud, auth_dep, config, nested_config)

        # Store nested relationship info
        if parent_collection not in self.nested_relationships:
            self.nested_relationships[parent_collection] = {}
        self.nested_relationships[parent_collection][route_name] = {
            'model': model_class,
            'config': config,
            'crud': crud,
            'router': router
        }

        return router

    def _create_nested_child_endpoints(self, parent_router: APIRouter, parent_model: Type[BaseFeatureModel],
                                       parent_crud: CRUDOperations, auth_dep, parent_config: FeatureConfig):
        """Create nested child endpoints on parent router"""
        for child_class_name in parent_config.nested_children:
            if child_class_name in self.nested_relationships.get(parent_config.collection_name, {}):
                child_info = self.nested_relationships[parent_config.collection_name][child_class_name]
                child_router = child_info['router']

                # Include child router in parent with nested path
                parent_router.include_router(
                    child_router,
                    prefix="/{parent_id}/" + child_class_name.lower()
                )

    def _create_nested_endpoints(self, router: APIRouter, model_class: Type[BaseFeatureModel],
                                 crud: CRUDOperations, auth_dep, config: FeatureConfig, nested_config):
        """Generate nested CRUD endpoints"""
        parent_field = nested_config.parent_field

        if config.enable_list:
            @router.get("/")
            async def list_nested_items(
                    parent_id: str,
                    skip: int = Query(0, ge=0),
                    limit: int = Query(100, ge=1, le=1000),
                    auth=auth_dep
            ):
                # Verify parent exists
                parent_collection = db_manager.get_collection(nested_config.parent_collection)
                parent_exists = await parent_collection.find_one({"_id": ObjectId(parent_id)})
                if not parent_exists:
                    raise HTTPException(status_code=404, detail="Parent not found")

                # Run pre-hooks
                if 'list' in config.pre_hooks:
                    for hook in config.pre_hooks['list']:
                        await hook(parent_id, skip, limit) if inspect.iscoroutinefunction(hook) else hook(parent_id,
                                                                                                          skip, limit)

                items = await crud.get_nested(parent_id, parent_field, skip, limit)

                # Run post-hooks
                if 'list' in config.post_hooks:
                    for hook in config.post_hooks['list']:
                        items = await hook(items) if inspect.iscoroutinefunction(hook) else hook(items)

                return {"items": items, "total": len(items)}

        if config.enable_create:
            @router.post("/", response_model=Dict[str, str])
            async def create_nested_item(parent_id: str, item: model_class, auth=auth_dep):
                # Verify parent exists
                parent_collection = db_manager.get_collection(nested_config.parent_collection)
                parent_exists = await parent_collection.find_one({"_id": ObjectId(parent_id)})
                if not parent_exists:
                    raise HTTPException(status_code=404, detail="Parent not found")

                # Run pre-hooks
                if 'create' in config.pre_hooks:
                    for hook in config.pre_hooks['create']:
                        await hook(parent_id, item.dict()) if inspect.iscoroutinefunction(hook) else hook(parent_id,
                                                                                                          item.dict())

                # Custom validation
                if 'create' in config.custom_validators:
                    config.custom_validators['create'](item.dict())

                item_id = await crud.create_nested(parent_id, parent_field, item.dict(exclude_unset=True))

                # Run post-hooks
                if 'create' in config.post_hooks:
                    for hook in config.post_hooks['create']:
                        await hook(parent_id, item_id) if inspect.iscoroutinefunction(hook) else hook(parent_id,
                                                                                                      item_id)

                return {"id": item_id}

        if config.enable_read:
            @router.get("/{item_id}")
            async def get_nested_item(parent_id: str, item_id: str, auth=auth_dep):
                # Run pre-hooks
                if 'read' in config.pre_hooks:
                    for hook in config.pre_hooks['read']:
                        await hook(parent_id, item_id) if inspect.iscoroutinefunction(hook) else hook(parent_id,
                                                                                                      item_id)

                item = await crud.get_nested_by_id(parent_id, item_id, parent_field)
                if not item:
                    raise HTTPException(status_code=404, detail="Item not found")

                # Run post-hooks
                if 'read' in config.post_hooks:
                    for hook in config.post_hooks['read']:
                        item = await hook(item) if inspect.iscoroutinefunction(hook) else hook(item)

                return item

        if config.enable_update:
            @router.put("/{item_id}")
            async def update_nested_item(parent_id: str, item_id: str, item: model_class, auth=auth_dep):
                # Run pre-hooks
                if 'update' in config.pre_hooks:
                    for hook in config.pre_hooks['update']:
                        await hook(parent_id, item_id, item.dict()) if inspect.iscoroutinefunction(hook) else hook(
                            parent_id, item_id, item.dict())

                # Custom validation
                if 'update' in config.custom_validators:
                    config.custom_validators['update'](item.dict())

                success = await crud.update_nested(parent_id, item_id, parent_field, item.dict(exclude_unset=True))
                if not success:
                    raise HTTPException(status_code=404, detail="Item not found")

                # Run post-hooks
                if 'update' in config.post_hooks:
                    for hook in config.post_hooks['update']:
                        await hook(parent_id, item_id) if inspect.iscoroutinefunction(hook) else hook(parent_id,
                                                                                                      item_id)

                return {"message": "Item updated successfully"}

        if config.enable_delete:
            @router.delete("/{item_id}")
            async def delete_nested_item(parent_id: str, item_id: str, auth=auth_dep):
                # Run pre-hooks
                if 'delete' in config.pre_hooks:
                    for hook in config.pre_hooks['delete']:
                        await hook(parent_id, item_id) if inspect.iscoroutinefunction(hook) else hook(parent_id,
                                                                                                      item_id)

                success = await crud.delete_nested(parent_id, item_id, parent_field)
                if not success:
                    raise HTTPException(status_code=404, detail="Item not found")

                # Run post-hooks
                if 'delete' in config.post_hooks:
                    for hook in config.post_hooks['delete']:
                        await hook(parent_id, item_id) if inspect.iscoroutinefunction(hook) else hook(parent_id,
                                                                                                      item_id)

                return {"message": "Item deleted successfully"}

    def _create_endpoint(self, router: APIRouter, model_class: Type[BaseFeatureModel],
                         crud: CRUDOperations, auth_dep, config):
        """Generate CREATE endpoint"""

        if config.async_operations:
            @router.post("/", response_model=Dict[str, str])
            async def create_item(item: model_class, auth=auth_dep):
                # Run pre-hooks
                if 'create' in config.pre_hooks:
                    for hook in config.pre_hooks['create']:
                        await hook(item.dict()) if inspect.iscoroutinefunction(hook) else hook(item.dict())

                # Custom validation
                if 'create' in config.custom_validators:
                    config.custom_validators['create'](item.dict())

                item_id = await crud.create(item.dict(exclude_unset=True))

                # Run post-hooks
                if 'create' in config.post_hooks:
                    for hook in config.post_hooks['create']:
                        await hook(item_id) if inspect.iscoroutinefunction(hook) else hook(item_id)

                return {"id": item_id}
        else:
            # Sync version would go here
            pass

    def _read_endpoint(self, router: APIRouter, model_class: Type[BaseFeatureModel],
                       crud: CRUDOperations, auth_dep, config):
        """Generate READ endpoint"""

        if config.async_operations:
            @router.get("/{item_id}")
            async def get_item(item_id: str, auth=auth_dep):
                # Run pre-hooks
                if 'read' in config.pre_hooks:
                    for hook in config.pre_hooks['read']:
                        await hook(item_id) if inspect.iscoroutinefunction(hook) else hook(item_id)

                item = await crud.get_by_id(item_id)
                if not item:
                    raise HTTPException(status_code=404, detail="Item not found")

                # Run post-hooks for data manipulation
                if 'read' in config.post_hooks:
                    for hook in config.post_hooks['read']:
                        item = await hook(item) if inspect.iscoroutinefunction(hook) else hook(item)

                return item

    def _list_endpoint(self, router: APIRouter, model_class: Type[BaseFeatureModel],
                       crud: CRUDOperations, auth_dep, config):
        """Generate LIST endpoint"""

        if config.async_operations:
            @router.get("/")
            async def list_items(
                    skip: int = Query(0, ge=0),
                    limit: int = Query(100, ge=1, le=1000),
                    auth=auth_dep
            ):
                # Run pre-hooks
                if 'list' in config.pre_hooks:
                    for hook in config.pre_hooks['list']:
                        await hook(skip, limit) if inspect.iscoroutinefunction(hook) else hook(skip, limit)

                items = await crud.get_all(skip=skip, limit=limit)

                # Run post-hooks for data manipulation
                if 'list' in config.post_hooks:
                    for hook in config.post_hooks['list']:
                        items = await hook(items) if inspect.iscoroutinefunction(hook) else hook(items)

                return {"items": items, "total": len(items)}

    def _update_endpoint(self, router: APIRouter, model_class: Type[BaseFeatureModel],
                         crud: CRUDOperations, auth_dep, config):
        """Generate UPDATE endpoint"""

        if config.async_operations:
            @router.put("/{item_id}")
            async def update_item(item_id: str, item: model_class, auth=auth_dep):
                # Run pre-hooks
                if 'update' in config.pre_hooks:
                    for hook in config.pre_hooks['update']:
                        await hook(item_id, item.dict()) if inspect.iscoroutinefunction(hook) else hook(item_id,
                                                                                                        item.dict())

                # Custom validation
                if 'update' in config.custom_validators:
                    config.custom_validators['update'](item.dict())

                success = await crud.update(item_id, item.dict(exclude_unset=True))
                if not success:
                    raise HTTPException(status_code=404, detail="Item not found")

                # Run post-hooks
                if 'update' in config.post_hooks:
                    for hook in config.post_hooks['update']:
                        await hook(item_id) if inspect.iscoroutinefunction(hook) else hook(item_id)

                return {"message": "Item updated successfully"}

    def _delete_endpoint(self, router: APIRouter, model_class: Type[BaseFeatureModel],
                         crud: CRUDOperations, auth_dep, config):
        """Generate DELETE endpoint"""

        if config.async_operations:
            @router.delete("/{item_id}")
            async def delete_item(item_id: str, auth=auth_dep):
                # Run pre-hooks
                if 'delete' in config.pre_hooks:
                    for hook in config.pre_hooks['delete']:
                        await hook(item_id) if inspect.iscoroutinefunction(hook) else hook(item_id)

                success = await crud.delete(item_id)
                if not success:
                    raise HTTPException(status_code=404, detail="Item not found")

                # Run post-hooks
                if 'delete' in config.post_hooks:
                    for hook in config.post_hooks['delete']:
                        await hook(item_id) if inspect.iscoroutinefunction(hook) else hook(item_id)

                return {"message": "Item deleted successfully"}


# Global feature generator instance
feature_generator = FeatureGenerator()
