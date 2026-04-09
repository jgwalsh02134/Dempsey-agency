export function DocumentsPage() {
  return (
    <>
      <section className="section-welcome">
        <h1 className="welcome-heading">Documents</h1>
        <p className="welcome-body">
          Shared files, media plans, and billing documents from your Dempsey
          Agency team will be accessible here.
        </p>
      </section>

      <section className="section-block">
        <h2 className="section-heading">Document Library</h2>
        <ul className="report-list">
          <li className="report-item">
            <div className="report-info">
              <span className="report-name">Media Plan</span>
              <span className="report-description">
                Current placement strategy, publisher mix, and scheduling.
              </span>
            </div>
            <span className="report-badge">Coming soon</span>
          </li>
          <li className="report-item">
            <div className="report-info">
              <span className="report-name">Campaign Brief</span>
              <span className="report-description">
                Objectives, audience targeting, and creative direction for
                active campaigns.
              </span>
            </div>
            <span className="report-badge">Coming soon</span>
          </li>
          <li className="report-item">
            <div className="report-info">
              <span className="report-name">Invoices</span>
              <span className="report-description">
                Billing summaries and payment records for your account.
              </span>
            </div>
            <span className="report-badge">Coming soon</span>
          </li>
        </ul>
      </section>
    </>
  );
}
