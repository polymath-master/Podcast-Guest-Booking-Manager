/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Mail,
  Calendar,
  Sparkles,
  BookOpen,
  ShieldCheck,
  ArrowRight,
  Check,
  Layers,
  Search,
  MessageSquare,
  Settings,
  TrendingUp,
  FileText,
  Lock,
  ChevronRight,
  Database,
  BarChart3,
  HelpCircle
} from 'lucide-react';

interface VentureLandingProps {
  onSignIn: () => void;
}

export const VentureLanding: React.FC<VentureLandingProps> = ({ onSignIn }) => {
  // Active state for the CRM Dashboard UI Kit Preview
  const [activePreviewTab, setActivePreviewTab] = useState<'pipeline' | 'pitch' | 'analytics' | 'briefing'>('pipeline');

  // Simulated Lead Data for the interactive Pipeline showcase
  const [mockLeads, setMockLeads] = useState([
    { id: '1', name: 'Lex Fridman Podcast', niche: 'Science & Tech', status: 'Approved', priority: 'High', topics: ['AI Ethics', 'Future of Work', 'Space Tech'] },
    { id: '2', name: 'The Huberman Lab', niche: 'Health & Biology', status: 'Drafting', priority: 'High', topics: ['Human Performance', 'Sleep Science'] },
    { id: '3', name: 'Modern Wisdom', niche: 'Self-Improvement', status: 'Sourced', priority: 'Medium', topics: ['Psychology', 'Decision Making'] },
    { id: '4', name: 'The Joe Rogan Experience', niche: 'General Society', status: 'Meeting Set', priority: 'Critical', topics: ['Free Speech', 'Comedy', 'MMA'] },
  ]);

  // Pitch template generator selection
  const [selectedPitchStyle, setSelectedPitchStyle] = useState<'value' | 'story' | 'casual'>('value');

  const pitchTemplates = {
    value: {
      subject: "Value-focused Guest Proposal: Deeptech Sourcing with CRM Integrations",
      body: "Hi [Host Name],\n\nI've been tuning into your episodes on Tech Trends, especially your recent discussion on automation. I'd love to deliver value to your listeners by discussing how we built the first platform-independent AI PR CRM that manages thousands of guest spots on autopilot.\n\nLet me know if this aligns with your scheduling!\n\nBest,\n[Your Name]"
    },
    story: {
      subject: "How we bootstrapped an Enterprise CRM in 90 days - Founder Story for [Podcast Name]",
      body: "Hey [Host Name],\n\nEvery founder has a scaling story, but ours involves linking multi-step Google Workspace APIs and custom LLMs in a secure Cloud Run sandbox. I'd love to share the raw, unfiltered journey of managing hundreds of weekly outreach emails and calendar syncs.\n\nLooking forward to hearing from you,\n[Your Name]"
    },
    casual: {
      subject: "Quick idea for your upcoming episode on AI agents",
      body: "Hi [Host Name],\n\nBig fan of the show! Just listened to the episode on agentic workflows. We just launched a fully offline-first resilient hybrid database architecture that resolves OpenRouter model failures. I'd love to join for a brief chat about why Gemini thinking modes beat standard APIs.\n\nCheers,\n[Your Name]"
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950 relative overflow-hidden" id="venture-landing-root">
      
      {/* Aesthetic Background Grid & Ambient Glows */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30 pointer-events-none" />
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute top-[30%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[20%] w-[60%] h-[40%] rounded-full bg-emerald-600/5 blur-[120px] pointer-events-none" />

      {/* Top Header Navigation */}
      <header className="border-b border-slate-900 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-tr from-emerald-400 to-cyan-500 rounded-lg flex items-center justify-center text-slate-950 font-black shadow-lg">
              P
            </div>
            <div className="flex flex-col">
              <span className="font-bold tracking-tight text-white text-sm">PODCAST PR</span>
              <span className="font-mono text-[9px] text-slate-500 tracking-widest uppercase">Guest Booking Manager</span>
            </div>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-xs font-mono text-slate-400">
            <a href="#features" className="hover:text-emerald-400 transition-colors">Key Features</a>
            <a href="#interactive-preview" className="hover:text-emerald-400 transition-colors">CRM UI Kit Preview</a>
            <a href="#architecture" className="hover:text-emerald-400 transition-colors">Hybrid Architecture</a>
            <a href="#faq" className="hover:text-emerald-400 transition-colors">Integrations</a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={onSignIn}
              className="bg-slate-900 hover:bg-slate-850 text-slate-200 border border-slate-800 rounded-lg px-4 py-2 text-xs font-mono flex items-center gap-1.5 transition-all hover:border-emerald-500/30 cursor-pointer"
            >
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* Hero Showcase Section */}
      <section className="relative pt-12 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center" id="hero-section">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-[10px] font-mono text-emerald-400 mb-6 tracking-wide uppercase">
          <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          PODCAST GUEST BOOKING MANAGER v2.0
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight leading-none max-w-4xl mx-auto font-sans">
          The Intelligent PR CRM for <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">Sovereign Guest Booking</span>
        </h1>
        <p className="mt-6 text-sm sm:text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Unify your prospect sourcing, calendar scheduling, email campaign sequencing, and executive briefing prep into a unified pipeline. Leverage robust offline-first caching, Google Workspace integrations, and multi-model AI routing.
        </p>

        {/* Hero CTAs */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={onSignIn}
            className="w-full sm:w-auto bg-gradient-to-r from-emerald-400 to-cyan-500 hover:opacity-90 text-slate-950 font-bold px-6 py-3 rounded-lg text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10 cursor-pointer transition-opacity"
          >
            Launch Live Workspace
            <ArrowRight className="w-4 h-4" />
          </button>
          <a
            href="#interactive-preview"
            className="w-full sm:w-auto bg-slate-900 hover:bg-slate-850 text-slate-300 border border-slate-800 px-6 py-3 rounded-lg text-xs font-mono flex items-center justify-center gap-1.5 transition-colors"
          >
            Explore CRM UI Kit
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </a>
        </div>

        {/* Live Metrics Showcase */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {[
            { value: "42.1%", label: "Average Booking Rate", trend: "+8.3% this month" },
            { value: "142,900+", label: "Podcast Channels Sourced", trend: "Fully Scraped Directory" },
            { value: "89,102", label: "AI Pitch Sequences Sent", trend: "Plain Text & HTML" },
            { value: "< 2 sec", label: "Cloud Run DB Latency", trend: "Highly Optimized" }
          ].map((metric, idx) => (
            <div key={idx} className="bg-slate-900/60 border border-slate-850 p-4 rounded-xl text-left space-y-1 backdrop-blur-sm">
              <span className="text-xl sm:text-2xl font-bold font-sans text-white">{metric.value}</span>
              <p className="text-[10px] text-slate-400 font-medium leading-tight">{metric.label}</p>
              <div className="text-[9px] font-mono text-emerald-400/80">{metric.trend}</div>
            </div>
          ))}
        </div>
      </section>

      {/* INTERACTIVE PREVIEW HUB: CRM UI KIT PLAYGROUND */}
      <section className="py-12 border-t border-slate-900 bg-slate-950" id="interactive-preview">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-2 mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Interactive CRM UI Kit Playroom
            </h2>
            <p className="text-xs text-slate-400 max-w-xl mx-auto">
              No authorization required. Interact with the live mock-up controls below to explore the visual design and UX frameworks of the Venture suite.
            </p>
          </div>

          {/* Tab Selection */}
          <div className="flex flex-wrap justify-center gap-2 mb-6 border-b border-slate-900 pb-4 max-w-lg mx-auto">
            {[
              { id: 'pipeline', label: 'Lead Pipeline', icon: Layers },
              { id: 'pitch', label: 'AI Pitch Architect', icon: Mail },
              { id: 'analytics', label: 'Campaign Analytics', icon: BarChart3 },
              { id: 'briefing', label: 'Interview Briefing', icon: FileText }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActivePreviewTab(tab.id as any)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-mono flex items-center gap-2 transition-all cursor-pointer ${
                    activePreviewTab === tab.id
                      ? 'bg-emerald-500/10 text-white border border-emerald-500/40'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${activePreviewTab === tab.id ? 'text-emerald-400' : 'text-slate-500'}`} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Live Mock Interactive Terminal Container */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl max-w-4xl mx-auto flex flex-col h-[480px]">
            {/* Top Chrome Window Bar */}
            <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex justify-between items-center text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
                <span className="text-slate-500 ml-2">demo@podcast-booking-manager:~</span>
              </div>
              <div className="text-[10px] text-slate-400 bg-slate-900 px-2.5 py-0.5 rounded border border-slate-850">
                Active View: <span className="text-emerald-400 uppercase font-bold">{activePreviewTab}</span>
              </div>
            </div>

            {/* Content Switcher */}
            <div className="p-5 flex-1 overflow-y-auto bg-slate-950/40">
              
              {/* VIEW 1: Pipeline */}
              {activePreviewTab === 'pipeline' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex justify-between items-center">
                    <div className="space-y-0.5">
                      <h4 className="text-sm font-sans font-bold text-white">Guest Prospects Directory</h4>
                      <p className="text-[10px] text-slate-400">Manage, qualify and prioritize your guest appearance opportunities.</p>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500">Showing 4 Demo Accounts</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {mockLeads.map((lead) => (
                      <div key={lead.id} className="bg-slate-900 border border-slate-800 rounded-lg p-3.5 hover:border-slate-700 transition-all space-y-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-xs font-sans font-bold text-white">{lead.name}</span>
                            <span className="text-[9px] font-mono text-slate-500 block">{lead.niche}</span>
                          </div>
                          <span className={`text-[9px] font-mono px-2 py-0.5 rounded font-semibold ${
                            lead.priority === 'Critical' || lead.priority === 'High'
                              ? 'bg-red-500/10 text-red-400'
                              : 'bg-slate-850 text-slate-400'
                          }`}>
                            {lead.priority}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {lead.topics.map((t, i) => (
                            <span key={i} className="text-[8px] font-mono bg-slate-950 text-emerald-400 border border-slate-850 px-1.5 py-0.5 rounded">
                              #{t}
                            </span>
                          ))}
                        </div>

                        <div className="border-t border-slate-850 pt-2 flex justify-between items-center text-[10px]">
                          <span className="text-slate-400 flex items-center gap-1">
                            Status: <strong className="text-slate-300">{lead.status}</strong>
                          </span>
                          <button
                            onClick={() => {
                              // Simulate status progress
                              const nextStatus = lead.status === 'Sourced' ? 'Drafting' : lead.status === 'Drafting' ? 'Approved' : 'Meeting Set';
                              setMockLeads(mockLeads.map(l => l.id === lead.id ? { ...l, status: nextStatus } : l));
                            }}
                            className="text-[9px] font-mono text-emerald-400 hover:underline cursor-pointer"
                          >
                            Advance Stage →
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* VIEW 2: Pitch */}
              {activePreviewTab === 'pitch' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="flex justify-between items-center">
                    <div className="space-y-0.5">
                      <h4 className="text-sm font-sans font-bold text-white">AI Pitch Composer Workspace</h4>
                      <p className="text-[10px] text-slate-400">Generate high-conversion outreach emails using templates or OpenRouter brains.</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {[
                      { id: 'value', label: 'Value-First Offer' },
                      { id: 'story', label: 'Founder Narrative' },
                      { id: 'casual', label: 'Quick Invite' },
                    ].map(st => (
                      <button
                        key={st.id}
                        onClick={() => setSelectedPitchStyle(st.id as any)}
                        className={`px-3 py-1.5 rounded text-[10px] font-mono transition-all cursor-pointer ${
                          selectedPitchStyle === st.id
                            ? 'bg-emerald-500 text-slate-950 font-bold'
                            : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850'
                        }`}
                      >
                        {st.label}
                      </button>
                    ))}
                  </div>

                  {/* Simulated Email Draft Window */}
                  <div className="bg-slate-950 border border-slate-850 rounded-lg p-3.5 space-y-2">
                    <div className="text-[10px] font-mono text-slate-500 border-b border-slate-900 pb-2 flex flex-col gap-1">
                      <div>Subject: <span className="text-slate-300 font-sans font-medium">{pitchTemplates[selectedPitchStyle].subject}</span></div>
                    </div>
                    <pre className="text-[10px] font-mono text-slate-400 leading-relaxed overflow-x-auto whitespace-pre-wrap h-40">
                      {pitchTemplates[selectedPitchStyle].body}
                    </pre>
                  </div>
                </div>
              )}

              {/* VIEW 3: Analytics */}
              {activePreviewTab === 'analytics' && (
                <div className="space-y-5 animate-fade-in">
                  <div className="flex justify-between items-center">
                    <div className="space-y-0.5">
                      <h4 className="text-sm font-sans font-bold text-white">Outreach Funnel Conversion</h4>
                      <p className="text-[10px] text-slate-400">Monitor click-through metrics, acceptance logs and response pipelines.</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {[
                      { step: "Sourced Leads", count: "1,240 Channels", pct: 100, color: "bg-emerald-500" },
                      { step: "Pitches Sent", count: "891 Drafts", pct: 71.8, color: "bg-cyan-500" },
                      { step: "Replied/Engaged", count: "375 Replies", pct: 42.1, color: "bg-emerald-400" },
                      { step: "Bookings Scheduled", count: "112 Calendar Slots", pct: 12.5, color: "bg-green-500" }
                    ].map((row, idx) => (
                      <div key={idx} className="space-y-1.5">
                        <div className="flex justify-between text-[10px] font-mono">
                          <span className="text-slate-300 font-bold">{row.step}</span>
                          <span className="text-slate-400">{row.count} ({row.pct}%)</span>
                        </div>
                        <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800">
                          <div className={`${row.color} h-full rounded-full transition-all duration-1000`} style={{ width: `${row.pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="p-3 bg-slate-900/50 border border-slate-850 rounded-lg flex items-center justify-between text-[10px]">
                    <span className="text-slate-400 font-sans">Sequence Health Score:</span>
                    <span className="font-mono font-bold text-emerald-400">Excellent (A+)</span>
                  </div>
                </div>
              )}

              {/* VIEW 4: Briefing */}
              {activePreviewTab === 'briefing' && (
                <div className="space-y-4 animate-fade-in h-full">
                  <div className="flex justify-between items-center">
                    <div className="space-y-0.5">
                      <h4 className="text-sm font-sans font-bold text-white">Executive Interview Briefing Prep</h4>
                      <p className="text-[10px] text-slate-400">Google Docs briefing package generated on the fly for hosts.</p>
                    </div>
                  </div>

                  <div className="bg-slate-950 border border-slate-850 rounded-lg p-4 space-y-3 font-sans text-xs h-[180px] overflow-y-auto">
                    <div className="border-b border-slate-900 pb-2">
                      <h5 className="font-bold text-slate-100">Briefing: Lex Fridman Interview Preparation</h5>
                      <p className="text-[9px] font-mono text-slate-500">Target Podcast: Science & Technology Series</p>
                    </div>

                    <div className="space-y-2">
                      <div className="space-y-1">
                        <span className="font-bold text-emerald-400 text-[10px] uppercase font-mono tracking-wide block">Synthesized Summary:</span>
                        <p className="text-slate-400 text-[10px] leading-relaxed">
                          This episode focuses on the intersections of decentralized databases, agentic CRM workflows and high-thinking models. The host likes to ask deep, open questions about AI consciousness and code execution sandboxes.
                        </p>
                      </div>

                      <div className="space-y-1">
                        <span className="font-bold text-emerald-400 text-[10px] uppercase font-mono tracking-wide block">Recommended Audience Questions:</span>
                        <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[10px] leading-relaxed">
                          <li>"How does a multi-model failover system like OpenRouter maintain consistency during runtime errors?"</li>
                          <li>"What are the philosophical implications of outsourcing all professional PR to autonomous agents?"</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Bottom Demo Bar */}
            <div className="bg-slate-950 px-4 py-3 border-t border-slate-800 flex justify-between items-center text-[10px] font-mono text-slate-500">
              <span>Interactive Simulator • No API consumption</span>
              <button
                onClick={onSignIn}
                className="text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                Connect Real Google Account →
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* BENTO FEATURES GRID */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto border-t border-slate-900" id="features">
        <div className="text-center space-y-2 mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-white font-sans tracking-tight">
            Designed for Elite Outreach Teams
          </h2>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Everything you need to land speaking spots on top-tier podcasts. Complete Google Workspace synchronization out of the box.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-3 hover:border-slate-700 transition-colors">
            <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg flex items-center justify-center">
              <Mail className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-sans font-bold text-white">Gmail Campaigning</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Queue, review and approve your pitches. Leverage daily volume limits to protect your domain reputation. Use the visual Email Preview to tweak drafts before they fire.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-3 hover:border-slate-700 transition-colors">
            <div className="w-10 h-10 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-sans font-bold text-white">Calendar Automation</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Synchronize bookings, schedule guest occurrences, and send automated pre-interview reminder notifications directly to your hosts.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-3 hover:border-slate-700 transition-colors">
            <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-sans font-bold text-white">AI Gateway Routing</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Choose your favorite AI engine. Use high-thinking Google Gemini models natively, or connect OpenRouter to leverage Llama, Claude, or GPT models.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-3 hover:border-slate-700 transition-colors">
            <div className="w-10 h-10 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg flex items-center justify-center">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-sans font-bold text-white">Preparation Engine</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Automatically create complete executive briefings and interview notes directly in Google Docs, detailing host profiles and key topics.
            </p>
          </div>

          {/* Feature 5 */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-3 hover:border-slate-700 transition-colors">
            <div className="w-10 h-10 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-sans font-bold text-white">Drive File Importer</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Directly parse and ingest CSVs, Excel files, PDFs, Google Sheets, or web page URLs from your Google Drive into the CRM.
            </p>
          </div>

          {/* Feature 6 */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl space-y-3 hover:border-slate-700 transition-colors">
            <div className="w-10 h-10 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-lg flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-sans font-bold text-white">Audit Trail Ledgers</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Maintain complete transparency. Check detailed execution logs, OAuth scopes validation, and AI prompt cost summaries on a single timeline.
            </p>
          </div>
        </div>
      </section>

      {/* INTEGRATIONS & SECURITY INFO */}
      <section className="py-12 border-t border-slate-900 bg-slate-950/40" id="architecture">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white font-sans tracking-tight flex items-center justify-center gap-2">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
              Sovereign, Safe, Offline-First Architecture
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed max-w-xl mx-auto">
              We never store your personal API keys on public browsers. All AI executions take place in a sandboxed Node server backend.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h4 className="text-xs font-mono text-emerald-400 uppercase tracking-wider">🔒 OAuth Compliance</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  We leverage native Google Cloud Identity OAuth, granting secure credentials directly from your browser. We never read or store password strings. Your keys remain inside your own Firestore instance.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-mono text-cyan-400 uppercase tracking-wider">🗄️ Resilient Local Cache</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Lost network connection? Our pipeline relies on persistent client-side caching alongside Google Cloud Run instances to save changes on the fly. Reconnect whenever you are ready.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CALL TO ACTION */}
      <section className="py-16 px-4 text-center border-t border-slate-900 relative">
        <div className="max-w-3xl mx-auto space-y-6 z-10 position-relative">
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white">Ready to automate your PR Pipeline?</h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
            Connect your professional Google Workspace account in 3 seconds to immediately unlock sheets parsing, email draft composer, and Google Doc briefings.
          </p>

          <button
            onClick={onSignIn}
            className="mx-auto gsi-material-button bg-white text-slate-900 font-sans font-semibold py-3.5 px-6 rounded-xl shadow-2xl hover:bg-slate-100 transition-colors flex items-center justify-center gap-3 cursor-pointer"
          >
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5 flex-shrink-0">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
            </svg>
            <span className="text-xs sm:text-sm font-sans font-bold">Get Started with Google Authentication</span>
          </button>
        </div>
      </section>

      {/* Elegant Footer */}
      <footer className="bg-slate-950 border-t border-slate-900 py-8 text-center font-mono text-[9px] text-slate-500 space-y-2">
        <div>PODCAST GUEST BOOKING MANAGER • POWERED BY GOOGLE CLOUD PLATFORM & OPENROUTER GATEWAYS</div>
        <div className="opacity-60">SECURED USING SECURE OAUTH PROTOCOLS • NO RAW PASSWORDS PERSISTED • © 2026 PODCAST GUEST BOOKING MANAGER</div>
      </footer>
    </div>
  );
};
