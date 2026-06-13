import { useEffect } from "react";
import JobCard from "../components/JobCard.jsx";
import JobForm from "../components/JobForm.jsx";
import useJobStore from "../store/useJobStore.js";

function Jobs() {
  const { jobs, fetchJobs } = useJobStore();

  useEffect(() => {
    async function loadData() {
      try {
        await fetchJobs();
      } catch (error) {
        console.error("Jobs load failed:", error.message);
      }
    }

    loadData();
  }, [fetchJobs]);

  return (
    <section className="content-grid">
      <div>
        <div className="section-header">
          <h1>Jobs</h1>
          <p>Create jobs and watch realtime progress.</p>
        </div>
        {jobs.map((job) => (
          <JobCard key={job._id || job.id} job={job} />
        ))}
      </div>
      <JobForm />
    </section>
  );
}

export default Jobs;
