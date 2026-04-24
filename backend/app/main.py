from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes.calculations import router as calculation_router
from app.routes.components import router as component_router
from app.routes.modules import router as module_router
from app.routes.project_components import router as project_component_router
from app.routes.projects import router as project_router
from app.routes.scenarios import router as scenario_router

app = FastAPI(title="Battery TEA API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin, "http://frontend:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def healthcheck():
    return {"status": "ok"}


app.include_router(component_router)
app.include_router(project_router)
app.include_router(project_component_router)
app.include_router(scenario_router)
app.include_router(module_router)
app.include_router(calculation_router)
