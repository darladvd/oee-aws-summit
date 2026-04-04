import ChatbotSection from './ChatbotSection';
import QSection from './QSection';

function AssistantPanel({
  isOpen,
  onClose,
  qQuestion,
  onQuestionChange,
  onAskQ,
  qResult,
  onExplainWithAi,
  onAskAiDirectly,
  showAiExplanation,
  onCloseAiExplanation,
  aiInput,
  onAiInputChange,
  onAskAi,
  onRegenerate,
  chatMessages,
  isLoading,
}) {
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
            <div>
              <p className="assistant-kicker">QuickSight Ask Experience</p>
              <h2>Ask a question</h2>
            </div>
            <button className="icon-button" type="button" onClick={onClose} aria-label="Close assistant panel">
              Close
            </button>
          </div>

          <div className="assistant-shell-body">
            <QSection
              qQuestion={qQuestion}
              onQuestionChange={onQuestionChange}
              onAskQ={onAskQ}
              qResult={qResult}
              onExplainWithAi={onExplainWithAi}
              onAskAiDirectly={onAskAiDirectly}
              compact
            />

            {showAiExplanation && (
              <ChatbotSection
                onClosePanel={onCloseAiExplanation}
                aiInput={aiInput}
                onAiInputChange={onAiInputChange}
                onAskAi={onAskAi}
                onRegenerate={onRegenerate}
                chatMessages={chatMessages}
                isLoading={isLoading}
                qResult={qResult}
              />
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

export default AssistantPanel;
