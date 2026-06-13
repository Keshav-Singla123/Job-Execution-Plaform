function ProgressBar({ value }) {
  const progress = Math.min(Math.max(Number(value || 0), 0), 100);
  const colorClass =
    progress >= 100 ? "progress-fill-complete" : "progress-fill-active";

  return (
    <div className="progress-track" aria-label={`Progress ${progress}%`}>
      <div
        className={`progress-fill ${colorClass}`}
        style={{ width: `${progress}%` }}
      />
      <div className="progress-text">{progress}%</div>
    </div>
  );
}

export default ProgressBar;
