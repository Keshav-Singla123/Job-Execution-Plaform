import { Cpu } from "lucide-react";

function WorkerCard({ worker }) {
  const last =
    worker.lastHeartbeat || worker.lastHeartbeatAt || worker.updatedAt;
  const lastMs = last ? new Date(last).getTime() : 0;
  const ageSec = last ? Math.round((Date.now() - lastMs) / 1000) : null;
  const offline = ageSec !== null && ageSec > 30;

  const statusClass =
    worker.status === "busy"
      ? "status-yellow"
      : worker.status === "idle"
        ? "status-green"
        : "status-grey";

  return (
    <article className={`card ${offline ? "offline" : ""}`}>
      <div className="card-header">
        <div>
          <h3>{worker.name}</h3>
          <p className="muted">{worker.workerId}</p>
        </div>
        <span className={`status ${statusClass}`}>
          <Cpu size={16} />
          {offline ? "offline" : worker.status}
        </span>
      </div>
      <p>Concurrency: {worker.concurrency}</p>
      <p>Last seen: {ageSec !== null ? `${ageSec}s ago` : "Unknown"}</p>
      <p>
        Completed: {worker.jobsCompleted || 0} • Failed:{" "}
        {worker.jobsFailed || 0}
      </p>
      <p>Current job: {worker.currentJobId || "—"}</p>
    </article>
  );
}

export default WorkerCard;
