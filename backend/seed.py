from sqlalchemy.exc import IntegrityError

from app.database import SessionLocal
from app.models import Component

EXAMPLE_COMPONENTS = [
    {"name": "Graphite", "category": "anode", "density": 2.2, "cost_per_kg": 12.0},
    {"name": "NMC811", "category": "cathode", "density": 4.8, "cost_per_kg": 28.0},
    {"name": "LiPF6 Electrolyte", "category": "electrolyte", "density": 1.2, "cost_per_kg": 18.0},
    {"name": "Aluminum Casing", "category": "casing", "density": 2.7, "cost_per_kg": 6.0},
]


def main():
    db = SessionLocal()
    try:
        for item in EXAMPLE_COMPONENTS:
            db.add(Component(**item))
        db.commit()
    except IntegrityError:
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    main()
