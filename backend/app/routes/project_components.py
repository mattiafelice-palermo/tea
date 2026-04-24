from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Component, Project, ProjectComponent
from app.schemas import ProjectComponentCreate, ProjectComponentRead, ProjectComponentUpdate

router = APIRouter(prefix="/project-components", tags=["project-components"])


@router.post("", response_model=ProjectComponentRead)
def create_project_component(payload: ProjectComponentCreate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == payload.project_id).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    component = db.query(Component).filter(Component.id == payload.component_id).first()
    if component is None:
        raise HTTPException(status_code=404, detail="Component not found")

    existing = (
        db.query(ProjectComponent)
        .filter(
            ProjectComponent.project_id == payload.project_id,
            ProjectComponent.component_id == payload.component_id,
        )
        .first()
    )
    if existing:
        existing.mass = payload.mass
        db.commit()
        return (
            db.query(ProjectComponent)
            .options(joinedload(ProjectComponent.component))
            .filter(ProjectComponent.id == existing.id)
            .first()
        )

    project_component = ProjectComponent(**payload.model_dump())
    db.add(project_component)
    db.commit()
    return (
        db.query(ProjectComponent)
        .options(joinedload(ProjectComponent.component))
        .filter(ProjectComponent.id == project_component.id)
        .first()
    )


@router.get("", response_model=list[ProjectComponentRead])
def list_project_components(
    project_id: int = Query(...),
    db: Session = Depends(get_db),
):
    return (
        db.query(ProjectComponent)
        .options(joinedload(ProjectComponent.component))
        .filter(ProjectComponent.project_id == project_id)
        .order_by(ProjectComponent.id.asc())
        .all()
    )


@router.put("/{project_component_id}", response_model=ProjectComponentRead)
def update_project_component(
    project_component_id: int,
    payload: ProjectComponentUpdate,
    db: Session = Depends(get_db),
):
    project_component = (
        db.query(ProjectComponent)
        .filter(ProjectComponent.id == project_component_id)
        .first()
    )
    if project_component is None:
        raise HTTPException(status_code=404, detail="Project component not found")

    if payload.component_id is not None:
        component = db.query(Component).filter(Component.id == payload.component_id).first()
        if component is None:
            raise HTTPException(status_code=404, detail="Component not found")

        existing = (
            db.query(ProjectComponent)
            .filter(
                ProjectComponent.project_id == project_component.project_id,
                ProjectComponent.component_id == payload.component_id,
                ProjectComponent.id != project_component_id,
            )
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=400,
                detail="This component is already present in the selected cell",
            )

        project_component.component_id = payload.component_id

    project_component.mass = payload.mass
    db.commit()
    return (
        db.query(ProjectComponent)
        .options(joinedload(ProjectComponent.component))
        .filter(ProjectComponent.id == project_component_id)
        .first()
    )


@router.delete("/{project_component_id}")
def delete_project_component(project_component_id: int, db: Session = Depends(get_db)):
    project_component = (
        db.query(ProjectComponent)
        .filter(ProjectComponent.id == project_component_id)
        .first()
    )
    if project_component is None:
        raise HTTPException(status_code=404, detail="Project component not found")

    db.delete(project_component)
    db.commit()
    return {"status": "deleted"}
