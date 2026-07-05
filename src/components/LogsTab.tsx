/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useApp } from '../context/AppContext';
import { ScrollText, ShieldAlert, AlertTriangle, Info, Terminal } from 'lucide-react';

export const LogsTab: React.FC = () => {
  const { logs } = useApp();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-sans font-bold text-white">System Audit Trail</h1>
        <p className="text-slate-400 text-sm">Continuous enterprise-grade execution monitoring, error tracking, and secure API callback audits.</p>
      </div>

      {/* Logs Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="bg-slate-950 px-5 py-3 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Terminal className="w-4 h-4 text-emerald-400" />
            Audit Logging Engine
          </span>
          <span className="text-[10px] font-mono text-slate-500">
            {logs.length} operations logged
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs font-mono text-slate-300">
            <thead className="bg-slate-950 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-800/80">
              <tr>
                <th className="p-4">Timestamp</th>
                <th className="p-4">Category</th>
                <th className="p-4">Action</th>
                <th className="p-4">Details</th>
                <th className="p-4">Severity</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {logs.map((log) => {
                const Icon = log.severity === 'error' ? ShieldAlert : log.severity === 'warn' ? AlertTriangle : Info;
                return (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-4 text-slate-400 text-[10px] whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <span className="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-[10px] uppercase font-bold text-slate-400">
                        {log.category}
                      </span>
                    </td>
                    <td className="p-4 text-slate-200 font-semibold font-sans">
                      {log.action}
                    </td>
                    <td className="p-4 text-slate-350 line-clamp-2 max-w-sm font-sans text-xs">
                      {log.details}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[9px] uppercase font-bold border flex items-center gap-1 w-max ${
                        log.severity === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        log.severity === 'warn' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                        'bg-slate-800 text-slate-300 border-slate-700'
                      }`}>
                        <Icon className="w-3.5 h-3.5" />
                        {log.severity}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 font-sans text-xs">
                    No log events recorded yet. Perform actions to register audit steps.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
