import { useEffect, useRef, useState } from 'react';
import AIModeView from './AIModeView';
import QModeView from './QModeView';

function AssistantPanel({
  isOpen,
  onClose,
  aiInput,
  onAiInputChange,
  onAskAi,
  messages,
  mode,
  onModeChange,
  isLoading,
}) {
  const inputRef = useRef(null);
  const [qEmbedUrl, setQEmbedUrl] = useState(null);
  const [qEmbedError, setQEmbedError] = useState('');

  useEffect(() => {
    if (isOpen && mode === 'ai' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, mode]);

  useEffect(() => {
    let active = true;

    async function fetchQUrl() {
      if (!isOpen || qEmbedUrl) {
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
  }, [isOpen, qEmbedUrl]);

  useEffect(() => {
    if (!isOpen) {
      setQEmbedUrl(null);
      setQEmbedError('');
    }
  }, [isOpen]);

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
            <div className="assistant-mode-bar">
              <div className="mode-toggle" role="tablist" aria-label="Assistant mode">
                <button
                  className={`mode-toggle-option ${mode === 'q' ? 'mode-toggle-option-active' : ''}`}
                  type="button"
                  onClick={() => onModeChange('q')}
                  disabled={isLoading}
                  aria-pressed={mode === 'q'}
                  title="Data (QuickSight Q)"
                >
                  Data Q&A
                </button>
                <button
                  className={`mode-toggle-option ${mode === 'ai' ? 'mode-toggle-option-active' : ''}`}
                  type="button"
                  onClick={() => onModeChange('ai')}
                  disabled={isLoading}
                  aria-pressed={mode === 'ai'}
                  title="AI reasoning (Bedrock)"
                >
                  AI Insights
                </button>
              </div>
            </div>

            <div className={`assistant-tab-panel ${mode === 'q' ? 'assistant-tab-panel-active' : 'assistant-tab-panel-hidden'}`}>
              <QModeView
                qEmbedUrl={qEmbedUrl}
                qEmbedError={qEmbedError}
              />
            </div>

            <div className={`assistant-tab-panel ${mode === 'ai' ? 'assistant-tab-panel-active' : 'assistant-tab-panel-hidden'}`}>
              <AIModeView
                aiInput={aiInput}
                onAiInputChange={onAiInputChange}
                onAskAi={onAskAi}
                messages={messages}
                isLoading={isLoading}
                inputRef={inputRef}
              />
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export default AssistantPanel;
