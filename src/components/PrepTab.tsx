/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { BookOpen, Sparkles, FileText, ArrowUpRight, HelpCircle, Check, Loader2, RefreshCw } from 'lucide-react';

export const PrepTab: React.FC = () => {
  const { leads, generatePrepDocs, refreshData } = useApp();

  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [questions, setQuestions] = useState<string[]>([]);
  const [docUrl, setDocUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!selectedLeadId) return;
    setGenerating(true);
    setQuestions([]);
    setDocUrl(null);
    try {
      const result = await generatePrepDocs(selectedLeadId);
      setDocUrl(result.docUrl);
      setQuestions(result.questions);
      await refreshData();
    } catch (err) {
      console.error(err);
      alert('Failed to generate interview preparation documents via Workspace.');
    } finally {
      setGenerating(false);
    }
  };

  const selectedLead = leads.find(l => l.id === selectedLeadId);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-sans font-bold text-white">Interview Preparation & Media Kits</h1>
        <p className="text-slate-400 text-sm">Use Gemini AI and Google Docs to synthesize professional summaries, generate custom questions, and produce media briefings instantly.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Selection & Generation Panel */}
        <div className="lg:col-span-1 bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-5">
          <h2 className="text-sm font-sans font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
            <BookOpen className="w-4 h-4 text-emerald-400" />
            Select Candidate
          </h2>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Choose CRM Prospect</label>
              <select
                value={selectedLeadId}
                onChange={(e) => {
                  setSelectedLeadId(e.target.value);
                  setQuestions([]);
                  setDocUrl(null);
                }}
                className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none"
              >
                <option value="">-- Choose prospect --</option>
                {leads.map(lead => (
                  <option key={lead.id} value={lead.id}>{lead.name} ({lead.niche})</option>
                ))}
              </select>
            </div>

            {selectedLead && (
              <div className="bg-slate-950 p-4 border border-slate-800 rounded-lg space-y-2.5 text-xs">
                <div>
                  <p className="font-semibold text-white">{selectedLead.name}</p>
                  <p className="text-[10px] text-slate-400">Niche: {selectedLead.niche || 'Not specified'}</p>
                </div>
                {selectedLead.bio && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bio Summary</p>
                    <p className="text-slate-300 line-clamp-3 leading-relaxed mt-0.5">{selectedLead.bio}</p>
                  </div>
                )}
                {selectedLead.topics && selectedLead.topics.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Speaking Topics</p>
                    <ul className="list-disc list-inside text-slate-300 space-y-0.5 mt-0.5">
                      {selectedLead.topics.slice(0, 3).map((t, idx) => (
                        <li key={idx} className="line-clamp-1">{t}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={generating || !selectedLeadId}
              className="w-full bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-sans font-bold py-2.5 rounded-lg text-xs flex items-center justify-center gap-2 transition-colors"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing & Writing Doc...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Google Doc Prep Pack
                </>
              )}
            </button>
          </div>
        </div>

        {/* AI Generated Questions & Google Docs Briefing Preview */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col justify-between">
          {docUrl || questions.length > 0 ? (
            <div className="space-y-5 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 gap-2">
                  <div>
                    <h3 className="text-sm font-sans font-bold text-white flex items-center gap-1.5">
                      <Check className="w-4.5 h-4.5 text-emerald-400" />
                      Interview Preparation Pack Ready
                    </h3>
                    <p className="text-xs text-slate-400">Created and sync'd with your Google Drive</p>
                  </div>
                  {docUrl && (
                    <a
                      href={docUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors self-start"
                    >
                      <FileText className="w-4 h-4" />
                      Open Google Doc Brief
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-sans font-bold text-slate-200 flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-emerald-400" />
                    10 Custom AI-Generated Interview Questions:
                  </h4>
                  <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 max-h-72 overflow-y-auto space-y-2.5">
                    {questions.map((q, idx) => (
                      <div key={idx} className="flex gap-2.5 text-xs text-slate-300 leading-relaxed font-sans">
                        <span className="font-mono text-emerald-400 font-bold">{idx + 1}.</span>
                        <p>{q}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-3">
                <p className="text-[10px] text-slate-500 leading-normal">
                  * Note: The generated pack has been formatted directly into a Google Document in your drive. Anyone inside your team with the link can edit the questions or add specific recording requirements.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center text-slate-500 py-24 space-y-4">
              <Sparkles className="w-8 h-8 text-slate-700 animate-pulse" />
              <div>
                <p className="font-sans text-xs">No active prep pack loaded.</p>
                <p className="text-[10px] text-slate-600 max-w-sm mt-1">Select a candidate on the left and click generate to trigger Gemini AI text compilation and Google Workspace document instantiation.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
