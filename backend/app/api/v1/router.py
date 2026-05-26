from fastapi import APIRouter

from app.api.v1.routes import (
    audit,
    auth,
    dashboard,
    health,
    imports,
    inventory,
    notifications,
    procurement,
    products,
    users,
    warehouses,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(audit.router)
api_router.include_router(dashboard.router)
api_router.include_router(health.router, tags=["health"])
api_router.include_router(imports.router)
api_router.include_router(products.router)
api_router.include_router(inventory.router)
api_router.include_router(notifications.router)
api_router.include_router(users.router)
api_router.include_router(procurement.router)
api_router.include_router(warehouses.router)
