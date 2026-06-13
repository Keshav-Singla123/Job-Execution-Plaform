import { useEffect } from "react";
import WorkerCard from "../components/WorkerCard.jsx";
import useJobStore from "../store/useJobStore.js";

function Workers() {
  const { workers, fetchWorkers } = useJobStore();

  useEffect(() => {
    async function loadData() {
      try {
        await fetchWorkers();
      } catch (error) {
        console.error("Workers load failed:", error.message);
      }
    }

    loadData();
  }, [fetchWorkers]);

  return (
    <section>
      <div className="section-header">
        <h1>Workers</h1>
        <p>Heartbeat status from distributed worker processes.</p>
      </div>
      <div className="card-grid">
        {workers.map((worker) => (
          <WorkerCard key={worker.workerId} worker={worker} />
        ))}
      </div>
    </section>
  );
}

export default Workers;
