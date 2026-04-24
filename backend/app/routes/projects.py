from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Project, ProjectComponent
from app.schemas import ProjectCreate, ProjectRead, ProjectSummaryRead, ProjectUpdate

router = APIRouter(prefix="/projects", tags=["projects"])


def build_project_summary(project: Project, project_components: list[ProjectComponent]):
    total_mass_kg = sum(item.mass for item in project_components)
    total_cost_eur = sum(item.mass * item.component.cost_per_kg for item in project_components)
    cost_per_kg_eur = total_cost_eur / total_mass_kg if total_mass_kg else 0.0
    cell_volume_l = project.cell_active_area_m2 * project.cell_thickness_mm

    components = [
        {
            "id": item.id,
            "component_id": item.component_id,
            "name": item.component.name,
            "category": item.component.category,
            "mass": item.mass,
            "mass_fraction": item.mass / total_mass_kg if total_mass_kg else 0.0,
            "cost_per_kg": item.component.cost_per_kg,
            "cost": item.mass * item.component.cost_per_kg,
        }
        for item in project_components
    ]

    return {
        "id": project.id,
        "name": project.name,
        "cell_active_area_m2": project.cell_active_area_m2,
        "cell_thickness_mm": project.cell_thickness_mm,
        "total_mass_kg": total_mass_kg,
        "total_cost_eur": total_cost_eur,
        "cost_per_kg_eur": cost_per_kg_eur,
        "cell_volume_l": cell_volume_l,
        "component_count": len(project_components),
        "components": components,
    }


@router.post("", response_model=ProjectRead)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)):
    existing = db.query(Project).filter(Project.name == payload.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Project name already exists")

    project = Project(**payload.model_dump())
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("", response_model=list[ProjectRead])
def list_projects(db: Session = Depends(get_db)):
    return db.query(Project).order_by(Project.name.asc()).all()


@router.get("/summaries", response_model=list[ProjectSummaryRead])
def list_project_summaries(db: Session = Depends(get_db)):
    projects = db.query(Project).order_by(Project.name.asc()).all()
    project_components = (
        db.query(ProjectComponent)
        .options(joinedload(ProjectComponent.component))
        .order_by(ProjectComponent.id.asc())
        .all()
    )
    components_by_project: dict[int, list[ProjectComponent]] = {}
    for item in project_components:
        components_by_project.setdefault(item.project_id, []).append(item)

    return [
        build_project_summary(project, components_by_project.get(project.id, []))
        for project in projects
    ]


@router.get("/{project_id}/summary", response_model=ProjectSummaryRead)
def get_project_summary(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    project_components = (
        db.query(ProjectComponent)
        .options(joinedload(ProjectComponent.component))
        .filter(ProjectComponent.project_id == project_id)
        .order_by(ProjectComponent.id.asc())
        .all()
    )
    return build_project_summary(project, project_components)


@router.put("/{project_id}", response_model=ProjectRead)
def update_project(project_id: int, payload: ProjectUpdate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    data = payload.model_dump(exclude_none=True)
    if "name" in data:
        existing = (
            db.query(Project)
            .filter(Project.name == data["name"], Project.id != project_id)
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="Project name already exists")

    for field, value in data.items():
        setattr(project, field, value)

    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")

    db.delete(project)
    db.commit()
    return {"status": "deleted"}
