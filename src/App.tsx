/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { DashboardTab } from './components/DashboardTab';
import { LeadsTab } from './components/LeadsTab';
import { CampaignsTab } from './components/CampaignsTab';
import { CalendarTab } from './components/CalendarTab';
import { PrepTab } from './components/PrepTab';
import { LogsTab } from './components/LogsTab';
import { SettingsTab } from './components/SettingsTab';
import { ClientTab } from './components/ClientTab';
import { VentureLanding } from './components/VentureLanding';
import { Loader2, ShieldCheck, Mail, Calendar, HelpCircle, Lock } from 'lucide-react';

const DashboardContent: React.FC = () => {
  const { needsAuth, loading, activeTab, signIn } = useApp();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        <p className="text-sm font-mono text-slate-400">Loading PR Automation Workspace...</p>
      </div>
    );
  }

  if (needsAuth) {
    return <VentureLanding onSignIn={signIn} />;
  }

  // Render Dashboard Layout once signed in
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      <div>
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeTab === 'dashboard' && <DashboardTab />}
          {activeTab === 'leads' && <LeadsTab />}
          {activeTab === 'clients' && <ClientTab />}
          {activeTab === 'campaigns' && <CampaignsTab />}
          {activeTab === 'calendar' && <CalendarTab />}
          {activeTab === 'prep' && <PrepTab />}
          {activeTab === 'logs' && <LogsTab />}
          {activeTab === 'settings' && <SettingsTab />}
        </main>
      </div>

      <footer className="bg-slate-950 border-t border-slate-900 py-6 text-center font-mono text-[10px] text-slate-500">
        PODCAST PR WORKSPACE • REGION: MULTI-REGION CLOUD RUN CONTAINER • SECURITY LAYER: OAUTH COMPLIANT
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <DashboardContent />
    </AppProvider>
  );
}
