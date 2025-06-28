from backend.endpoints.base import MongoResourceEndpoint
from backend.schemas.portfolio import PortfolioCreate, PortfolioRead, PortfolioUpdate

portfolio_endpoint = MongoResourceEndpoint(
    collection_name="portfolios",
    parent_keys=[],
    item_key="portfolio_id",
    create_schema=PortfolioCreate,
    read_schema=PortfolioRead,
    update_schema=PortfolioUpdate,
    requires_auth=True,
)

router = portfolio_endpoint.router 