export function CampaignsPage() {
  return (
    <>
      <section className="section-welcome">
        <h1 className="welcome-heading">Campaigns</h1>
        <p className="welcome-body">
          Track your active and completed campaigns. Placement details,
          performance data, and campaign reports will be available here.
        </p>
      </section>

      <section className="section-block">
        <h2 className="section-heading">Your Campaigns</h2>
        <ul className="report-list">
          <li className="report-item">
            <div className="report-info">
              <span className="report-name">Q2 2026 — National Print</span>
              <span className="report-description">
                Full-page placements across regional and national publications.
              </span>
            </div>
            <span className="report-badge badge-active">Active</span>
          </li>
          <li className="report-item">
            <div className="report-info">
              <span className="report-name">
                Q2 2026 — Digital &amp; Newsletter
              </span>
              <span className="report-description">
                Display and sponsored content across premium digital publishers.
              </span>
            </div>
            <span className="report-badge badge-active">Active</span>
          </li>
          <li className="report-item">
            <div className="report-info">
              <span className="report-name">Q1 2026 — Launch Campaign</span>
              <span className="report-description">
                Introductory media push across print and digital channels.
              </span>
            </div>
            <span className="report-badge badge-completed">Completed</span>
          </li>
        </ul>
      </section>
    </>
  );
}
