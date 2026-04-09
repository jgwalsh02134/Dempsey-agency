export function CampaignsPage() {
  return (
    <>
      <section className="section-welcome">
        <h1 className="welcome-heading">Campaigns</h1>
        <p className="welcome-body">
          Active and completed campaigns managed by your Dempsey Agency team
          will appear here with placement details and performance data.
        </p>
      </section>

      <section className="section-block">
        <h2 className="section-heading">What you'll see here</h2>
        <ul className="report-list">
          <li className="report-item">
            <div className="report-info">
              <span className="report-name">Active Campaigns</span>
              <span className="report-description">
                Current placements across print, digital, and newsletter
                channels with status and delivery progress.
              </span>
            </div>
            <span className="report-badge">Coming soon</span>
          </li>
          <li className="report-item">
            <div className="report-info">
              <span className="report-name">Campaign History</span>
              <span className="report-description">
                Completed campaigns with final performance summaries and
                placement records.
              </span>
            </div>
            <span className="report-badge">Coming soon</span>
          </li>
          <li className="report-item">
            <div className="report-info">
              <span className="report-name">Placement Details</span>
              <span className="report-description">
                Publisher-level breakdown of where your media ran, when it
                ran, and how it performed.
              </span>
            </div>
            <span className="report-badge">Coming soon</span>
          </li>
        </ul>
      </section>
    </>
  );
}
