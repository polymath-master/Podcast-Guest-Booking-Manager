/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Calendar, Plus, RefreshCw, Clock, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { CalendarSyncEvent } from '../types';

export const CalendarTab: React.FC = () => {
  const {
    leads,
    calendarEvents,
    syncCalendar,
    createCalendarEvent
  } = useApp();

  const [showAddEvent, setShowAddEvent] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // New Event Form
  const [leadId, setLeadId] = useState('');
  const [summary, setSummary] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');

  const handleSync = async () => {
    setSyncing(true);
    try {
      await syncCalendar();
    } catch (err) {
      console.error(err);
      alert('Failed to sync calendar.');
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadId || !summary || !startTime || !endTime) return;

    try {
      await createCalendarEvent({
        leadId,
        summary,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        notes,
        status: 'confirmed',
        reminderSent: false
      });

      setLeadId('');
      setSummary('');
      setStartTime('');
      setEndTime('');
      setNotes('');
      setShowAddEvent(false);
    } catch (err) {
      console.error(err);
      alert('Failed to create calendar event.');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-sans font-bold text-white">Google Calendar Sync</h1>
          <p className="text-slate-400 text-sm">Automated scheduling calendar synchronization and pre-interview countdown reminders.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAddEvent(!showAddEvent)}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-sans font-semibold px-4 py-2 rounded-lg text-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            Schedule Interview
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 px-4 py-2 rounded-lg text-xs transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync with Workspace'}
          </button>
        </div>
      </div>

      {/* Add Calendar Event Form */}
      {showAddEvent && (
        <form onSubmit={handleCreateEvent} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h3 className="text-sm font-sans font-bold text-white">Book Guest Interview Event</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Select Related Lead/Guest</label>
              <select
                value={leadId}
                onChange={(e) => {
                  setLeadId(e.target.value);
                  const selectedLead = leads.find(l => l.id === e.target.value);
                  if (selectedLead) {
                    setSummary(`Podcast Interview: ${selectedLead.name}`);
                  }
                }}
                required
                className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none"
              >
                <option value="">-- Choose prospect --</option>
                {leads.map(lead => (
                  <option key={lead.id} value={lead.id}>{lead.name} ({lead.niche})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Event Title (Google Calendar)</label>
              <input
                type="text"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="e.g. Fintech Tech Talk with John Doe"
                required
                className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Start Date & Time (Local / Timezone aware)</label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">End Date & Time</label>
              <input
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-slate-300">Producer/Recording Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Recording link, custom backup questions or specific reminders..."
              rows={2}
              className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddEvent(false)}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded bg-emerald-500 text-slate-950 font-sans font-bold text-xs"
            >
              Confirm Booking (Syncs Google Calendar)
            </button>
          </div>
        </form>
      )}

      {/* Synchronized Sessions List */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden p-5 space-y-4">
        <h3 className="text-sm font-sans font-bold text-white flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-400" />
          Synchronized Podcast Schedules
        </h3>

        <div className="divide-y divide-slate-800">
          {calendarEvents.map((evt) => {
            const start = new Date(evt.startTime);
            const end = new Date(evt.endTime);

            return (
              <div key={evt.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="font-sans font-semibold text-white text-sm">{evt.summary}</h4>
                  <p className="text-xs text-slate-400 font-mono flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>{start.toLocaleString()} — {end.toLocaleTimeString()}</span>
                  </p>
                  {evt.notes && <p className="text-[10px] text-slate-500 leading-normal max-w-xl">{evt.notes}</p>}
                </div>

                <div className="flex items-center gap-3">
                  <span className="bg-slate-850 border border-emerald-500/20 px-2.5 py-1 rounded-md text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    Auto Reminder (2 hr prior)
                  </span>
                  <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">
                    Google ID: ...{evt.eventId.substring(0, 8)}
                  </span>
                </div>
              </div>
            );
          })}

          {calendarEvents.length === 0 && (
            <div className="text-center text-slate-500 py-12 text-xs font-sans">
              No interview sessions recorded. Synchronize with your Google Account or book an interview above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
