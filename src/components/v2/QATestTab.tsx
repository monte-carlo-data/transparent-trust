'use client';

/**
 * QATestTab Component
 *
 * Simple Q&A testing interface for libraries.
 * Allows users to test how the Slack bot would respond to questions
 * using the library's skills. Also includes Slack bot configuration.
 */

import { useState, useCallback, useEffect } from 'react';
import { Send, Loader2, ChevronDown, ChevronUp, MessageCircleQuestion, Clock, Settings, AlertCircle, Check, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Answer {
  response: string;
  confidence: string | null;
  sources: string | null;
  reasoning: string | null;
  inference: string | null;
  remarks: string | null;
}

interface RecentQuestion {
  id: string;
  question: string;
  answer: Answer | null;
  createdAt: string;
}

interface QATestTabProps {
  libraryId: 'knowledge' | 'it' | 'gtm';
}

const confidenceColors: Record<string, string> = {
  High: 'bg-green-100 text-green-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  Low: 'bg-red-100 text-red-700',
};

interface SlackConnectionStatus {
  configured: boolean;
  connected: boolean;
  error?: string;
}

interface SlackChannelData {
  id: string;
  name: string;
}

export function QATestTab({ libraryId }: QATestTabProps) {
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState<Answer | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
  const [recentQuestions, setRecentQuestions] = useState<RecentQuestion[]>([]);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Slack configuration state
  const [slackExpanded, setSlackExpanded] = useState(false);
  const [slackStatus, setSlackStatus] = useState<SlackConnectionStatus | null>(null);
  const [slackLoading, setSlackLoading] = useState(false);
  const [slackError, setSlackError] = useState<string | null>(null);
  const [slackSuccess, setSlackSuccess] = useState<string | null>(null);
  const [botChannelInput, setBotChannelInput] = useState('');
  const [botChannelData, setBotChannelData] = useState<SlackChannelData[]>([]);
  const [savingBotChannel, setSavingBotChannel] = useState(false);
  const [ingestionChannelData, setIngestionChannelData] = useState<SlackChannelData[]>([]);
  const [restartingBot, setRestartingBot] = useState(false);

  // Load Slack status on mount
  useEffect(() => {
    const loadSlackStatus = async () => {
      try {
        const response = await fetch(`/api/v2/integrations/slack/status?libraryId=${libraryId}`);
        if (response.ok) {
          const data = await response.json();
          setSlackStatus(data.status);
          // Load bot channel data if configured
          if (data.botChannelData && data.botChannelData.length > 0) {
            setBotChannelData(data.botChannelData);
          }
          // Load ingestion channel data for reference
          if (data.selectedChannelData && data.selectedChannelData.length > 0) {
            setIngestionChannelData(data.selectedChannelData);
          }
        }
      } catch {
        // Silently fail - slack config is optional
      }
    };
    loadSlackStatus();
  }, [libraryId]);

  const handleTestSlackConnection = async () => {
    setSlackLoading(true);
    setSlackError(null);
    try {
      const response = await fetch(`/api/v2/integrations/slack/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ libraryId }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Connection test failed');
      }

      setSlackStatus(data.status);
      setSlackSuccess('Slack bot connection successful!');
      setTimeout(() => setSlackSuccess(null), 3000);
    } catch (err) {
      setSlackError(err instanceof Error ? err.message : 'Connection test failed');
    } finally {
      setSlackLoading(false);
    }
  };

  const handleSaveBotChannel = async () => {
    if (!botChannelInput.trim()) {
      setSlackError('Please enter a channel ID');
      return;
    }

    setSavingBotChannel(true);
    setSlackError(null);
    try {
      // First lookup the channel to get its name
      const lookupResponse = await fetch(
        `/api/slack/channels/lookup?name=${encodeURIComponent(botChannelInput.trim())}&libraryId=${libraryId}`
      );
      if (!lookupResponse.ok) {
        const errorData = await lookupResponse.json();
        throw new Error(errorData.error || 'Failed to find channel');
      }
      const lookupData = await lookupResponse.json();
      const channel = lookupData.channel;

      // Save the bot channel configuration (keep existing ingestion channels)
      const saveResponse = await fetch('/api/v2/integrations/slack/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          libraryId,
          channels: ingestionChannelData.length > 0 ? ingestionChannelData : [channel],
          botChannels: [channel],
        }),
      });
      if (!saveResponse.ok) {
        const errorData = await saveResponse.json();
        throw new Error(errorData.error || 'Failed to save bot channel');
      }

      setBotChannelData([channel]);
      setBotChannelInput('');
      setSlackSuccess('Bot response channel configured!');
      setTimeout(() => setSlackSuccess(null), 3000);
    } catch (err) {
      setSlackError(err instanceof Error ? err.message : 'Failed to configure bot channel');
    } finally {
      setSavingBotChannel(false);
    }
  };

  const handleClearBotChannel = async () => {
    setSavingBotChannel(true);
    setSlackError(null);
    try {
      // Save with empty botChannels to clear the override
      const saveResponse = await fetch('/api/v2/integrations/slack/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          libraryId,
          channels: ingestionChannelData,
          botChannels: [],
        }),
      });
      if (!saveResponse.ok) {
        const errorData = await saveResponse.json();
        throw new Error(errorData.error || 'Failed to clear bot channel');
      }

      setBotChannelData([]);
      setSlackSuccess('Bot channel cleared - will use ingestion channels');
      setTimeout(() => setSlackSuccess(null), 3000);
    } catch (err) {
      setSlackError(err instanceof Error ? err.message : 'Failed to clear bot channel');
    } finally {
      setSavingBotChannel(false);
    }
  };

  const handleRestartBot = async () => {
    setRestartingBot(true);
    setSlackError(null);
    try {
      const response = await fetch('/api/v2/integrations/slack/restart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ libraryId }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to restart bot');
      }

      setSlackSuccess('Bot restarted - new channel configuration applied');
      setTimeout(() => setSlackSuccess(null), 3000);
    } catch (err) {
      setSlackError(err instanceof Error ? err.message : 'Failed to restart bot');
    } finally {
      setRestartingBot(false);
    }
  };

  // Map library ID to API library parameter
  const getApiLibrary = (id: string): string => {
    switch (id) {
      case 'knowledge':
        return 'skills';
      case 'it':
        return 'it-skills';
      case 'gtm':
        return 'gtm';
      default:
        return 'skills';
    }
  };

  // Load question history from database on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const response = await fetch(`/api/v2/questions/history?status=all&limit=10`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.questions) {
            // Filter to only this library and map to RecentQuestion format
            const apiLibrary = getApiLibrary(libraryId);
            const filtered = data.data.questions
              .filter((q: { library: string }) => q.library === apiLibrary || q.library === libraryId)
              .slice(0, 5)
              .map((q: { id: string; question: string; response: string | null; confidence: string | null; createdAt: string }) => ({
                id: q.id,
                question: q.question,
                answer: q.response ? {
                  response: q.response,
                  confidence: q.confidence,
                  sources: null,
                  reasoning: null,
                  inference: null,
                  remarks: null,
                } : null,
                createdAt: q.createdAt,
              }));
            setRecentQuestions(filtered);
          }
        }
      } catch {
        // Silently fail - not critical
      }
    };
    loadHistory();
  }, [libraryId]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!question.trim() || isLoading) return;

      const questionText = question.trim();
      setIsLoading(true);
      setError(null);
      setCurrentQuestion(questionText);
      setCurrentAnswer(null);

      try {
        const response = await fetch('/api/v2/questions/ask', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: questionText,
            library: getApiLibrary(libraryId),
            modelSpeed: 'quality',
          }),
        });

        const result = await response.json();

        if (result.success && result.data?.outputData) {
          const answer: Answer = {
            response: result.data.outputData.response || '',
            confidence: result.data.outputData.confidence || null,
            sources: result.data.outputData.sources || null,
            reasoning: result.data.outputData.reasoning || null,
            inference: result.data.outputData.inference || null,
            remarks: result.data.outputData.remarks || null,
          };

          setCurrentAnswer(answer);
          setDetailsExpanded(true);

          // Add to recent questions (keep last 5)
          setRecentQuestions((prev) => [
            {
              id: result.data.id,
              question: questionText,
              answer,
              createdAt: new Date().toISOString(),
            },
            ...prev.slice(0, 4),
          ]);

          setQuestion('');
        } else {
          setError(result.message || 'Failed to process question');
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        setError(`Error: ${errorMessage}`);
      } finally {
        setIsLoading(false);
      }
    },
    [question, isLoading, libraryId]
  );

  const handleSelectRecent = (recent: RecentQuestion) => {
    setCurrentQuestion(recent.question);
    setCurrentAnswer(recent.answer);
    setDetailsExpanded(true);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const getLibraryLabel = () => {
    switch (libraryId) {
      case 'knowledge':
        return 'Skills';
      case 'it':
        return 'IT Skills';
      case 'gtm':
        return 'GTM Skills';
      default:
        return 'Skills';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Q&A Area */}
      <div className="lg:col-span-2 space-y-6">
        {/* Question Input */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Test a Question</h3>
          <p className="text-sm text-gray-600 mb-4">
            Ask a question to see how the bot would respond using {getLibraryLabel()}.
          </p>

          <form onSubmit={handleSubmit}>
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Enter your question..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
              disabled={isLoading}
            />
            <div className="flex justify-end mt-3">
              <button
                type="submit"
                disabled={!question.trim() || isLoading}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
                  !question.trim() || isLoading
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                )}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Ask
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Answer Display */}
        {currentQuestion && (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Question Header */}
            <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
              <h4 className="text-sm font-medium text-gray-500 mb-1">Question</h4>
              <p className="text-gray-900">{currentQuestion}</p>
            </div>

            {/* Answer */}
            <div className="p-6">
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  <span className="ml-2 text-gray-600">Generating response...</span>
                </div>
              ) : currentAnswer ? (
                <div className="space-y-4">
                  {/* Response with Confidence Badge */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="text-sm font-medium text-gray-500">Response</h4>
                      {currentAnswer.confidence && (
                        <span
                          className={cn(
                            'px-2 py-0.5 text-xs font-medium rounded',
                            confidenceColors[currentAnswer.confidence] || 'bg-gray-100 text-gray-700'
                          )}
                        >
                          {currentAnswer.confidence} Confidence
                        </span>
                      )}
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-gray-900 whitespace-pre-wrap">{currentAnswer.response}</p>
                    </div>
                  </div>

                  {/* Sources */}
                  {currentAnswer.sources && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Sources Used</h4>
                      <div className="flex flex-wrap gap-2">
                        {currentAnswer.sources.split(',').map((source, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded"
                          >
                            {source.trim()}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Expandable Details */}
                  {(currentAnswer.reasoning || currentAnswer.inference || currentAnswer.remarks) && (
                    <div className="border-t border-gray-200 pt-4">
                      <button
                        onClick={() => setDetailsExpanded(!detailsExpanded)}
                        className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
                      >
                        {detailsExpanded ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                        {detailsExpanded ? 'Hide Details' : 'Show Details'}
                      </button>

                      {detailsExpanded && (
                        <div className="mt-4 space-y-4">
                          {currentAnswer.reasoning && (
                            <div>
                              <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">
                                Reasoning
                              </h5>
                              <p className="text-sm text-gray-700">{currentAnswer.reasoning}</p>
                            </div>
                          )}
                          {currentAnswer.inference && (
                            <div>
                              <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">
                                Inference
                              </h5>
                              <p className="text-sm text-gray-700">{currentAnswer.inference}</p>
                            </div>
                          )}
                          {currentAnswer.remarks && (
                            <div>
                              <h5 className="text-xs font-medium text-gray-500 uppercase mb-1">
                                Remarks
                              </h5>
                              <p className="text-sm text-gray-700">{currentAnswer.remarks}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!currentQuestion && !isLoading && (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <MessageCircleQuestion className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Test Your Knowledge Base</h3>
            <p className="text-gray-500 max-w-md mx-auto">
              Enter a question above to see how the bot would respond. This helps you verify your
              skills are working correctly before deploying to Slack.
            </p>
          </div>
        )}
      </div>

      {/* Recent Questions Sidebar */}
      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 border-b border-gray-200 px-4 py-3">
            <h3 className="font-medium text-gray-900">Recent Questions</h3>
          </div>

          {recentQuestions.length === 0 ? (
            <div className="p-6 text-center">
              <Clock className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No questions yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentQuestions.map((recent) => (
                <button
                  key={recent.id}
                  onClick={() => handleSelectRecent(recent)}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <p className="text-sm text-gray-900 line-clamp-2">{recent.question}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500">{formatTime(recent.createdAt)}</span>
                    {recent.answer?.confidence && (
                      <span
                        className={cn(
                          'px-1.5 py-0.5 text-xs rounded',
                          confidenceColors[recent.answer.confidence] || 'bg-gray-100 text-gray-600'
                        )}
                      >
                        {recent.answer.confidence}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Tips</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Test questions your users commonly ask</li>
            <li>• Check that the right skills are being used</li>
            <li>• Verify confidence levels match answer quality</li>
            <li>• Use this to identify knowledge gaps</li>
          </ul>
        </div>

        {/* Slack Bot Configuration */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setSlackExpanded(!slackExpanded)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-gray-600" />
              <span className="font-medium text-gray-900">Slack Bot Config</span>
            </div>
            <div className="flex items-center gap-2">
              {slackStatus?.connected && (
                <span className="w-2 h-2 rounded-full bg-green-500" />
              )}
              {slackExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </button>

          {slackExpanded && (
            <div className="p-4 space-y-4">
              {/* Status */}
              {slackStatus && (
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'w-2.5 h-2.5 rounded-full',
                      slackStatus.connected ? 'bg-green-500' : 'bg-gray-300'
                    )}
                  />
                  <span className="text-sm text-gray-700">
                    {slackStatus.connected ? 'Connected' : 'Not Connected'}
                  </span>
                </div>
              )}

              {/* Error */}
              {slackError && (
                <div className="flex gap-2 p-2 bg-red-50 rounded text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{slackError}</span>
                </div>
              )}

              {/* Success */}
              {slackSuccess && (
                <div className="flex gap-2 p-2 bg-green-50 rounded text-sm text-green-700">
                  <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{slackSuccess}</span>
                </div>
              )}

              {/* Not configured warning */}
              {slackStatus && !slackStatus.configured && (
                <div className="text-xs text-gray-600 bg-yellow-50 border border-yellow-200 rounded p-2">
                  <strong>Setup Required:</strong> Token not configured.
                  <br />
                  <code className="bg-yellow-100 px-1 rounded text-xs">slack-bot-token-{libraryId}</code>
                </div>
              )}

              {/* Test button */}
              <button
                onClick={handleTestSlackConnection}
                disabled={slackLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {slackLoading ? 'Testing...' : 'Test Connection'}
              </button>

              {/* Bot Response Channel Configuration */}
              <div className="border-t border-gray-200 pt-4 mt-4">
                <p className="text-xs font-medium text-gray-700 mb-2">Bot Response Channel</p>
                <p className="text-xs text-gray-500 mb-2">
                  Set a separate channel for bot responses (for testing). Leave empty to use ingestion channels.
                </p>

                {/* Current bot channel */}
                {botChannelData.length > 0 && (
                  <div className="flex items-center justify-between p-2 bg-blue-50 rounded mb-2">
                    <span className="text-sm text-blue-800">
                      #{botChannelData[0].name}
                    </span>
                    <button
                      onClick={handleClearBotChannel}
                      disabled={savingBotChannel}
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Clear
                    </button>
                  </div>
                )}

                {/* Input for new bot channel */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Channel ID (e.g., C05ABC123)"
                    value={botChannelInput}
                    onChange={(e) => setBotChannelInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSaveBotChannel()}
                    disabled={savingBotChannel}
                    className="flex-1 px-2 py-1.5 border border-gray-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <button
                    onClick={handleSaveBotChannel}
                    disabled={savingBotChannel || !botChannelInput.trim()}
                    className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingBotChannel ? '...' : 'Set'}
                  </button>
                </div>

                {/* Show ingestion channels for reference */}
                {ingestionChannelData.length > 0 && botChannelData.length === 0 && (
                  <p className="text-xs text-gray-500 mt-2">
                    Using ingestion channel: #{ingestionChannelData[0].name}
                  </p>
                )}

                {/* Restart Bot Button */}
                <button
                  onClick={handleRestartBot}
                  disabled={restartingBot}
                  className="w-full mt-3 px-3 py-2 border border-orange-300 bg-orange-50 rounded text-sm font-medium text-orange-700 hover:bg-orange-100 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {restartingBot ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Restarting...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4" />
                      Restart Bot
                    </>
                  )}
                </button>
                <p className="text-xs text-gray-500 mt-1">
                  Restart to apply channel configuration changes
                </p>
              </div>

              {/* Instructions */}
              <div className="text-xs text-gray-500 space-y-1 border-t border-gray-200 pt-4 mt-4">
                <p><strong>Setup:</strong></p>
                <ul className="list-disc ml-4 space-y-0.5">
                  <li>Invite bot to channels with /invite @botname</li>
                  <li>Bot responds to @mentions</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
