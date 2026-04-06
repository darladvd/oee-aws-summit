import GenQaEmbed from './GenQaEmbed';

function QModeView({
  qEmbedUrl,
  qEmbedError,
  lastQQuestionToExplain,
  onLastQQuestionToExplainChange,
  onExplainWithAi,
}) {
  return (
    <div className="assistant-mode-view q-mode-view">
      <p className="q-mode-note">
        Ask natural-language questions about your dashboard data.
      </p>

      <input
        className="text-input q-context-input"
        type="text"
        value={lastQQuestionToExplain}
        onChange={(event) => onLastQQuestionToExplainChange(event.target.value)}
        placeholder="Question to explain"
      />

      <section className="genqa-shell">
        {qEmbedUrl ? (
          <GenQaEmbed embedUrl={qEmbedUrl} />
        ) : (
          <div className="genqa-placeholder">
            <p>{qEmbedError || 'Loading QuickSight Q...'}</p>
          </div>
        )}
      </section>

      <div className="q-mode-actions">
        <button
          className="secondary-button"
          type="button"
          onClick={onExplainWithAi}
        >
          Open in AI Insights
        </button>
      </div>
    </div>
  );
}

export default QModeView;
