import { useState } from 'react';
import AssistantPanel from './components/AssistantPanel';
import DashboardSection from './components/DashboardSection';
import { callAiInsights } from './lib/aiInsights';
import { buildAiPrefillQuestion, mergeContext, parseQuestionContext } from './lib/aiContext';

function App() {
  const [showAssistantPanel, setShowAssistantPanel] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [mode, setMode] = useState('q');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [selectedContext, setSelectedContext] = useState({});

  const handleAskAi = () => {
    const trimmedPrompt = aiInput.trim();
    if (!trimmedPrompt || isAiLoading) {
      return;
    }

    const userMessage = {
      id: Date.now(),
      role: 'user',
      type: 'text',
      content: trimmedPrompt,
    };

    setMessages((currentMessages) => [
      ...currentMessages,
      userMessage,
    ]);
    setAiInput('');
    setIsAiLoading(true);
    const nextContext = mergeContext(
      selectedContext,
      parseQuestionContext(trimmedPrompt, selectedContext?.source || 'app'),
      selectedContext?.source || 'app',
    );
    setSelectedContext(nextContext);

    callAiInsights({
      userQuestion: trimmedPrompt,
      selectedContext: nextContext,
    })
      .then((response) => {
        setMessages((currentMessages) => [
          ...currentMessages,
          {
            id: Date.now() + 1,
            role: 'assistant',
            type: 'ai',
            content: {
              summary: response.summary,
              why: Array.isArray(response.why) ? response.why : [],
              actions: Array.isArray(response.actions) ? response.actions : [],
              grounding_note: response.grounding_note || '',
            },
          },
        ]);
      })
      .catch((error) => {
        console.error('Failed to generate AI insights:', error);
        console.info('Athena grounding may have been skipped because dashboard_context was incomplete.');
        setMessages((currentMessages) => [
          ...currentMessages,
          {
            id: Date.now() + 1,
            role: 'assistant',
            type: 'assistant-text',
            content: 'I couldn’t generate AI insights right now. Please check the AI payload or Lambda response.',
          },
        ]);
      })
      .finally(() => {
        setIsAiLoading(false);
      });
  };

  const handleExplainWithAi = () => {
    if (isAiLoading) {
      return;
    }

    const nextPrompt = buildAiPrefillQuestion();
    const nextContext = mergeContext(selectedContext, {}, 'quicksight-q');

    setSelectedContext(nextContext);
    setMode('ai');
    setAiInput(nextPrompt);
  };

  const handleCloseAssistantPanel = () => {
    setShowAssistantPanel(false);
    setAiInput('');
    setMessages([]);
    setMode('q');
    setIsAiLoading(false);
    setSelectedContext({});
  };

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-row">
          <div>
            <h1>OEE Performance Dashboard</h1>
            <p className="subtitle">QuickSight + Bedrock Demo</p>
          </div>
          <button className="ask-trigger" type="button" onClick={() => setShowAssistantPanel(true)}>
            Ask a question
          </button>
        </div>
      </header>

      <main className="dashboard-layout">
        <DashboardSection />
      </main>

      <AssistantPanel
        isOpen={showAssistantPanel}
        onClose={handleCloseAssistantPanel}
        aiInput={aiInput}
        onAiInputChange={setAiInput}
        onAskAi={handleAskAi}
        onExplainWithAi={handleExplainWithAi}
        messages={messages}
        mode={mode}
        onModeChange={setMode}
        isLoading={isAiLoading}
      />
    </div>
  );
}

export default App;
