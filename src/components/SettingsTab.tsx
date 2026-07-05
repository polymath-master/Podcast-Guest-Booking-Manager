/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Save, Shield, Cpu, Key, HelpCircle, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';

const presetModels = [
  { value: 'deepseek/deepseek-chat', label: 'DeepSeek Chat / V3 (Powerful & Economical) [Default]' },
  { value: 'meta-llama/llama-3.1-8b-instruct:free', label: 'Llama 3.1 8B (Free / Fast)' },
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (via OpenRouter)' },
  { value: 'anthropic/claude-3-haiku', label: 'Claude 3 Haiku (Elite/Analytical)' },
  { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini (Advanced reasoning)' },
  { value: 'qwen/qwen-2.5-72b-instruct', label: 'Qwen 2.5 72B (Powerful/Deep)' },
];

export const SettingsTab: React.FC = () => {
  const { settings, updateSettings } = useApp();

  const [provider, setProvider] = useState<'gemini' | 'openrouter'>('gemini');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('deepseek/deepseek-chat');
  const [isCustom, setIsCustom] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // Sync state with settings on load or change
  useEffect(() => {
    if (settings) {
      setProvider(settings.provider || 'gemini');
      setApiKey(settings.openRouterApiKey || '');
      const currentModel = settings.openRouterModel || 'deepseek/deepseek-chat';
      setModel(currentModel);
      const isPreset = presetModels.some(m => m.value === currentModel);
      setIsCustom(!isPreset);
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);

    try {
      await updateSettings({
        provider,
        openRouterApiKey: apiKey,
        openRouterModel: model
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in" id="settings-tab-container">
      <div className="flex flex-col gap-1 border-b border-slate-800 pb-3">
        <h2 className="text-xl font-sans font-bold text-white flex items-center gap-2">
          <Cpu className="w-5 h-5 text-emerald-400" />
          AI Provider Gateway Settings
        </h2>
        <p className="text-xs text-slate-400">
          Configure the AI brain of your CRM. Switch seamlessly between native Google Gemini and third-party LLMs via OpenRouter.
        </p>
      </div>

      <form onSubmit={handleSave} className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6 shadow-sm">
        {/* Provider Selection */}
        <div className="space-y-3">
          <label className="text-xs font-mono text-slate-400 uppercase tracking-wider block">Core AI Gateway Provider</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setProvider('gemini')}
              className={`p-4 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${
                provider === 'gemini'
                  ? 'bg-emerald-500/10 border-emerald-500/50 text-white'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900/50'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-sans font-bold text-sm">Google Gemini AI</span>
                {provider === 'gemini' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              </div>
              <p className="text-xs opacity-80 leading-relaxed">
                Uses the workspace standard Gemini 3.5 Flash and Gemini 3.1 Pro models. Server-side key management. Fully integrated.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setProvider('openrouter')}
              className={`p-4 rounded-xl border text-left transition-all flex flex-col gap-1.5 ${
                provider === 'openrouter'
                  ? 'bg-emerald-500/10 border-emerald-500/50 text-white'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900/50'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="font-sans font-bold text-sm">OpenRouter Gateway</span>
                {provider === 'openrouter' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
              </div>
              <p className="text-xs opacity-80 leading-relaxed">
                Platform independent. Connect any custom open-source or proprietary model (Llama, Claude, GPT, Qwen) using your key.
              </p>
            </button>
          </div>
        </div>

        {provider === 'openrouter' && (
          <div className="space-y-4 bg-slate-950 border border-slate-850 p-5 rounded-xl animate-fade-in">
            <h3 className="text-xs font-mono text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              OpenRouter Configuration
            </h3>

            {/* API Key */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-sans font-medium text-slate-300 flex items-center gap-1">
                  <Key className="w-3.5 h-3.5 text-slate-400" />
                  OpenRouter API Key
                </label>
                <a
                  href="https://openrouter.ai/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-emerald-400 hover:underline"
                >
                  Get API Key
                </a>
              </div>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-or-v1-..."
                required={provider === 'openrouter'}
                className="w-full bg-slate-900 text-slate-100 border border-slate-800 rounded-lg py-2 px-3 text-xs font-mono focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            {/* Model Selection */}
            <div className="space-y-2">
              <label className="text-xs font-sans font-medium text-slate-300">
                Target Model ID
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={isCustom ? 'custom' : model}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'custom') {
                      setIsCustom(true);
                      setModel('');
                    } else {
                      setIsCustom(false);
                      setModel(val);
                    }
                  }}
                  className="bg-slate-900 text-slate-100 border border-slate-800 rounded-lg py-2 px-3 text-xs focus:outline-none focus:border-emerald-500/50 flex-1 cursor-pointer"
                >
                  {presetModels.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                  <option value="custom">-- Custom Model ID --</option>
                </select>

                {isCustom && (
                  <input
                    type="text"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g. deepseek/deepseek-chat"
                    required
                    className="bg-slate-900 text-slate-100 border border-slate-800 rounded-lg py-2 px-3 text-xs font-mono focus:outline-none focus:border-emerald-500/50 flex-1 animate-fade-in"
                  />
                )}
              </div>
              <p className="text-[10px] text-slate-500 font-sans leading-relaxed">
                If selecting custom, supply any model path specified in the OpenRouter documentation. Many models support direct JSON formatting natively.
              </p>
            </div>
          </div>
        )}

        <div className="border-t border-slate-800/60 pt-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Shield className="w-4 h-4 text-slate-500" />
            Keys are encrypted and stored securely.
          </div>

          <div className="flex items-center gap-3">
            {success && (
              <span className="text-xs text-emerald-400 font-sans font-medium flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Settings saved successfully!
              </span>
            )}
            <button
              type="submit"
              disabled={saving}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-sans font-bold px-4 py-2 rounded-lg text-xs flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      <div className="bg-slate-900/40 border border-slate-850 p-5 rounded-xl space-y-2">
        <h4 className="text-xs font-mono text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
          <HelpCircle className="w-4 h-4 text-slate-400" /> How does the gateway function?
        </h4>
        <p className="text-xs text-slate-400 leading-relaxed">
          The Workspace executes all heavy lifting (CRM column mapping, file parsing, URL scraping, and preparation briefs) through the selected provider. If Gemini is active, we leverage native high-thinking models directly on Cloud Run. Switching to OpenRouter instructs the background pipeline to call the OpenRouter chat completions endpoint, translating files to structured formats automatically.
        </p>
      </div>
    </div>
  );
};
