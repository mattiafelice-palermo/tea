from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import ResultRead
from app.services.calculation_service import calculate_for_scenario

router = APIRouter(tags=["calculation"])


@router.post("/calculate/{scenario_id}", response_model=ResultRead)
def calculate_scenario(scenario_id: int, db: Session = Depends(get_db)):
    return calculate_for_scenario(db, scenario_id)
