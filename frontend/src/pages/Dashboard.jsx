import { useEffect } from "react";
import { CheckCircle2, AlertTriangle, Activity, Clock3 } from "lucide-react";
import JobCard from "../components/JobCard.jsx";
import WorkerCard from "../components/WorkerCard.jsx";
import useJobStore from "../store/useJobStore.js";

function Dashboard() {
  const { jobs, workers, fetchJobs, fetchWorkers, fetchStats, stats } =
    useJobStore();

  useEffect(() => {
    async function loadData() {
      try {
        await Promise.all([
          fetchJobs({ limit: 10 }),
          fetchWorkers(),
          fetchStats(),
        ]);
      } catch (error) {
        console.error("Dashboard load failed:", error.message);
      }
    }

    loadData();
  }, [fetchJobs, fetchWorkers, fetchStats]);

  const total = jobs.length;
  const running = jobs.filter((j) => j.status === "running").length;
  const completed = jobs.filter((j) => j.status === "completed").length;
  const failed = jobs.filter((j) => j.status === "failed").length;
  const scheduled = jobs.filter((j) => j.status === "scheduled").length;

  return (
    <section className="page-grid">
      <div>
        <div className="section-header">
          <h1>Dashboard</h1>
          <p>
            {total} jobs and {workers.length} workers
          </p>
        </div>
        <div className="stats-grid">
          <div className="stat card-sm">
            <Activity size={20} />
            <div>
              <span>Total Jobs</span>
              <strong>{total}</strong>
            </div>
          </div>
          <div className="stat card-sm">
            <Activity size={20} />
            <div>
              <span>Running</span>
              <strong>{running}</strong>
            </div>
          </div>
          <div className="stat card-sm">
            <CheckCircle2 size={20} />
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
              <span>Scheduled</span>
              <strong>{scheduled}</strong>
            </div>
          </div>
        </div>
      </div>
      <div className="content-grid">
        <div>
          <h2>Recent Jobs</h2>
          {jobs.slice(0, 10).map((job) => (
            <JobCard key={job._id || job.id} job={job} />
          ))}
        </div>
        <div>
          <h2>Active Workers</h2>
          {workers.slice(0, 10).map((worker) => (
            <WorkerCard key={worker.workerId} worker={worker} />
          ))}
        </div>
      </div>
    </section>
  );
}

export default Dashboard;
