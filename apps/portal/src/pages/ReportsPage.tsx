export function ReportsPage() {
  return (
    <>
      <section className="section-welcome">
        <h1 className="welcome-heading">Reports</h1>
        <p className="welcome-body">
          Campaign performance reports and placement summaries will be available
          here as reporting is connected to your account.
        </p>
      </section>

      <section className="section-block">
        <h2 className="section-heading">Available Reports</h2>
        <ul className="report-list">
          <li className="report-item">
            <div className="report-info">
              <span className="report-name">Campaign Performance</span>
              <span className="report-description">
                Impressions, engagement, and delivery metrics across active
                placements.
              </span>
            </div>
            <span className="report-badge">Coming soon</span>
          </li>
          <li className="report-item">
            <div className="report-info">
              <span className="report-name">Placement Summary</span>
              <span className="report-description">
                Publisher-level breakdown of where your media ran and when.
              </span>
            </div>
            <span className="report-badge">Coming soon</span>
          </li>
          <li className="report-item">
            <div className="report-info">
              <span className="report-name">Investment Overview</span>
              <span className="report-description">
                Spend allocation and pacing against your media plan.
              </span>
            </div>
            <span className="report-badge">Coming soon</span>
          </li>
        </ul>
      </section>
    </>
  );
}
