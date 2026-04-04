function ChatbotSection({
  onClosePanel,
  aiInput,
  onAiInputChange,
  onAskAi,
  onRegenerate,
  chatMessages,
  isLoading,
  qResult,
}) {
  const canSubmit = aiInput.trim().length > 0 && !isLoading;

  return (
    <section className="card section-card compact-card chatbot-card assistant-panel ai-panel-enter">
      <div className="assistant-panel-header">
        <div className="section-heading assistant-heading">
          <h2>AI Explanation (Bedrock)</h2>
          <p>
            {qResult
              ? 'Contextual explanation for the latest QuickSight Q result.'
              : 'Ask follow-up questions directly when you want narrative guidance.'}
          </p>
        </div>
        <button className="icon-button" type="button" onClick={onClosePanel} aria-label="Close AI panel">
          Collapse
        </button>
      </div>

      <div className="chat-history">
        {chatMessages.length === 0 && !isLoading && (
          <div className="chat-row chat-row-ai">
            <article className="message-bubble ai-bubble">
              <div className="structured-response">
                <p className="response-title">Ready</p>
                <p>
                  Opened in direct ask mode. Enter a question below to generate an explanation,
                  likely causes, and recommended next steps.
                </p>
              </div>
            </article>
          </div>
        )}

        {chatMessages.map((message) => (
          <div
            key={message.id}
            className={`chat-row ${message.role === 'user' ? 'chat-row-user' : 'chat-row-ai'}`}
          >
            <article
              className={`message-bubble ${
                message.role === 'user' ? 'user-bubble' : 'ai-bubble'
              }`}
            >
              {message.type === 'text' ? (
                <p>{message.content}</p>
              ) : (
                <div className="structured-response">
                  <p className="response-title">Summary</p>
                  <p>{message.content.summary}</p>

                  <p className="response-title">Why</p>
                  <ul>
                    {message.content.why.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>

                  <p className="response-title">Actions</p>
                  <ul>
                    {message.content.actions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          </div>
        ))}

        {isLoading && (
          <div className="chat-row chat-row-ai">
            <article className="message-bubble ai-bubble loading-bubble">
              <p>Generating explanation...</p>
            </article>
          </div>
        )}
      </div>

      <div className="chat-controls">
        <input
          className="text-input"
          type="text"
          value={aiInput}
          onChange={(event) => onAiInputChange(event.target.value)}
          placeholder="Ask about trends, anomalies, or KPI drivers..."
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              onAskAi();
            }
          }}
        />

        <div className="button-row">
          <button className="primary-button" type="button" onClick={onAskAi} disabled={!canSubmit}>
            Ask AI
          </button>
          <button className="secondary-button" type="button" onClick={onRegenerate} disabled={isLoading}>
            Regenerate
          </button>
        </div>
      </div>
    </section>
  );
}

export default ChatbotSection;
