import { useState } from 'react';
import AssistantPanel from './components/AssistantPanel';
import DashboardSection from './components/DashboardSection';

const createAiResponse = (promptText) => ({
  summary: `The current signal suggests "${promptText}" is tied to a performance gap that deserves immediate review before it spreads across the rest of the operation.`,
  why: [
    'Line B is likely dragging down total OEE because one asset group is underperforming versus the rest of the plant.',
    'Short-duration stops or slower cycle times often create this pattern when availability and performance both soften together.',
  ],
  actions: [
    'Inspect the lowest-performing line for repeated stops, changeover delays, or staffing friction in the last 24 to 48 hours.',
    'Compare the line against the previous week to confirm whether this is a new issue or an existing trend getting worse.',
  ],
});

function App() {
  const [showAssistantPanel, setShowAssistantPanel] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [mode, setMode] = useState('q');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const runMockAi = (promptText) => {
    setIsAiLoading(true);

    // API Gateway / Bedrock invocation will be wired in here later.
    window.setTimeout(() => {
      const response = {
        id: Date.now() + 1,
        role: 'assistant',
        type: 'ai',
        content: createAiResponse(promptText),
      };

      setMessages((currentMessages) => [...currentMessages, response]);
      setIsAiLoading(false);
    }, 900);
  };

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
    runMockAi(trimmedPrompt);
  };

  const handleExplainWithAi = () => {
    if (isAiLoading) {
      return;
    }

    setMode('ai');
    setAiInput('Explain the current trend for OEE and suggest next actions.');
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
