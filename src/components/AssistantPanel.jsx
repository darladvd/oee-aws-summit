import { useEffect, useRef } from 'react';
import { useState } from 'react';
import GenQaEmbed from './GenQaEmbed';

function AssistantPanel({
  isOpen,
  onClose,
  inputValue,
  onInputChange,
  onAsk,
  messages,
  hasQResult,
  showAiExplanation,
  onExplainWithAi,
  onCloseAiExplanation,
  mode,
  onModeChange,
  isLoading,
}) {
  const hasInput = inputValue.trim() !== '';
  const inputRef = useRef(null);
  const [qEmbedUrl, setQEmbedUrl] = useState(null);
  const [qEmbedError, setQEmbedError] = useState('');

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    let active = true;

    async function fetchQUrl() {
      if (!isOpen || mode !== 'q' || qEmbedUrl) {
        return;
      }

      try {
        setQEmbedError('');
        const response = await fetch('/api/quicksight/q-url');
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }

        const data = await response.json();
        if (active) {
          setQEmbedUrl(data.embedUrl);
        }
      } catch (error) {
        console.error('Failed to fetch QuickSight Q embed URL:', error);
        if (active) {
          setQEmbedError('Unable to load QuickSight Q.');
        }
      }
    }

    fetchQUrl();

    return () => {
      active = false;
    };
  }, [isOpen, mode, qEmbedUrl]);

  return (
    <>
      <div
        className={`assistant-backdrop ${isOpen ? 'assistant-backdrop-open' : ''}`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      <aside className={`assistant-drawer ${isOpen ? 'assistant-drawer-open' : ''}`}>
        <div className="assistant-shell">
          <div className="assistant-shell-header">
            <h2>Ask a question</h2>
            <button className="icon-button" type="button" onClick={onClose} aria-label="Close assistant panel">
              Close
            </button>
          </div>

          <div className="assistant-shell-body">
            {mode === 'q' && (
              <section className="genqa-shell">
                {qEmbedUrl ? (
                  <GenQaEmbed embedUrl={qEmbedUrl} />
                ) : (
                  <div className="genqa-placeholder">
                    <p>{qEmbedError || 'Loading QuickSight Q...'}</p>
                  </div>
                )}
              </section>
            )}

            <section className="assistant-conversation">
              {messages.map((message, index) => (
                <div
                  key={message.id}
                  className={`chat-row ${message.role === 'user' ? 'chat-row-user' : 'chat-row-ai'}`}
                >
                  <article
                    className={`message-bubble ${
                      message.role === 'user' ? 'user-bubble' : 'ai-bubble'
                    }`}
                  >
                    {message.type === 'text' && <p>{message.content}</p>}

                    {message.type === 'q' && (
                      <div className="structured-response">
                        <p className="response-title">QuickSight Q</p>
                        <p>{message.content.answer}</p>
                        <p className="result-copy assistant-result-copy">{message.content.insight}</p>
                        {!showAiExplanation && hasQResult && index === messages.length - 1 && (
                          <button
                            className="secondary-button inline-action-button"
                            type="button"
                            onClick={onExplainWithAi}
                          >
                            Explain with AI
                          </button>
                        )}
                      </div>
                    )}

                    {message.type === 'ai' && (
                      <div className="structured-response">
                        <div className="assistant-inline-header">
                          <p className="response-title">AI Explanation</p>
                          {showAiExplanation && mode === 'q' && index === messages.length - 1 && (
                            <button
                              className="icon-button inline-icon-button"
                              type="button"
                              onClick={onCloseAiExplanation}
                            >
                              Hide
                            </button>
                          )}
                        </div>
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
                    <p>Generating response...</p>
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
                  value={inputValue}
                  onChange={(event) => onInputChange(event.target.value)}
                  placeholder="Ask about your data..."
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      onAsk();
                    }
                  }}
                />
                <div className="assistant-action-stack">
                  <div className="mode-toggle" role="tablist" aria-label="Assistant mode">
                    <button
                    className={`mode-toggle-option ${mode === 'q' ? 'mode-toggle-option-active' : ''}`}
                    type="button"
                    onClick={() => onModeChange('q')}
                    disabled={isLoading}
                    aria-pressed={mode === 'q'}
                    title="Data (QuickSight Q)"
                  >
                    Q
                  </button>
                  <button
                    className={`mode-toggle-option ${mode === 'ai' ? 'mode-toggle-option-active' : ''}`}
                    type="button"
                    onClick={() => onModeChange('ai')}
                    disabled={isLoading}
                    aria-pressed={mode === 'ai'}
                    title="AI reasoning (Bedrock)"
                  >
                    AI
                  </button>
                  </div>

                  <button
                    className={`primary-button assistant-ask-button ${
                      mode === 'ai' ? 'primary-button-ai' : ''
                    }`}
                    type="button"
                    onClick={onAsk}
                    disabled={!hasInput || isLoading}
                  >
                    Ask
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export default AssistantPanel;
