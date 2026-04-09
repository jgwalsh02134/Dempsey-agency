export function BillingPage() {
  return (
    <>
      <section className="section-welcome">
        <h1 className="welcome-heading">Billing</h1>
        <p className="welcome-body">
          View invoices and payment history for your account. Detailed billing
          records will be available here as invoicing is connected.
        </p>
      </section>

      <section className="section-block">
        <h2 className="section-heading">Invoices</h2>
        <ul className="report-list">
          <li className="report-item">
            <div className="report-info">
              <span className="report-name">June 2026 — Media Services</span>
              <span className="report-description">
                Monthly placement and management fees.
              </span>
            </div>
            <span className="report-badge badge-pending">Pending</span>
          </li>
          <li className="report-item">
            <div className="report-info">
              <span className="report-name">May 2026 — Media Services</span>
              <span className="report-description">
                Monthly placement and management fees.
              </span>
            </div>
            <span className="report-badge badge-paid">Paid</span>
          </li>
          <li className="report-item">
            <div className="report-info">
              <span className="report-name">April 2026 — Media Services</span>
              <span className="report-description">
                Monthly placement and management fees.
              </span>
            </div>
            <span className="report-badge badge-paid">Paid</span>
          </li>
        </ul>
      </section>
    </>
  );
}
