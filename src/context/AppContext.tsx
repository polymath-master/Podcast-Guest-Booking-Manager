/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Lead, Campaign, OutreachState, CalendarSyncEvent, AuditLog, AppSettings, PitchTemplate, Client, ConnectedAccount, InboxSummary } from '../types';

// Initialize Firebase App once
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

interface AppContextProps {
  user: User | null;
  token: string | null;
  loading: boolean;
  needsAuth: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  leads: Lead[];
  campaigns: Campaign[];
  outreachStates: OutreachState[];
  calendarEvents: CalendarSyncEvent[];
  logs: AuditLog[];
  settings: AppSettings | null;
  templates: PitchTemplate[];
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  saveTemplate: (templateData: Omit<PitchTemplate, 'userId' | 'createdAt'> & { id?: string }) => Promise<void>;
  deleteTemplate: (templateId: string) => Promise<void>;
  refreshData: () => Promise<void>;
  signIn: () => Promise<void>;
  logOut: () => Promise<void>;
  parseLeadWithAI: (rawText: string) => Promise<Partial<Lead>>;
  createLead: (lead: Omit<Lead, 'id' | 'userId' | 'createdAt'>) => Promise<void>;
  updateLead: (leadId: string, updates: Partial<Lead>) => Promise<void>;
  updateLeadStatus: (leadId: string, status: Lead['status']) => Promise<void>;
  deleteLead: (leadId: string) => Promise<void>;
  createCampaign: (campaign: Omit<Campaign, 'id' | 'userId' | 'createdAt'>) => Promise<void>;
  updateCampaign: (campaignId: string, updates: Partial<Campaign>) => Promise<void>;
  updateCampaignStatus: (campaignId: string, status: Campaign['status']) => Promise<void>;
  deleteCampaign: (campaignId: string) => Promise<void>;
  clients: Client[];
  createClient: (client: Omit<Client, 'id' | 'userId' | 'createdAt'>) => Promise<void>;
  updateClient: (clientId: string, updates: Partial<Client>) => Promise<void>;
  deleteClient: (clientId: string) => Promise<void>;
  parseClientWithAI: (rawText: string) => Promise<Partial<Client>>;
  approveOutreach: (outreachId: string) => Promise<void>;
  sendCampaignImmediate: (campaignId: string, leadId: string) => Promise<void>;
  syncCalendar: () => Promise<void>;
  createCalendarEvent: (event: Omit<CalendarSyncEvent, 'id' | 'userId'>) => Promise<void>;
  analyzeSheetsLeads: (spreadsheetId: string, sheetName: string) => Promise<Lead[]>;
  uploadFileLeads: (fileName: string, mimeType: string, base64Content: string) => Promise<Lead[]>;
  parseUrlLeads: (url: string) => Promise<Lead[]>;
  listDriveFiles: () => Promise<any[]>;
  importDriveFile: (fileId: string, mimeType: string, fileName: string) => Promise<Lead[]>;
  generatePrepDocs: (leadId: string) => Promise<{ docUrl: string; questions: string[] }>;
  connectedAccounts: ConnectedAccount[];
  inboxSummary: InboxSummary | null;
  loadingInboxSummary: boolean;
  connectGoogleAccount: () => Promise<void>;
  disconnectAccount: (accountId: string) => Promise<void>;
  fetchInboxSummary: () => Promise<void>;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsAuth, setNeedsAuth] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [outreachStates, setOutreachStates] = useState<OutreachState[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarSyncEvent[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [templates, setTemplates] = useState<PitchTemplate[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [inboxSummary, setInboxSummary] = useState<InboxSummary | null>(null);
  const [loadingInboxSummary, setLoadingInboxSummary] = useState(false);

  // Monitor Auth State and fetch token
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Firebase idToken or Google OAuth accessToken?
        // We need Google OAuth accessToken which is fetched at login.
        // We'll restore from session-level in-memory cache if available.
        const storedToken = sessionStorage.getItem('g_oauth_token');
        if (storedToken) {
          setToken(storedToken);
          setNeedsAuth(false);
        } else {
          // If no Google OAuth Token is in session, the user needs to sign in again to obtain a fresh token with required scopes.
          setNeedsAuth(true);
        }
      } else {
        setUser(null);
        setToken(null);
        setNeedsAuth(true);
        sessionStorage.removeItem('g_oauth_token');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch all business data from Express Server
  const refreshData = async () => {
    if (!token) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };

      const [leadsRes, campaignsRes, outreachRes, calendarRes, logsRes, settingsRes, templatesRes, clientsRes, accountsRes] = await Promise.all([
        fetch('/api/leads', { headers }),
        fetch('/api/campaigns', { headers }),
        fetch('/api/outreach', { headers }),
        fetch('/api/calendar', { headers }),
        fetch('/api/logs', { headers }),
        fetch('/api/settings', { headers }),
        fetch('/api/templates', { headers }),
        fetch('/api/clients', { headers }),
        fetch('/api/connected-accounts', { headers }),
      ]);

      if (leadsRes.ok) setLeads(await leadsRes.json());
      if (campaignsRes.ok) setCampaigns(await campaignsRes.json());
      if (outreachRes.ok) setOutreachStates(await outreachRes.json());
      if (calendarRes.ok) setCalendarEvents(await calendarRes.json());
      if (logsRes.ok) setLogs(await logsRes.json());
      if (settingsRes.ok) setSettings(await settingsRes.json());
      if (templatesRes.ok) setTemplates(await templatesRes.json());
      if (clientsRes.ok) setClients(await clientsRes.json());
      if (accountsRes.ok) setConnectedAccounts(await accountsRes.json());
    } catch (error) {
      console.error('Error fetching data from server:', error);
    }
  };

  const updateSettings = async (updates: Partial<AppSettings>) => {
    if (!token) return;
    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      };
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers,
        body: JSON.stringify({ ...settings, ...updates })
      });
      if (res.ok) {
        const saved = await res.json();
        setSettings(saved);
      }
    } catch (error) {
      console.error('Error updating settings:', error);
    }
  };

  useEffect(() => {
    if (token) {
      refreshData();
    }
  }, [token]);

  // Google Sign In with Workspace scopes
  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    const scopes = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.metadata.readonly',
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/contacts.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];

    scopes.forEach(scope => provider.addScope(scope));

    try {
      setLoading(true);
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setToken(credential.accessToken);
        sessionStorage.setItem('g_oauth_token', credential.accessToken);
        setNeedsAuth(false);
      }
    } catch (error) {
      console.error('Login Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const logOut = async () => {
    try {
      await signOut(auth);
      setToken(null);
      sessionStorage.removeItem('g_oauth_token');
      setNeedsAuth(true);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // API Call helper
  const apiCall = async (endpoint: string, method: string, body?: any) => {
    if (!token) throw new Error('Unauthenticated');
    const response = await fetch(endpoint, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || 'API Call failed');
    }
    return response.json();
  };

  // AI Lead Parser (unstructured to structured fields)
  const parseLeadWithAI = async (rawText: string): Promise<Partial<Lead>> => {
    return apiCall('/api/leads/parse', 'POST', { rawText });
  };

  // Leads CRM Operations
  const createLead = async (leadData: Omit<Lead, 'id' | 'userId' | 'createdAt'>) => {
    await apiCall('/api/leads', 'POST', leadData);
    await refreshData();
  };

  const updateLead = async (leadId: string, updates: Partial<Lead>) => {
    await apiCall(`/api/leads/${leadId}`, 'PATCH', updates);
    await refreshData();
  };

  const updateLeadStatus = async (leadId: string, status: Lead['status']) => {
    await apiCall(`/api/leads/${leadId}/status`, 'PATCH', { status });
    await refreshData();
  };

  const deleteLead = async (leadId: string) => {
    await apiCall(`/api/leads/${leadId}`, 'DELETE');
    await refreshData();
  };

  // Campaign Operations
  const createCampaign = async (campaignData: Omit<Campaign, 'id' | 'userId' | 'createdAt'>) => {
    await apiCall('/api/campaigns', 'POST', campaignData);
    await refreshData();
  };

  const updateCampaignStatus = async (campaignId: string, status: Campaign['status']) => {
    await apiCall(`/api/campaigns/${campaignId}/status`, 'PATCH', { status });
    await refreshData();
  };

  const deleteCampaign = async (campaignId: string) => {
    await apiCall(`/api/campaigns/${campaignId}`, 'DELETE');
    await refreshData();
  };

  // Outreach Approval & Execution
  const approveOutreach = async (outreachId: string) => {
    await apiCall(`/api/outreach/${outreachId}/approve`, 'POST');
    await refreshData();
  };

  const sendCampaignImmediate = async (campaignId: string, leadId: string) => {
    await apiCall('/api/outreach/send-immediate', 'POST', { campaignId, leadId });
    await refreshData();
  };

  // Calendar Sync
  const syncCalendar = async () => {
    await apiCall('/api/calendar/sync', 'POST');
    await refreshData();
  };

  const createCalendarEvent = async (eventData: Omit<CalendarSyncEvent, 'id' | 'userId'>) => {
    await apiCall('/api/calendar', 'POST', eventData);
    await refreshData();
  };

  // Google Sheets integration: analyze lead lists
  const analyzeSheetsLeads = async (spreadsheetId: string, sheetName: string): Promise<Lead[]> => {
    const result = await apiCall('/api/sheets/analyze', 'POST', { spreadsheetId, sheetName });
    await refreshData();
    return result;
  };

  const uploadFileLeads = async (fileName: string, mimeType: string, base64Content: string): Promise<Lead[]> => {
    const result = await apiCall('/api/leads/upload-file', 'POST', { fileName, mimeType, base64Content });
    await refreshData();
    return result;
  };

  const parseUrlLeads = async (url: string): Promise<Lead[]> => {
    const result = await apiCall('/api/leads/parse-url', 'POST', { url });
    await refreshData();
    return result;
  };

  const listDriveFiles = async (): Promise<any[]> => {
    return apiCall('/api/drive/files', 'GET');
  };

  const importDriveFile = async (fileId: string, mimeType: string, fileName: string): Promise<Lead[]> => {
    const result = await apiCall('/api/drive/import', 'POST', { fileId, mimeType, fileName });
    await refreshData();
    return result;
  };

  // Google Docs & AI: Prep doc generator
  const generatePrepDocs = async (leadId: string): Promise<{ docUrl: string; questions: string[] }> => {
    return apiCall('/api/prep/generate', 'POST', { leadId });
  };

  const saveTemplate = async (templateData: Omit<PitchTemplate, 'userId' | 'createdAt'> & { id?: string }) => {
    await apiCall('/api/templates', 'POST', templateData);
    await refreshData();
  };

  const deleteTemplate = async (templateId: string) => {
    await apiCall(`/api/templates/${templateId}`, 'DELETE');
    await refreshData();
  };

  // Client Operations
  const createClient = async (clientData: Omit<Client, 'id' | 'userId' | 'createdAt'>) => {
    await apiCall('/api/clients', 'POST', clientData);
    await refreshData();
  };

  const updateClient = async (clientId: string, updates: Partial<Client>) => {
    await apiCall(`/api/clients/${clientId}`, 'PATCH', updates);
    await refreshData();
  };

  const deleteClient = async (clientId: string) => {
    await apiCall(`/api/clients/${clientId}`, 'DELETE');
    await refreshData();
  };

  const parseClientWithAI = async (rawText: string): Promise<Partial<Client>> => {
    return apiCall('/api/clients/parse', 'POST', { rawText });
  };

  const updateCampaign = async (campaignId: string, updates: Partial<Campaign>) => {
    await apiCall(`/api/campaigns/${campaignId}`, 'PUT', updates);
    await refreshData();
  };

  const connectGoogleAccount = async () => {
    if (!user || !token) return;
    try {
      const res = await fetch(`/api/auth/google/url?userId=${encodeURIComponent(user.email || '')}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const { url } = await res.json();
        const width = 500;
        const height = 600;
        const left = window.screen.width / 2 - width / 2;
        const top = window.screen.height / 2 - height / 2;
        
        const popup = window.open(
          url,
          'Google OAuth Connect',
          `width=${width},height=${height},left=${left},top=${top},status=no,resizable=yes`
        );

        const handleMessage = async (event: MessageEvent) => {
          if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
            window.removeEventListener('message', handleMessage);
            await refreshData();
            await fetchInboxSummary();
          }
        };
        window.addEventListener('message', handleMessage);
      }
    } catch (error) {
      console.error('Error connecting Google account:', error);
    }
  };

  const disconnectAccount = async (accountId: string) => {
    try {
      await apiCall(`/api/connected-accounts/${encodeURIComponent(accountId)}`, 'DELETE');
      await refreshData();
    } catch (error) {
      console.error('Error disconnecting Google account:', error);
    }
  };

  const fetchInboxSummary = async () => {
    if (!token) return;
    setLoadingInboxSummary(true);
    try {
      const res = await fetch('/api/inbox/summary', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setInboxSummary(await res.json());
      }
    } catch (error) {
      console.error('Error fetching inbox summary:', error);
    } finally {
      setLoadingInboxSummary(false);
    }
  };

  // Run initial inbox summary fetching if token exists
  useEffect(() => {
    if (token) {
      fetchInboxSummary();
    }
  }, [token]);

  return (
    <AppContext.Provider
      value={{
        user,
        token,
        loading,
        needsAuth,
        activeTab,
        setActiveTab,
        leads,
        campaigns,
        outreachStates,
        calendarEvents,
        logs,
        settings,
        templates,
        updateSettings,
        refreshData,
        signIn,
        logOut,
        parseLeadWithAI,
        createLead,
        updateLead,
        updateLeadStatus,
        deleteLead,
        createCampaign,
        updateCampaign,
        updateCampaignStatus,
        deleteCampaign,
        clients,
        createClient,
        updateClient,
        deleteClient,
        parseClientWithAI,
        approveOutreach,
        sendCampaignImmediate,
        syncCalendar,
        createCalendarEvent,
        analyzeSheetsLeads,
        uploadFileLeads,
        parseUrlLeads,
        listDriveFiles,
        importDriveFile,
        generatePrepDocs,
        saveTemplate,
        deleteTemplate,
        connectedAccounts,
        inboxSummary,
        loadingInboxSummary,
        connectGoogleAccount,
        disconnectAccount,
        fetchInboxSummary
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
