export function CRMReportsPage() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>CRM Reports</h2>
          <p className="page-subtitle">
            Design space for pipeline, activity, and interaction reports driven
            by your Supabase data.
          </p>
        </div>
      </div>

      <section className="card">
        <p className="section-description">
          This page is intentionally simple for now. It lays out the sections
          you&apos;ll likely want:
        </p>
        <ul className="report-list">
          <li>
            <strong>Customer coverage</strong> – who has recent interactions and
            who might be going quiet.
          </li>
          <li>
            <strong>Interaction volume</strong> – AI and human touchpoints per
            customer, per week / month.
          </li>
          <li>
            <strong>Opportunity tracking</strong> – deals mentioned in
            interactions and their rough stage.
          </li>
          <li>
            <strong>Export</strong> – download structured CSV / PDF for sharing
            with the team.
          </li>
        </ul>
        <p className="section-description">
          Once backend endpoints exist, this screen can render real tables and
          charts instead of static bullets.
        </p>
      </section>
    </div>
  );
}


