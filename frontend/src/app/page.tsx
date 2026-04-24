import Link from "next/link";

const panels = [
  {
    href: "/components",
    title: "Components",
    copy: "Define materials with density in kg/L and cost in EUR/kg.",
  },
  {
    href: "/projects",
    title: "Cell Builder",
    copy: "Assemble a cell, define geometry, and assign component masses in kg.",
  },
  {
    href: "/scenarios",
    title: "Scenario",
    copy: "Enter cell-level voltage, capacity, cycle life, and end-of-life retention.",
  },
  {
    href: "/results",
    title: "Results",
    copy: "Run the Python calculation and inspect techno-economic outputs.",
  },
  {
    href: "/modules",
    title: "Modules",
    copy: "Aggregate saved cells into module configurations with current and module overheads.",
  },
];

export default function HomePage() {
  return (
    <div className="stack">
      <div className="page-grid">
        {panels.map((panel) => (
          <Link key={panel.href} href={panel.href} className="panel-link">
            <span className="eyebrow">{panel.title}</span>
            <h2>{panel.title}</h2>
            <p className="muted">{panel.copy}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
