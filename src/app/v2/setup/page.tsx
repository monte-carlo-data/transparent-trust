/**
 * V2 Setup Page
 *
 * Initial onboarding wizard for Google OAuth configuration.
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle, Copy, ExternalLink } from 'lucide-react';

type Step = 'welcome' | 'google' | 'done';

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('welcome');
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleClientSecret, setGoogleClientSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSaveGoogle = async () => {
    if (!googleClientId || !googleClientSecret) {
      setError('Both Client ID and Client Secret are required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res1 = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'GOOGLE_CLIENT_ID', value: googleClientId }),
      });

      const res2 = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'GOOGLE_CLIENT_SECRET', value: googleClientSecret }),
      });

      if (!res1.ok || !res2.ok) {
        const data = await res1.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save credentials');
      }

      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const getCallbackUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/api/auth/callback/google`;
    }
    return 'http://localhost:3000/api/auth/callback/google';
  };

  const handleCopyEnv = () => {
    navigator.clipboard.writeText(
      `GOOGLE_CLIENT_ID=${googleClientId}\nGOOGLE_CLIENT_SECRET=${googleClientSecret}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-xl shadow-lg p-10 max-w-lg w-full">
        {/* Welcome Step */}
        {step === 'welcome' && (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Welcome to Transparent Trust
            </h1>
            <p className="text-gray-500 mb-8">
              Let&apos;s set up authentication so your team can sign in securely.
            </p>

            <div className="bg-gray-50 rounded-lg p-5 mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">What you&apos;ll need:</h3>
              <ul className="text-gray-600 text-sm space-y-2">
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  Access to Google Cloud Console
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  About 5 minutes to create OAuth credentials
                </li>
              </ul>
            </div>

            <button
              onClick={() => setStep('google')}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Get Started
            </button>

            <button
              onClick={() => router.push('/auth/signin')}
              className="w-full py-3 text-gray-500 text-sm mt-3 hover:text-gray-700"
            >
              Skip for now (use dev login)
            </button>
          </>
        )}

        {/* Google Configuration Step */}
        {step === 'google' && (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Configure Google OAuth</h1>
            <p className="text-gray-500 mb-6">
              Follow these steps to get your Google OAuth credentials.
            </p>

            {/* Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="font-semibold text-blue-900 mb-3">Steps in Google Cloud Console:</p>
              <ol className="text-blue-800 text-sm space-y-2 list-decimal list-inside">
                <li>
                  Go to{' '}
                  <a
                    href="https://console.cloud.google.com/apis/credentials"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline inline-flex items-center gap-1"
                  >
                    Google Cloud Console
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </li>
                <li>Click &quot;Create Credentials&quot; → &quot;OAuth client ID&quot;</li>
                <li>Select &quot;Web application&quot;</li>
                <li>Add authorized redirect URI:</li>
              </ol>
              <code className="block bg-blue-100 rounded p-3 mt-3 text-xs break-all">
                {getCallbackUrl()}
              </code>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              </div>
            )}

            {/* Form */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
                <input
                  type="text"
                  placeholder="xxxxx.apps.googleusercontent.com"
                  value={googleClientId}
                  onChange={(e) => setGoogleClientId(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client Secret</label>
                <input
                  type="password"
                  placeholder="GOCSPX-xxxxx"
                  value={googleClientSecret}
                  onChange={(e) => setGoogleClientSecret(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setStep('welcome')}
                className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
              >
                Back
              </button>
              <button
                onClick={handleSaveGoogle}
                disabled={saving || !googleClientId || !googleClientSecret}
                className="flex-[2] py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save & Continue'}
              </button>
            </div>
          </>
        )}

        {/* Done Step */}
        {step === 'done' && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <CheckCircle className="w-8 h-8 text-green-500" />
              <h1 className="text-2xl font-bold text-gray-900">Almost Done!</h1>
            </div>
            <p className="text-gray-500 mb-6">
              Your credentials have been saved. There&apos;s one more step to activate them.
            </p>

            {/* Restart Warning */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <p className="font-semibold text-yellow-800 mb-2">Important: Restart Required</p>
              <p className="text-yellow-700 text-sm mb-3">
                For security, OAuth credentials are loaded at server startup. To activate Google sign-in:
              </p>
              <ol className="text-yellow-700 text-sm list-decimal list-inside space-y-1">
                <li>Copy these values to your .env.local file</li>
                <li>Restart the dev server</li>
              </ol>
            </div>

            {/* Env Values */}
            <div className="bg-gray-100 rounded-lg p-4 mb-6 font-mono text-sm">
              <p className="mb-1">GOOGLE_CLIENT_ID={googleClientId}</p>
              <p>GOOGLE_CLIENT_SECRET={googleClientSecret}</p>
            </div>

            <button
              onClick={handleCopyEnv}
              className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors ${
                copied
                  ? 'bg-green-600 text-white'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <Copy className="w-4 h-4" />
              {copied ? 'Copied to clipboard!' : 'Copy to Clipboard'}
            </button>

            <button
              onClick={() => router.push('/auth/signin')}
              className="w-full py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 mt-3"
            >
              Go to Sign In
            </button>
          </>
        )}
      </div>
    </div>
  );
}
