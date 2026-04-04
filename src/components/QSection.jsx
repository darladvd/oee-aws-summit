function QSection({
  qQuestion,
  onQuestionChange,
  onAskQ,
  qResult,
  onExplainWithAi,
  onAskAiDirectly,
  compact = false,
}) {
  return (
    <section className={`card section-card compact-card q-card ${compact ? 'q-card-drawer' : ''}`}>
      <div className="section-heading">
        <h2>Ask Questions (QuickSight Q)</h2>
        <p>Start with natural language exploration, then hand the result to Bedrock for explanation.</p>
      </div>

      <div className="q-layout">
        <label className="input-label" htmlFor="q-input">
          Question
        </label>
        <div className="q-input-row">
          <input
            id="q-input"
            className="text-input"
            type="text"
            value={qQuestion}
            onChange={(event) => onQuestionChange(event.target.value)}
            placeholder="e.g. Which line has the lowest OEE this week?"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                onAskQ();
              }
            }}
          />
          <button className="primary-button q-button" type="button" onClick={onAskQ}>
            Ask Q
          </button>
        </div>

        <div className="q-result">
          {qResult ? (
            <div className="q-result-content">
              <div className="q-result-header">
                <p className="result-label">Mock Result</p>
                <span className="result-status">Q response ready</span>
              </div>
              <p className="result-question">{qResult.question}</p>
              <p className="result-answer">{qResult.answer}</p>
              <p className="result-copy">{qResult.insight}</p>
            </div>
          ) : (
            <>
              <p className="result-label">Preview Result</p>
              <p className="result-copy">
                Ask a question to simulate a QuickSight Q result and unlock AI explanation.
              </p>
            </>
          )}
        </div>

        {qResult && (
          <button className="primary-button explain-button" type="button" onClick={onExplainWithAi}>
            Explain with AI
          </button>
        )}

        <div className="q-assist-row">
          <p className="q-assist-copy">Need a direct follow-up instead?</p>
          <button className="tertiary-button" type="button" onClick={onAskAiDirectly}>
            Ask AI directly
          </button>
        </div>
      </div>
    </section>
  );
}

export default QSection;
