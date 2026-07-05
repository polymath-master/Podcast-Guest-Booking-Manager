/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useApp } from '../context/AppContext';
import { LayoutDashboard, Users, Briefcase, MailOpen, Calendar, BookOpen, ScrollText, LogOut, CheckCircle2, Settings } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, signIn, logOut, activeTab, setActiveTab } = useApp();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'leads', label: 'CRM & Leads', icon: Users },
    { id: 'clients', label: 'Clients', icon: Briefcase },
    { id: 'campaigns', label: 'Campaigns', icon: MailOpen },
    { id: 'calendar', label: 'Calendar Sync', icon: Calendar },
    { id: 'prep', label: 'Interview Prep', icon: BookOpen },
    { id: 'logs', label: 'Audit Logs', icon: ScrollText },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <nav className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-emerald-400 to-cyan-500 p-2 rounded-lg text-slate-950 font-bold">
              <CheckCircle2 className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <span className="font-sans font-bold tracking-tight text-xl bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                Podcast Guest Booking Manager
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs text-slate-400 font-mono">v1.0 (Enterprise)</span>
            </div>
          </div>

          <div className="hidden md:flex space-x-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-2 px-3 h-10 py-2 rounded-lg font-sans text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-sans font-medium text-slate-200">{user.displayName || 'Enterprise User'}</p>
                  <p className="text-xs font-mono text-slate-400">{user.email}</p>
                </div>
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-8 h-8 rounded-full border border-slate-700" referrerpolicy="no-referrer" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-bold font-sans text-sm">
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                )}
                <button
                  onClick={logOut}
                  className="p-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={signIn}
                className="gsi-material-button font-sans bg-white text-slate-900 font-medium px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors flex items-center gap-2"
              >
                <span className="text-sm">Sign in with Google</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Mobile navigation bar */}
      <div className="md:hidden flex overflow-x-auto border-t border-slate-800 px-2 py-1 bg-slate-950/80 backdrop-blur">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex-shrink-0 flex flex-col items-center gap-1 px-4 py-2 rounded-lg font-sans text-xs font-medium transition-colors ${
                isActive ? 'text-emerald-400' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
