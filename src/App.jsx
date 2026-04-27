import { useState } from 'react';
import AssistantPanel from './components/AssistantPanel';
import DashboardSection from './components/DashboardSection';
import { callAiInsights } from './lib/aiInsights';

function App() {
  const [showAssistantPanel, setShowAssistantPanel] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [mode, setMode] = useState('q');
  const [isAiLoading, setIsAiLoading] = useState(false);

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

    setMessages((currentMessages) => [...currentMessages, userMessage]);
    setAiInput('');
    setIsAiLoading(true);

    callAiInsights({ userQuestion: trimmedPrompt })
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
              intent: response.intent || null,
            },
          },
        ]);
      })
      .catch((error) => {
        console.error('Failed to generate AI insights:', error);
        setMessages((currentMessages) => [
          ...currentMessages,
          {
            id: Date.now() + 1,
            role: 'assistant',
            type: 'assistant-text',
            content: 'I couldn\'t generate AI insights right now. Please try again.',
          },
        ]);
      })
      .finally(() => {
        setIsAiLoading(false);
      });
  };

  const handleCloseAssistantPanel = () => {
    setShowAssistantPanel(false);
    setAiInput('');
    setMessages([]);
    setMode('q');
    setIsAiLoading(false);
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
        messages={messages}
        mode={mode}
        onModeChange={setMode}
        isLoading={isAiLoading}
      />
    </div>
  );
}

export default App;
