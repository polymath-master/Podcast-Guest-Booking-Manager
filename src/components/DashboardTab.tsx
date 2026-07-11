/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useApp } from '../context/AppContext';
import { Users, MailOpen, Calendar, CheckCircle2, CloudLightning, ShieldAlert, FileSpreadsheet, ArrowRight, BookOpen } from 'lucide-react';

export const DashboardTab: React.FC = () => {
  const { leads, campaigns, outreachStates, calendarEvents, logs } = useApp();

  const [dbStatus, setDbStatus] = React.useState<{
    supabaseConnected: boolean;
    supabaseTableExists: boolean;
    supabaseConfigured: boolean;
    localDbExists: boolean;
    errorDetails: string | null;
  } | null>(null);

  React.useEffect(() => {
    fetch('/api/db-status')
      .then(res => res.json())
      .then(data => setDbStatus(data))
      .catch(err => console.error('Error fetching db status:', err));
  }, []);

  // Metrics calculation
  const totalLeads = leads.length;
  const totalCampaigns = campaigns.length;
  const totalBooked = leads.filter(l => l.status === 'booked').length;
  const totalOutreached = leads.filter(l => l.status === 'outreached' || l.status === 'replied' || l.status === 'booked').length;
  const totalReplied = leads.filter(l => l.status === 'replied').length;

  const responseRate = totalOutreached > 0 ? Math.round((totalReplied / totalOutreached) * 100) : 0;
  const bookingRate = totalOutreached > 0 ? Math.round((totalBooked / totalOutreached) * 100) : 0;

  // Connected Services Checklist
  const services = [
    { name: 'Gmail Integration', status: 'Connected', desc: 'Allows sending and receiving booking requests' },
    { name: 'Google Calendar', status: 'Connected', desc: 'Allows scheduling interviews and setup reminders' },
    { name: 'Google Sheets', status: 'Connected', desc: 'Allows importing lead lists and bulk campaign setup' },
    { name: 'Google Drive', status: 'Connected', desc: 'Stores generated guest preparation media kits' },
    { name: 'Google Docs', status: 'Connected', desc: 'Writes real-time guest briefs with AI suggestions' },
  ];

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-2xl border border-slate-800 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-sans font-bold tracking-tight text-white">
            Podcast PR Outreach Command Center
          </h1>
          <p className="text-slate-400 max-w-xl text-sm leading-relaxed">
            Manage your host and guest booking campaigns with enterprise-grade automated follow-ups, Google Workspace sync, and Gemini-powered client ingestion.
          </p>
        </div>
        <div className="flex gap-4">
          <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-4 py-3 rounded-xl flex items-center gap-3">
            <CloudLightning className="w-5 h-5 text-emerald-400" />
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-slate-400">Agent Status</p>
              <p className="text-sm font-sans font-semibold">Active & Polling</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Total Ingested Leads', value: totalLeads, icon: Users, color: 'emerald' },
          { title: 'Active Campaigns', value: totalCampaigns, icon: MailOpen, color: 'blue' },
          { title: 'Response Rate', value: `${responseRate}%`, icon: CloudLightning, color: 'amber' },
          { title: 'Booked Interviews', value: totalBooked, icon: CheckCircle2, color: 'cyan' },
        ].map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div key={idx} className="bg-slate-900 border border-slate-800 p-5 rounded-xl flex items-center justify-between shadow-sm">
              <div className="space-y-1">
                <p className="text-xs font-medium font-sans uppercase tracking-wider text-slate-400">{kpi.title}</p>
                <p className="text-2xl font-sans font-bold text-white">{kpi.value}</p>
              </div>
              <div className={`p-3 rounded-lg bg-slate-800 text-${kpi.color}-400 border border-slate-700`}>
                <Icon className="w-5 h-5" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Core Workflow Map */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          <h2 className="text-lg font-sans font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            Campaign Funnel Analytics
          </h2>

          {/* SVG Funnel Visualizer */}
          <div className="relative h-48 bg-slate-950 rounded-lg p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span>Leads Ingested</span>
              <span>Outreach Triggered</span>
              <span>Replies Detected</span>
              <span>Bookings Confirmed</span>
            </div>

            <div className="flex items-end justify-between h-24 gap-4 px-2">
              <div className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full bg-emerald-500/20 border border-emerald-500/40 h-24 rounded-t-lg transition-all duration-500 flex items-center justify-center font-bold text-white text-sm">
                  {totalLeads}
                </div>
                <span className="text-[10px] text-slate-500">100%</span>
              </div>

              <div className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full bg-blue-500/20 border border-blue-500/40 rounded-t-lg transition-all duration-500 flex items-center justify-center font-bold text-white text-sm"
                  style={{ height: `${totalLeads > 0 ? (totalOutreached / totalLeads) * 96 : 0}px` }}
                >
                  {totalOutreached}
                </div>
                <span className="text-[10px] text-slate-500">
                  {totalLeads > 0 ? Math.round((totalOutreached / totalLeads) * 100) : 0}%
                </span>
              </div>

              <div className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full bg-amber-500/20 border border-amber-500/40 rounded-t-lg transition-all duration-500 flex items-center justify-center font-bold text-white text-sm"
                  style={{ height: `${totalLeads > 0 ? (totalReplied / totalLeads) * 96 : 0}px` }}
                >
                  {totalReplied}
                </div>
                <span className="text-[10px] text-slate-500">
                  {totalOutreached > 0 ? Math.round((totalReplied / totalOutreached) * 100) : 0}%
                </span>
              </div>

              <div className="flex-1 flex flex-col items-center gap-2">
                <div
                  className="w-full bg-cyan-500/20 border border-cyan-500/40 rounded-t-lg transition-all duration-500 flex items-center justify-center font-bold text-white text-sm"
                  style={{ height: `${totalLeads > 0 ? (totalBooked / totalLeads) * 96 : 0}px` }}
                >
                  {totalBooked}
                </div>
                <span className="text-[10px] text-slate-500">
                  {totalOutreached > 0 ? Math.round((totalBooked / totalOutreached) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>

          {/* Workflow guide */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800 space-y-1">
              <p className="font-semibold text-slate-200">1. client ingestion</p>
              <p className="text-slate-400">Import structured spreadsheets or paste raw host bios. AI auto-organizes key info.</p>
            </div>
            <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800 space-y-1">
              <p className="font-semibold text-slate-200">2. campaign triggers</p>
              <p className="text-slate-400">Select multi-step template. Set send limits and queue messages for manual approval.</p>
            </div>
            <div className="p-3 bg-slate-950/40 rounded-lg border border-slate-800 space-y-1">
              <p className="font-semibold text-slate-200">3. calendar sync</p>
              <p className="text-slate-400">Track interviews on Google Calendar, sync status, and generate AI-guided pre-interview kits.</p>
            </div>
          </div>
        </div>

        {/* Integration Service Checklists */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <h2 className="text-lg font-sans font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-emerald-400" />
              Connected Workspace
            </h2>
            <div className="space-y-3">
              {services.map((svc, idx) => (
                <div key={idx} className="flex items-start gap-3 p-2 bg-slate-950/40 rounded-lg border border-slate-800/80">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-slate-200">{svc.name}</p>
                    <p className="text-[10px] text-slate-400 leading-normal">{svc.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="pt-4 border-t border-slate-800 space-y-4">
            <p className="text-xs font-semibold text-slate-200">Database Engine</p>
            {dbStatus ? (
              <div className="space-y-3 text-[10px] font-mono">
                {dbStatus.supabaseConfigured ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Supabase Connected:</span>
                      <span className={dbStatus.supabaseConnected ? "text-emerald-400" : "text-rose-400"}>
                        {dbStatus.supabaseConnected ? "Active" : "Failed"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">'documents' Table:</span>
                      <span className={dbStatus.supabaseTableExists ? "text-emerald-400" : "text-rose-400"}>
                        {dbStatus.supabaseTableExists ? "Ready" : "Missing Schema"}
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-amber-400 bg-amber-500/10 border border-amber-500/20 p-3 rounded-lg text-xs space-y-2">
                    <p className="font-semibold">⚠️ Supabase Credentials Missing</p>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Add <code className="text-amber-200 font-bold font-mono">SUPABASE_URL</code> and <code className="text-amber-200 font-bold font-mono">SUPABASE_SERVICE_ROLE_KEY</code> to your secrets.
                    </p>
                  </div>
                )}
                {dbStatus.supabaseConfigured && !dbStatus.supabaseTableExists && (
                  <div className="text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-lg text-xs space-y-2">
                    <p className="font-semibold">⚠️ Table Required</p>
                    <p className="text-[10px] text-slate-400 leading-normal">
                      Please run this SQL query in your Supabase SQL Editor to create the tables:
                    </p>
                    <pre className="text-[9px] bg-slate-950 p-2 rounded-lg overflow-x-auto text-rose-200 leading-tight">
{`CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  collection TEXT NOT NULL,
  user_id TEXT,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_documents_col_user ON documents(collection, user_id);`}
                    </pre>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <span className="text-slate-400">Local DB Cache:</span>
                  <span className="text-emerald-400">Active Fallback</span>
                </div>
              </div>
            ) : (
              <p className="text-[10px] font-mono text-slate-500 animate-pulse">Loading DB status...</p>
            )}
          </div>
        </div>
      </div>

      {/* Mini Recent Logs */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-sans font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            Agent Activity Logs (Recent)
          </h3>
        </div>
        <div className="divide-y divide-slate-800 bg-slate-950/40 rounded-lg border border-slate-800 overflow-hidden font-mono text-xs">
          {logs.slice(0, 4).map((log) => (
            <div key={log.id} className="p-3 flex items-center justify-between hover:bg-slate-900/40 transition-colors">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                  log.severity === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                  log.severity === 'warn' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                  'bg-slate-800 text-slate-300'
                }`}>
                  {log.category}
                </span>
                <span className="text-slate-300">{log.action}</span>
                <span className="text-slate-500 hidden sm:inline-block">— {log.details}</span>
              </div>
              <span className="text-slate-500 text-[10px]">{new Date(log.timestamp).toLocaleTimeString()}</span>
            </div>
          ))}
          {logs.length === 0 && (
            <div className="p-4 text-center text-slate-500">
              No recent logs. Action items will be recorded here automatically.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
