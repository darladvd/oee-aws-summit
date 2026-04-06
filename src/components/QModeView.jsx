import GenQaEmbed from './GenQaEmbed';

function QModeView({
  qEmbedUrl,
  qEmbedError,
}) {
  return (
    <div className="assistant-mode-view q-mode-view">
      <p className="q-mode-note">
        Ask natural-language questions about your dashboard data.
      </p>

      <section className="genqa-shell">
        {qEmbedUrl ? (
          <GenQaEmbed embedUrl={qEmbedUrl} />
        ) : (
          <div className="genqa-placeholder">
            <p>{qEmbedError || 'Loading QuickSight Q...'}</p>
          </div>
        )}
      </section>
    </div>
  );
}

export default QModeView;
