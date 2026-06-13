import { useEffect, useMemo } from "react";
import { Clock3, ListChecks, AlertTriangle } from "lucide-react";
import JobCard from "../components/JobCard.jsx";
import useJobStore from "../store/useJobStore.js";

function History() {
  const { jobs, fetchJobs } = useJobStore();

  useEffect(() => {
    async function loadData() {
      try {
        await fetchJobs({ page: 1, limit: 200 });
      } catch (error) {
        console.error("History load failed:", error.message);
      }
    }

    loadData();
  }, [fetchJobs]);

  const historyJobs = useMemo(
    () =>
      jobs.filter((job) =>
        [
          "completed",
          "failed",
          "retrying",
          "cancelled",
          "running",
          "scheduled",
        ].includes(job.status),
      ),
    [jobs],
  );

  const completed = historyJobs.filter(
    (job) => job.status === "completed",
  ).length;
  const failed = historyJobs.filter((job) => job.status === "failed").length;
  const inFlight = historyJobs.filter((job) =>
    ["running", "retrying", "scheduled"].includes(job.status),
  ).length;

  return (
    <section>
      <div className="section-header">
        <h1>Execution History</h1>
        <p>
          Audit trail for completed, failed, retried, scheduled, and in-flight
          jobs.
        </p>
      </div>

      <div className="stats-grid history-stats">
        <div className="stat card-sm">
          <ListChecks size={20} />
          <div>
            <span>Completed</span>
            <strong>{completed}</strong>
          </div>
        </div>
        <div className="stat card-sm">
          <AlertTriangle size={20} />
          <div>
            <span>Failed</span>
            <strong>{failed}</strong>
          </div>
        </div>
        <div className="stat card-sm">
          <Clock3 size={20} />
          <div>
            <span>In Flight</span>
            <strong>{inFlight}</strong>
          </div>
        </div>
      </div>

      <div className="history-grid">
        {historyJobs.length > 0 ? (
          historyJobs.map((job) => (
            <JobCard key={job._id || job.id} job={job} />
          ))
        ) : (
          <div className="panel empty-state">No execution history yet.</div>
        )}
      </div>
    </section>
  );
}

export default History;
