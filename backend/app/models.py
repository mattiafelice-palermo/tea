from sqlalchemy import Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Component(Base):
    __tablename__ = "components"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    density: Mapped[float] = mapped_column(Float, nullable=False)
    cost_per_kg: Mapped[float] = mapped_column(Float, nullable=False)


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    cell_active_area_m2: Mapped[float] = mapped_column(Float, nullable=False, default=0.01)
    cell_thickness_mm: Mapped[float] = mapped_column(Float, nullable=False, default=8.0)
    components: Mapped[list["ProjectComponent"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )
    scenarios: Mapped[list["Scenario"]] = relationship(
        back_populates="project", cascade="all, delete-orphan"
    )


class ProjectComponent(Base):
    __tablename__ = "project_components"
    __table_args__ = (UniqueConstraint("project_id", "component_id", name="uq_project_component"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    component_id: Mapped[int] = mapped_column(ForeignKey("components.id"), nullable=False)
    mass: Mapped[float] = mapped_column(Float, nullable=False)

    project: Mapped["Project"] = relationship(back_populates="components")
    component: Mapped["Component"] = relationship()


class Scenario(Base):
    __tablename__ = "scenarios"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    avg_discharge_voltage: Mapped[float] = mapped_column(Float, nullable=False)
    avg_charge_voltage: Mapped[float] = mapped_column(Float, nullable=False)
    discharge_capacity: Mapped[float] = mapped_column(Float, nullable=False)
    cycle_life: Mapped[int] = mapped_column(Integer, nullable=False)
    end_of_life_fraction: Mapped[float] = mapped_column(Float, nullable=False)
    electricity_price_eur_per_kwh: Mapped[float] = mapped_column(Float, nullable=False, default=0.15)

    project: Mapped["Project"] = relationship(back_populates="scenarios")
    result: Mapped["Result | None"] = relationship(
        back_populates="scenario", cascade="all, delete-orphan", uselist=False
    )
    modules: Mapped[list["ModuleConfiguration"]] = relationship(
        back_populates="scenario", cascade="all, delete-orphan"
    )


class Result(Base):
    __tablename__ = "results"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    scenario_id: Mapped[int] = mapped_column(ForeignKey("scenarios.id"), nullable=False, unique=True)
    total_mass: Mapped[float] = mapped_column(Float, nullable=False)
    total_cost: Mapped[float] = mapped_column(Float, nullable=False)
    energy_wh: Mapped[float] = mapped_column(Float, nullable=False)
    specific_energy: Mapped[float] = mapped_column(Float, nullable=False)
    round_trip_efficiency: Mapped[float] = mapped_column(Float, nullable=False)
    lifetime_energy: Mapped[float] = mapped_column(Float, nullable=False)
    cost_per_kwh: Mapped[float] = mapped_column(Float, nullable=False)
    cost_per_kwh_cycle: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    cost_per_lifetime_kwh: Mapped[float] = mapped_column(Float, nullable=False)
    lcos: Mapped[float] = mapped_column(Float, nullable=False)

    scenario: Mapped["Scenario"] = relationship(back_populates="result")


class ModuleConfiguration(Base):
    __tablename__ = "modules"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    scenario_id: Mapped[int] = mapped_column(ForeignKey("scenarios.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    cells_in_series: Mapped[int] = mapped_column(Integer, nullable=False)
    cells_in_parallel: Mapped[int] = mapped_column(Integer, nullable=False)
    module_current_a: Mapped[float] = mapped_column(Float, nullable=False)
    cell_active_area_m2: Mapped[float] = mapped_column(Float, nullable=False, default=0.01)
    cell_thickness_mm: Mapped[float] = mapped_column(Float, nullable=False, default=8.0)
    mass_overhead_fraction: Mapped[float] = mapped_column(Float, nullable=False, default=0.15)
    volume_overhead_fraction: Mapped[float] = mapped_column(Float, nullable=False, default=0.2)
    cost_overhead_fraction: Mapped[float] = mapped_column(Float, nullable=False, default=0.1)

    scenario: Mapped["Scenario"] = relationship(back_populates="modules")
    result: Mapped["ModuleResult | None"] = relationship(
        back_populates="module", cascade="all, delete-orphan", uselist=False
    )


class ModuleResult(Base):
    __tablename__ = "module_results"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    module_id: Mapped[int] = mapped_column(ForeignKey("modules.id"), nullable=False, unique=True)
    module_voltage_v: Mapped[float] = mapped_column(Float, nullable=False)
    module_capacity_ah: Mapped[float] = mapped_column(Float, nullable=False)
    module_energy_wh: Mapped[float] = mapped_column(Float, nullable=False)
    module_power_w: Mapped[float] = mapped_column(Float, nullable=False)
    discharge_time_h: Mapped[float] = mapped_column(Float, nullable=False)
    cell_current_a: Mapped[float] = mapped_column(Float, nullable=False)
    cell_current_density_ma_per_cm2: Mapped[float] = mapped_column(Float, nullable=False)
    total_cell_count: Mapped[int] = mapped_column(Integer, nullable=False)
    module_mass_kg: Mapped[float] = mapped_column(Float, nullable=False)
    module_volume_l: Mapped[float] = mapped_column(Float, nullable=False)
    module_cost: Mapped[float] = mapped_column(Float, nullable=False)
    module_specific_energy_wh_per_kg: Mapped[float] = mapped_column(Float, nullable=False)
    module_volumetric_energy_wh_per_l: Mapped[float] = mapped_column(Float, nullable=False)
    module_specific_power_w_per_kg: Mapped[float] = mapped_column(Float, nullable=False)
    module_volumetric_power_w_per_l: Mapped[float] = mapped_column(Float, nullable=False)
    module_lifetime_energy_wh: Mapped[float] = mapped_column(Float, nullable=False)
    module_cost_per_kwh: Mapped[float] = mapped_column(Float, nullable=False)
    module_cost_per_lifetime_kwh: Mapped[float] = mapped_column(Float, nullable=False)
    module_lcos: Mapped[float] = mapped_column(Float, nullable=False)

    module: Mapped["ModuleConfiguration"] = relationship(back_populates="result")
