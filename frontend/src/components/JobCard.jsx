import {
  Play,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Trash2,
  Ban,
} from "lucide-react";
import { toast } from "react-hot-toast";
import useJobStore from "../store/useJobStore.js";
import ProgressBar from "./ProgressBar.jsx";

const statusMap = {
  pending: { color: "grey", label: "pending" },
  scheduled: { color: "purple", label: "scheduled" },
  queued: { color: "blue", label: "queued" },
  running: { color: "yellow", label: "running" },
  completed: { color: "green", label: "completed" },
  failed: { color: "red", label: "failed" },
  retrying: { color: "orange", label: "retrying" },
  cancelled: { color: "grey", label: "cancelled" },
};

function JobCard({ job }) {
  const status = statusMap[job.status] || statusMap.pending;
  const cancelJob = useJobStore((state) => state.cancelJob);
  const retryJob = useJobStore((state) => state.retryJob);
  const deleteJob = useJobStore((state) => state.deleteJob);

  const jobId = job._id || job.id;
  const canCancel = ["pending", "scheduled", "queued"].includes(job.status);
  const canRetry = ["failed", "cancelled"].includes(job.status);
  const canDelete = ["completed", "failed", "cancelled"].includes(job.status);

  const handleDelete = () => {
    toast.custom((t) => (
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #dde3ee",
          borderRadius: 12,
          boxShadow: "0 12px 32px rgba(23, 32, 51, 0.12)",
          maxWidth: 340,
          padding: 16,
        }}
      >
        <strong>Delete this job?</strong>
        <p style={{ color: "#617089", margin: "8px 0 12px" }}>
          This action will permanently remove the job from the dashboard.
        </p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            className="ghost-button"
            style={{ width: "auto", padding: "8px 12px" }}
            onClick={() => toast.dismiss(t.id)}
          >
            Cancel
          </button>
          <button
            className="danger-button"
            style={{ width: "auto", padding: "8px 12px" }}
            onClick={async () => {
              toast.dismiss(t.id);
              try {
                await deleteJob(jobId);
                toast.success("Job deleted");
              } catch (error) {
                toast.error(error.message || "Delete failed");
              }
            }}
          >
            Delete
          </button>
        </div>
      </div>
    ));
  };

  return (
    <article className="card">
      <div className="card-header">
        <div>
          <h3>{job.name}</h3>
          <p className="muted">{job._id || job.id}</p>
        </div>
        <span className={`status status-${status.color}`}>
          {job.status === "completed" ? (
            <CheckCircle2 size={16} />
          ) : job.status === "failed" ? (
            <XCircle size={16} />
          ) : job.status === "retrying" ? (
            <RefreshCw size={16} />
          ) : (
            <Play size={16} />
          )}
          {status.label}
        </span>
      </div>

      {(job.status === "running" ||
        job.status === "retrying" ||
        job.progress > 0) && <ProgressBar value={job.progress} />}

      <div className="card-body">
        <div className="meta">
          <span>Priority: {job.priority}</span>
          <span>Worker: {job.workerId || "—"}</span>
          <span>
            Scheduled:{" "}
            {job.scheduledFor
              ? new Date(job.scheduledFor).toLocaleString()
              : "—"}
          </span>
          <span>
            Started:{" "}
            {job.startedAt ? new Date(job.startedAt).toLocaleString() : "—"}
          </span>
        </div>

        {job.logs && job.logs.length > 0 && (
          <details>
            <summary>Logs ({job.logs.length})</summary>
            <ul className="job-logs">
              {job.logs.map((l, idx) => (
                <li key={idx}>
                  <small>{new Date(l.timestamp).toLocaleString()}</small> —{" "}
                  {l.message}
                </li>
              ))}
            </ul>
          </details>
        )}

        {job.error ? <p className="error-text">{job.error}</p> : null}

        {(canCancel || canRetry || canDelete) && (
          <div className="job-actions">
            {canCancel && (
              <button
                className="ghost-button"
                style={{ width: "auto" }}
                onClick={() => cancelJob(jobId)}
              >
                <Ban size={16} /> Cancel
              </button>
            )}
            {canRetry && (
              <button
                className="ghost-button"
                style={{ width: "auto" }}
                onClick={() => retryJob(jobId)}
              >
                <RefreshCw size={16} /> Retry
              </button>
            )}
            {canDelete && (
              <button
                className="danger-button"
                style={{ width: "auto" }}
                onClick={handleDelete}
              >
                <Trash2 size={16} /> Delete
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

export default JobCard;
