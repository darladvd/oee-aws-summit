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
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState([]);
  const [hasQResult, setHasQResult] = useState(false);
  const [showAiExplanation, setShowAiExplanation] = useState(false);
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

  const handleAskQ = () => {
    const trimmedQuestion = inputValue.trim();
    if (!trimmedQuestion || isAiLoading) {
      return;
    }

    setMode('q');
    setHasQResult(true);
    setShowAiExplanation(false);
    setMessages([
      {
        id: Date.now(),
        role: 'user',
        type: 'text',
        content: trimmedQuestion,
      },
      {
        id: Date.now() + 1,
        role: 'assistant',
        type: 'q',
        content: {
          answer: 'Line B has the lowest OEE this week.',
          insight:
            'Line B is underperforming relative to the rest of the plant and should be reviewed first.',
        },
      },
    ]);
    setInputValue('');
  };

  const handleExplainWithAi = () => {
    const latestQMessage = [...messages].reverse().find((message) => message.type === 'q');
    if (!latestQMessage || isAiLoading) {
      return;
    }

    const promptText = `Explain this QuickSight Q result: ${latestQMessage.content.answer} What likely caused it, and what should the team do next?`;

    setMode('q');
    setShowAiExplanation(true);
    setMessages((currentMessages) => [
      ...currentMessages,
      {
        id: Date.now(),
        role: 'user',
        type: 'text',
        content: promptText,
      },
    ]);
    runMockAi(promptText);
  };

  const handleAskAiDirectly = () => {
    if (isAiLoading) {
      return;
    }

    const promptText =
      inputValue.trim() ||
      'Explain what operational issues could cause one production line to have the lowest OEE this week.';

    setMode('ai');
    setHasQResult(false);
    setShowAiExplanation(true);
    setMessages([
      {
        id: Date.now(),
        role: 'user',
        type: 'text',
        content: promptText,
      },
    ]);
    setInputValue('');
    runMockAi(promptText);
  };

  const handleAsk = () => {
    if (mode === 'ai') {
      handleAskAiDirectly();
      return;
    }

    handleAskQ();
  };

  const handleCloseAssistantPanel = () => {
    setShowAssistantPanel(false);
    setInputValue('');
    setMessages([]);
    setHasQResult(false);
    setShowAiExplanation(false);
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
        inputValue={inputValue}
        onInputChange={setInputValue}
        onAsk={handleAsk}
        messages={messages}
        hasQResult={hasQResult}
        showAiExplanation={showAiExplanation}
        onExplainWithAi={handleExplainWithAi}
        onCloseAiExplanation={() => setShowAiExplanation(false)}
        mode={mode}
        onModeChange={setMode}
        isLoading={isAiLoading}
      />
    </div>
  );
}

export default App;
