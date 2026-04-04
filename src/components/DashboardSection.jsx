function DashboardSection() {
  return (
    <section className="card section-card dashboard-card">
      <div className="section-heading">
        <h2>Dashboard</h2>
        <p>Production KPI view for embedded Amazon QuickSight dashboards.</p>
      </div>

      <div className="dashboard-placeholder">
        {/* QuickSight dashboard embedding will be added here later. */}
        <div className="placeholder-content">
          <span className="placeholder-badge">Embedded Analytics</span>
          <h3>QuickSight Dashboard Container</h3>
          <p>
            This reserved area is ready for a future embedded dashboard experience.
          </p>
        </div>
      </div>
    </section>
  );
}

export default DashboardSection;
