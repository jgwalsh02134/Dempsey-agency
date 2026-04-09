export function BillingPage() {
  return (
    <>
      <section className="section-welcome">
        <h1 className="welcome-heading">Billing</h1>
        <p className="welcome-body">
          Invoices and payment history for your account will be accessible
          here as billing is connected to the portal.
        </p>
      </section>

      <section className="section-block">
        <h2 className="section-heading">What you'll see here</h2>
        <ul className="report-list">
          <li className="report-item">
            <div className="report-info">
              <span className="report-name">Invoices</span>
              <span className="report-description">
                Monthly billing summaries for media placement and management
                services.
              </span>
            </div>
            <span className="report-badge">Coming soon</span>
          </li>
          <li className="report-item">
            <div className="report-info">
              <span className="report-name">Payment History</span>
              <span className="report-description">
                Record of completed payments and outstanding balances.
              </span>
            </div>
            <span className="report-badge">Coming soon</span>
          </li>
        </ul>
      </section>
    </>
  );
}
