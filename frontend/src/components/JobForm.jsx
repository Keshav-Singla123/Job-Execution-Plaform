import { useState } from "react";
import toast from "react-hot-toast";
import { Play } from "lucide-react";
import useJobStore from "../store/useJobStore.js";

function JobForm() {
  const submitJob = useJobStore((state) => state.submitJob);
  const [name, setName] = useState("");
  const [payload, setPayload] = useState('{"message":"hello"}');
  const [priority, setPriority] = useState(5);
  const [maxRetries, setMaxRetries] = useState(3);
  const [delayMinutes, setDelayMinutes] = useState("0");
  const [scheduledFor, setScheduledFor] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      const parsedPayload = JSON.parse(payload || "{}");
      const delayMs =
        Number(delayMinutes || 0) > 0 ? Number(delayMinutes) * 60 * 1000 : 0;
      const payloadData = {
        name,
        payload: parsedPayload,
        priority: Number(priority),
        maxRetries: Number(maxRetries),
        delayMs,
        scheduledFor: scheduledFor || null,
      };

      await submitJob({
        ...payloadData,
      });
      setName("");
      toast.success("Job queued.");
    } catch (error) {
      toast.error(error.message || "Invalid payload");
    }
  }

  return (
    <form className="panel" onSubmit={handleSubmit}>
      <h3>Submit New Job</h3>
      <div className="field">
        <label htmlFor="job-name">Job Name</label>
        <input
          id="job-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="job-payload">Payload (JSON)</label>
        <textarea
          id="job-payload"
          value={payload}
          onChange={(event) => setPayload(event.target.value)}
          rows="6"
        />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="job-priority">Priority</label>
          <select
            id="job-priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            <option value={10}>Critical</option>
            <option value={5}>High</option>
            <option value={3}>Normal</option>
            <option value={1}>Low</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="job-retries">Max Retries</label>
          <input
            id="job-retries"
            type="number"
            min="0"
            value={maxRetries}
            onChange={(e) => setMaxRetries(e.target.value)}
          />
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor="job-delay">Delay (minutes)</label>
          <input
            id="job-delay"
            type="number"
            min="0"
            step="1"
            value={delayMinutes}
            onChange={(e) => setDelayMinutes(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="job-scheduled-for">Run At</label>
          <input
            id="job-scheduled-for"
            type="datetime-local"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
          />
        </div>
      </div>

      <button className="primary-button" type="submit">
        <Play size={16} />
        Submit Job
      </button>

      <p className="form-hint">
        Leave delay and run-at empty/zero to execute immediately. Use either one
        to schedule a job.
      </p>
    </form>
  );
}

export default JobForm;
