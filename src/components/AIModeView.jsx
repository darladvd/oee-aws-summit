function AIModeView({
  aiInput,
  onAiInputChange,
  onAskAi,
  messages,
  isLoading,
  inputRef,
}) {
  const hasInput = aiInput.trim() !== '';

  return (
    <div className="assistant-mode-view ai-mode-view">
      <p className="ai-mode-note">
        Ask AI to explain trends, anomalies, and recommended next actions from your dashboard context.
      </p>

      <section className="assistant-conversation">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`chat-row ${message.role === 'user' ? 'chat-row-user' : 'chat-row-ai'}`}
          >
            <article
              className={`message-bubble ${
                message.role === 'user' ? 'user-bubble' : 'ai-bubble'
              }`}
            >
              {(message.type === 'text' || message.type === 'assistant-text') && <p>{message.content}</p>}

              {message.type === 'ai' && (
                <div className="structured-response">
                  {message.content.intent && (
                    <p className="intent-line">
                      I understood: {[
                        message.content.intent.entities?.length > 0
                          ? message.content.intent.entities.map((e) => e.name).join(' vs ')
                          : null,
                        message.content.intent.kpi,
                        message.content.intent.time_range,
                      ].filter(Boolean).join(' · ') || 'general question'}
                    </p>
                  )}

                  <p className="response-title">AI Explanation</p>
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

                  {message.content.grounding_note && (
                    <p className="grounding-note">{message.content.grounding_note}</p>
                  )}
                </div>
              )}
            </article>
          </div>
        ))}

        {isLoading && (
          <div className="chat-row chat-row-ai">
            <article className="message-bubble ai-bubble loading-bubble">
              <p>Generating AI insights...</p>
            </article>
          </div>
        )}
      </section>

      <div className="assistant-input-area">
        <div className="assistant-input-row">
          <input
            ref={inputRef}
            className="text-input"
            type="text"
            value={aiInput}
            onChange={(event) => onAiInputChange(event.target.value)}
            placeholder="Ask AI to explain trends, anomalies, or next actions..."
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                onAskAi();
              }
            }}
          />
          <button className="primary-button assistant-ask-button" type="button" onClick={onAskAi} disabled={!hasInput || isLoading}>
            Ask
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIModeView;
