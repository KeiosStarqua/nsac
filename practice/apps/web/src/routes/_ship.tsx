import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { ScenarioBar } from "~/features/scenario";
import { scenarioSearchSchema } from "~/shared/scenario/search";

/**
 * Pathless layout. Owns the validated search params (seed, day, iv), so every child page
 * reads the same typed state and keeps it when you switch tabs.
 */
export const Route = createFileRoute("/_ship")({
  validateSearch: scenarioSearchSchema,
  component: ShipLayout,
});

function ShipLayout() {
  const search = Route.useSearch();
  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-dot" /> Ship Health <small>practice demo · toy numbers, not medical advice</small>
        </div>
        <nav className="tabs">
          <Link to="/" search={search} activeOptions={{ exact: true }} activeProps={{ className: "active" }}>
            Dashboard
          </Link>
          <Link to="/outbreak" search={search} activeProps={{ className: "active" }}>
            Outbreak story
          </Link>
          <Link to="/agent" search={search} activeProps={{ className: "active" }}>
            Ask the AI
          </Link>
        </nav>
      </header>
      <ScenarioBar />
      <main className="page">
        <Outlet />
      </main>
    </div>
  );
}
