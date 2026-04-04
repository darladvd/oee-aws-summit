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
  const [qQuestion, setQQuestion] = useState('');
  const [qResult, setQResult] = useState(null);
  const [showAiExplanation, setShowAiExplanation] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [chatMessages, setChatMessages] = useState([]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  const runMockAi = (promptText) => {
    setIsAiLoading(true);

    // API Gateway / Bedrock invocation will be wired in here later.
    window.setTimeout(() => {
      const response = {
        id: Date.now() + 1,
        role: 'ai',
        type: 'structured',
        content: createAiResponse(promptText),
      };

      setChatMessages((currentMessages) => [...currentMessages, response]);
      setIsAiLoading(false);
    }, 900);
  };

  const handleAskQ = () => {
    const trimmedQuestion = qQuestion.trim();
    if (!trimmedQuestion) {
      return;
    }

    setShowAiExplanation(false);
    setChatMessages([]);
    setAiInput('');
    setQResult({
      question: trimmedQuestion,
      answer: 'Line B has the lowest OEE this week.',
      insight:
        'Line B is underperforming relative to the rest of the plant and should be reviewed first.',
    });
  };

  const openAiPanelForPrompt = (promptText, options = {}) => {
    const { autoRespond = false } = options;
    setShowAiExplanation(true);
    setAiInput(promptText);

    if (!autoRespond) {
      return;
    }

    const userMessage = {
      id: Date.now(),
      role: 'user',
      type: 'text',
      content: promptText,
    };

    setChatMessages([userMessage]);
    runMockAi(promptText);
  };

  const handleExplainWithAi = () => {
    if (!qResult || isAiLoading) {
      return;
    }

    const promptText = `Explain this QuickSight Q result: ${qResult.answer} What likely caused it, and what should the team do next?`;
    openAiPanelForPrompt(promptText, { autoRespond: true });
  };

  const handleAskAiDirectly = () => {
    if (isAiLoading) {
      return;
    }

    const promptText = qResult
      ? `Help me understand this result: ${qResult.answer}`
      : 'Explain what operational issues could cause one production line to have the lowest OEE this week.';

    openAiPanelForPrompt(promptText);
  };

  const handleCloseAssistantPanel = () => {
    setShowAssistantPanel(false);
    setShowAiExplanation(false);
    setQQuestion('');
    setQResult(null);
    setAiInput('');
    setChatMessages([]);
    setIsAiLoading(false);
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

    setChatMessages((currentMessages) => [...currentMessages, userMessage]);
    runMockAi(trimmedPrompt);
    setAiInput('');
  };

  const handleRegenerate = () => {
    if (isAiLoading || chatMessages.length === 0) {
      return;
    }

    const lastUserMessage = [...chatMessages]
      .reverse()
      .find((message) => message.role === 'user' && message.type === 'text');

    if (!lastUserMessage) {
      return;
    }

    runMockAi(lastUserMessage.content);
  };

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-row">
          <div>
            <h1>OEE Performance Dashboard</h1>
            <p className="subtitle">QuickSight + Bedrock Demo</p>
          </div>
          <button
            className="ask-trigger"
            type="button"
            onClick={() => setShowAssistantPanel(true)}
          >
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
        qQuestion={qQuestion}
        onQuestionChange={setQQuestion}
        onAskQ={handleAskQ}
        qResult={qResult}
        onExplainWithAi={handleExplainWithAi}
        onAskAiDirectly={handleAskAiDirectly}
        showAiExplanation={showAiExplanation}
        onCloseAiExplanation={() => setShowAiExplanation(false)}
        aiInput={aiInput}
        onAiInputChange={setAiInput}
        onAskAi={handleAskAi}
        onRegenerate={handleRegenerate}
        chatMessages={chatMessages}
        isLoading={isAiLoading}
      />
    </div>
  );
}

export default App;
