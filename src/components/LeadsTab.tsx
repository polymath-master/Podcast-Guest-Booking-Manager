/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  Plus,
  Sparkles,
  FileSpreadsheet,
  Trash2,
  Mail,
  ExternalLink,
  Globe,
  Filter,
  AlertCircle,
  Info,
  Check,
  Upload,
  Link,
  HardDrive,
  Search,
  Tag,
  X,
  Loader2,
  AlertTriangle,
  Edit2
} from 'lucide-react';
import { Lead } from '../types';

export const LeadsTab: React.FC = () => {
  const {
    leads,
    createLead,
    updateLead,
    deleteLead,
    parseLeadWithAI,
    analyzeSheetsLeads,
    uploadFileLeads,
    parseUrlLeads,
    listDriveFiles,
    importDriveFile
  } = useApp();

  // Active sub-tab inside Sourcing Panel
  const [sourcingTab, setSourcingTab] = useState<'text' | 'file' | 'sheet' | 'url' | 'drive'>('text');
  
  // Filtering & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'outreached' | 'replied' | 'booked' | 'declined'>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'manual' | 'sheets' | 'file' | 'url' | 'drive'>('all');

  // Lead Editing Drawer
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  
  // Edit Lead Modal State
  const [editName, setEditName] = useState('');
  const [editOrganization, setEditOrganization] = useState('');
  const [editEmailsRaw, setEditEmailsRaw] = useState('');
  const [editWebsite, setEditWebsite] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editTopicsRaw, setEditTopicsRaw] = useState('');
  const [editNiche, setEditNiche] = useState('');
  const [editRequirements, setEditRequirements] = useState('');
  const [editPriority, setEditPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [editStatus, setEditStatus] = useState<'new' | 'outreached' | 'replied' | 'booked' | 'declined'>('new');
  const [editRole, setEditRole] = useState<'guest' | 'host'>('guest');

  const startEditing = (lead: Lead) => {
    setEditingLead(lead);
    setEditName(lead.name || '');
    setEditOrganization(lead.organization || '');
    setEditEmailsRaw((lead.contactEmails || []).join(', '));
    setEditWebsite(lead.website || '');
    setEditBio(lead.bio || '');
    setEditTopicsRaw((lead.topics || []).join('\n'));
    setEditNiche(lead.niche || 'Business');
    setEditRequirements(lead.requirements || '');
    setEditPriority(lead.priority || 'medium');
    setEditStatus(lead.status || 'new');
    setEditRole(lead.role || 'guest');
  };

  // Manual Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [organization, setOrganization] = useState('');
  const [emailsRaw, setEmailsRaw] = useState('');
  const [website, setWebsite] = useState('');
  const [bio, setBio] = useState('');
  const [topicsRaw, setTopicsRaw] = useState('');
  const [niche, setNiche] = useState('Business');
  const [requirements, setRequirements] = useState('');
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium');
  const [role, setRole] = useState<'guest' | 'host'>('guest');

  // Text Parsing State
  const [rawText, setRawText] = useState('');
  const [parsingAI, setParsingAI] = useState(false);
  const [textParseSuccess, setTextParseSuccess] = useState(false);

  // File Upload State
  const [dragActive, setDragActive] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [fileParseSuccess, setFileParseSuccess] = useState(false);

  // Spreadsheet Sourcing State
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [sheetName, setSheetName] = useState('Sheet1');
  const [importingSheets, setImportingSheets] = useState(false);
  const [sheetSuccess, setSheetSuccess] = useState(false);

  // URL Sourcing State
  const [urlInput, setUrlInput] = useState('');
  const [parsingUrl, setParsingUrl] = useState(false);
  const [urlSuccess, setUrlSuccess] = useState(false);

  // Google Drive Ingestion State
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [loadingDrive, setLoadingDrive] = useState(false);
  const [importingDriveId, setImportingDriveId] = useState<string | null>(null);
  const [driveSuccess, setDriveSuccess] = useState(false);
  const [driveError, setDriveError] = useState<string | null>(null);

  // Inline Tag Editing
  const [tagInputs, setTagInputs] = useState<{ [leadId: string]: string }>({});

  // Load drive files on tab selection
  useEffect(() => {
    if (sourcingTab === 'drive') {
      fetchDriveFiles();
    }
  }, [sourcingTab]);

  const fetchDriveFiles = async () => {
    setLoadingDrive(true);
    setDriveError(null);
    try {
      const files = await listDriveFiles();
      setDriveFiles(files);
    } catch (err: any) {
      console.error('Error fetching drive files:', err);
      setDriveError(err.message || 'Access to Google Drive was denied. Please make sure Google Drive is enabled on your account.');
    } finally {
      setLoadingDrive(false);
    }
  };

  // Drag Handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processUploadedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await processUploadedFile(e.target.files[0]);
    }
  };

  const processUploadedFile = async (file: File) => {
    setFileLoading(true);
    setFileParseSuccess(false);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const b64 = result.split(',')[1];
          resolve(b64);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });

      await uploadFileLeads(file.name, file.type || 'text/csv', base64);
      setFileParseSuccess(true);
      setTimeout(() => setFileParseSuccess(false), 3000);
    } catch (err: any) {
      console.error('File parsing failed:', err);
      alert(`Failed to parse file: ${err.message || 'unknown error'}`);
    } finally {
      setFileLoading(false);
    }
  };

  // URL Ingestion
  const handleUrlSourcing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;
    setParsingUrl(true);
    setUrlSuccess(false);
    try {
      await parseUrlLeads(urlInput);
      setUrlSuccess(true);
      setUrlInput('');
      setTimeout(() => setUrlSuccess(false), 3000);
    } catch (err: any) {
      console.error('URL parse failed:', err);
      alert(`Failed to extract leads from URL: ${err.message || 'Verify server routing/network bounds.'}`);
    } finally {
      setParsingUrl(false);
    }
  };

  // Spreadsheet Sourcing
  const handleSheetImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!spreadsheetId) return;
    setImportingSheets(true);
    setSheetSuccess(false);
    try {
      let targetId = spreadsheetId.trim();
      const match = targetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        targetId = match[1];
      }
      await analyzeSheetsLeads(targetId, sheetName);
      setSheetSuccess(true);
      setSpreadsheetId('');
      setSheetName('Sheet1');
      setTimeout(() => setSheetSuccess(false), 3000);
    } catch (err: any) {
      console.error('Sheets import failed:', err);
      alert(`Google Sheets integration failed: ${err.message || 'Verify permissions.'}`);
    } finally {
      setImportingSheets(false);
    }
  };

  // Google Drive Sourcing
  const handleDriveImport = async (fileId: string, mimeType: string, fileName: string) => {
    setImportingDriveId(fileId);
    setDriveSuccess(false);
    try {
      await importDriveFile(fileId, mimeType, fileName);
      setDriveSuccess(true);
      setTimeout(() => setDriveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Drive file import failed:', err);
      alert(`Google Drive file import failed: ${err.message || 'Verify workspace access.'}`);
    } finally {
      setImportingDriveId(null);
    }
  };

  // Text Parsing Sourcing
  const handleAIParse = async () => {
    if (!rawText.trim()) return;
    setParsingAI(true);
    setTextParseSuccess(false);
    try {
      const parsed = await parseLeadWithAI(rawText);
      if (parsed.name) setName(parsed.name);
      if (parsed.organization) setOrganization(parsed.organization);
      if (parsed.contactEmails) setEmailsRaw(parsed.contactEmails.join(', '));
      if (parsed.website) setWebsite(parsed.website);
      if (parsed.bio) setBio(parsed.bio);
      if (parsed.topics) setTopicsRaw(parsed.topics.join('\n'));
      if (parsed.niche) setNiche(parsed.niche);
      if (parsed.requirements) setRequirements(parsed.requirements);
      if (parsed.priority) setPriority(parsed.priority as any);

      setTextParseSuccess(true);
      setShowAddForm(true);
      setRawText('');
      setTimeout(() => setTextParseSuccess(false), 3000);
    } catch (error) {
      console.error('AI text parse failed:', error);
      alert('AI parsing failed. Please manually fill the card details below.');
    } finally {
      setParsingAI(false);
    }
  };

  // Manual Form Submission
  const handleManualSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !emailsRaw) return;

    const emails = emailsRaw.split(/[,;\s]+/).map(e => e.trim()).filter(e => e.includes('@'));
    const topics = topicsRaw.split('\n').map(t => t.trim()).filter(Boolean);

    await createLead({
      name,
      organization,
      contactEmails: emails,
      website,
      bio,
      topics,
      niche,
      requirements,
      priority,
      role,
      source: 'manual',
      sourceName: 'Manual Entry',
      status: 'new'
    });

    // Reset Manual Form
    setName('');
    setOrganization('');
    setEmailsRaw('');
    setWebsite('');
    setBio('');
    setTopicsRaw('');
    setNiche('Business');
    setRequirements('');
    setPriority('medium');
    setRole('guest');
    setShowAddForm(false);
  };

  // Tag modifiers
  const handleAddTag = async (leadId: string, leadTags: string[] = []) => {
    const inputTag = tagInputs[leadId]?.trim();
    if (!inputTag) return;

    const updatedTags = [...new Set([...leadTags, inputTag])];
    await updateLead(leadId, { tags: updatedTags });

    setTagInputs(prev => ({ ...prev, [leadId]: '' }));
  };

  const handleRemoveTag = async (leadId: string, tagToRemove: string, leadTags: string[] = []) => {
    const updatedTags = leadTags.filter(t => t !== tagToRemove);
    await updateLead(leadId, { tags: updatedTags });
  };

  // Filter and Search Pipeline
  const filteredLeads = leads.filter(l => {
    // Search Term match
    const searchMatch = searchTerm
      ? l.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.organization?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.bio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.niche?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.tags?.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
      : true;

    // Status match
    const statusMatch = statusFilter === 'all' ? true : l.status === statusFilter;

    // Priority match
    const priorityMatch = priorityFilter === 'all' ? true : (l.priority || 'medium') === priorityFilter;

    // Source match
    const sourceMatch = sourceFilter === 'all' ? true : (l.source || 'manual') === sourceFilter;

    return searchMatch && statusMatch && priorityMatch && sourceMatch;
  });

  return (
    <div className="space-y-6 animate-fade-in" id="leads-tab-container">
      {/* Tab Title Block */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-sans font-bold text-white tracking-tight flex items-center gap-2">
            CRM Lead Hub
          </h1>
          <p className="text-slate-400 text-sm">
            Intelligently ingest prospects via AI Agents, Local Files, URLs, Google Sheets, or Drive, and manage tags, priorities, and status in real-time.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
            }}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-sans font-bold px-4 py-2 rounded-lg text-sm transition-all shadow-md shadow-emerald-500/10"
            id="add-custom-lead-btn"
          >
            <Plus className="w-4 h-4" />
            Add Custom Lead
          </button>
        </div>
      </div>

      {/* Sourcing Center Panels */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden" id="sourcing-panel">
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xs font-mono font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
            Sourcing Data Center (AI Powered)
          </h3>

          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-lg gap-1">
            <button
              onClick={() => setSourcingTab('text')}
              className={`px-3 py-1 text-xs rounded font-medium transition-all ${
                sourcingTab === 'text' ? 'bg-slate-800 text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Raw Text / Pitch
            </button>
            <button
              onClick={() => setSourcingTab('file')}
              className={`px-3 py-1 text-xs rounded font-medium transition-all ${
                sourcingTab === 'file' ? 'bg-slate-800 text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Files (PDF, CSV, Excel)
            </button>
            <button
              onClick={() => setSourcingTab('sheet')}
              className={`px-3 py-1 text-xs rounded font-medium transition-all ${
                sourcingTab === 'sheet' ? 'bg-slate-800 text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Google Sheets
            </button>
            <button
              onClick={() => setSourcingTab('url')}
              className={`px-3 py-1 text-xs rounded font-medium transition-all ${
                sourcingTab === 'url' ? 'bg-slate-800 text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Web URL Scraper
            </button>
            <button
              onClick={() => setSourcingTab('drive')}
              className={`px-3 py-1 text-xs rounded font-medium transition-all ${
                sourcingTab === 'drive' ? 'bg-slate-800 text-emerald-400 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Google Drive
            </button>
          </div>
        </div>

        <div className="p-5 bg-slate-900/50">
          {/* TAB 1: RAW TEXT / BIO PITCH */}
          {sourcingTab === 'text' && (
            <div className="space-y-4 animate-fade-in" id="raw-text-panel">
              <p className="text-slate-400 text-xs leading-relaxed">
                Paste raw biography descriptions, host inquiries, guest pitches, or email threads. The AI Agent will automatically parse raw contact information and organize it into structured properties like Name, Email, Website, Speaks, and suggest optimal Priority and Niche.
              </p>
              <div className="flex gap-3">
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Example: Sarah Connor is an AI ethics researcher who runs ethicalai.io. She is open to interview formats to speak on deepfakes and tech safeguards. Reach her at sarah@ethicalai.io..."
                  rows={3}
                  className="flex-1 bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-3 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 placeholder-slate-600"
                />
                <button
                  onClick={handleAIParse}
                  disabled={parsingAI || !rawText.trim()}
                  className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 px-5 rounded-lg flex flex-col items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {parsingAI ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                  <span className="text-[10px] font-bold uppercase tracking-wider font-sans">
                    {parsingAI ? 'Parsing...' : 'Analyze'}
                  </span>
                </button>
              </div>
              {textParseSuccess && (
                <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 p-2.5 rounded-lg text-xs flex items-center gap-2 animate-bounce">
                  <Check className="w-4 h-4" /> Raw text successfully parsed by Gemini! Check the manual lead form below to customize and save.
                </div>
              )}
            </div>
          )}

          {/* TAB 2: FILE UPLOAD */}
          {sourcingTab === 'file' && (
            <div className="space-y-4 animate-fade-in" id="file-upload-panel">
              <p className="text-slate-400 text-xs leading-relaxed">
                Upload or drag and drop any <strong>PDF list</strong>, <strong>CSV contact tracker</strong>, or <strong>Excel sheet</strong>. Gemini's AI Agent will dynamically parse the text/structure, clean, and organize all available leads into defined coordinates.
              </p>
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all ${
                  dragActive ? 'border-emerald-500 bg-emerald-500/5' : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                }`}
              >
                <input
                  type="file"
                  id="file-upload-input"
                  multiple={false}
                  onChange={handleFileChange}
                  accept=".pdf,.csv,.xlsx,.xls,.txt"
                  className="hidden"
                />
                <label htmlFor="file-upload-input" className="cursor-pointer flex flex-col items-center justify-center space-y-3">
                  <div className="p-3 bg-slate-900 rounded-full border border-slate-800 text-slate-400">
                    {fileLoading ? <Loader2 className="w-6 h-6 animate-spin text-emerald-400" /> : <Upload className="w-6 h-6" />}
                  </div>
                  <div>
                    <p className="text-xs text-white font-semibold">
                      {fileLoading ? 'Analyzing & extracting leads with AI...' : 'Click to upload or drag & drop file'}
                    </p>
                    <p className="text-[10px] text-slate-500 mt-1">Supports PDF, CSV, Excel, and Text lists</p>
                  </div>
                </label>
              </div>
              {fileParseSuccess && (
                <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 p-2.5 rounded-lg text-xs flex items-center gap-2">
                  <Check className="w-4 h-4" /> File analyzed and all valid leads imported into CRM!
                </div>
              )}
            </div>
          )}

          {/* TAB 3: GOOGLE SHEETS */}
          {sourcingTab === 'sheet' && (
            <form onSubmit={handleSheetImport} className="space-y-4 animate-fade-in" id="sheet-import-form">
              <p className="text-slate-400 text-xs leading-relaxed">
                Provide a <strong>Google Spreadsheet Link or ID</strong>. The AI Agent will read the rows, dynamically organize unstructured cells into structured fields, classify the <strong>Niche</strong>, automatically rate <strong>Priority</strong>, and set <strong>Status</strong>.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">Google Spreadsheet Link or ID</label>
                  <input
                    type="text"
                    value={spreadsheetId}
                    onChange={(e) => setSpreadsheetId(e.target.value)}
                    placeholder="e.g. https://docs.google.com/spreadsheets/d/1aBC... or spreadsheet ID"
                    required
                    className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold">Sheet Name</label>
                  <input
                    type="text"
                    value={sheetName}
                    onChange={(e) => setSheetName(e.target.value)}
                    placeholder="Sheet1"
                    className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={importingSheets || !spreadsheetId}
                  className="px-4 py-2 rounded bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-md"
                >
                  {importingSheets ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Sourcing and Processing with AI...
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      Process Google Sheet
                    </>
                  )}
                </button>
              </div>
              {sheetSuccess && (
                <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 p-2.5 rounded-lg text-xs flex items-center gap-2">
                  <Check className="w-4 h-4" /> Google Sheet parsed, cleaned, and import successful!
                </div>
              )}
            </form>
          )}

          {/* TAB 4: URL SCRAPER */}
          {sourcingTab === 'url' && (
            <form onSubmit={handleUrlSourcing} className="space-y-4 animate-fade-in" id="url-scraper-form">
              <p className="text-slate-400 text-xs leading-relaxed">
                Provide a website URL (such as a company profile page, team directory, podcast episode guest list). The AI Sourcing Agent will scrape the web page, extract potential contacts, and intelligently map their details.
              </p>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-600">
                    <Globe className="w-4 h-4" />
                  </div>
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="e.g. https://example.com/team-directory or https://podcast.com/guest-list"
                    required
                    className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg pl-10 pr-3 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={parsingUrl || !urlInput.trim()}
                  className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {parsingUrl ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Analyzing URL...
                    </>
                  ) : (
                    <>
                      <Link className="w-3.5 h-3.5" />
                      Extract Web Leads
                    </>
                  )}
                </button>
              </div>
              {urlSuccess && (
                <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 p-2.5 rounded-lg text-xs flex items-center gap-2">
                  <Check className="w-4 h-4" /> Webpage scraped and contacts successfully saved to CRM!
                </div>
              )}
            </form>
          )}

          {/* TAB 5: GOOGLE DRIVE BROWSER */}
          {sourcingTab === 'drive' && (
            <div className="space-y-4 animate-fade-in" id="drive-browser-panel">
              <p className="text-slate-400 text-xs leading-relaxed">
                Browse and select a file directly from your **Google Drive** space. We support importing Google Sheets, Google Docs, PDFs, CSV, and Excel trackers.
              </p>
              {driveError && (
                <div className="bg-rose-500/10 text-rose-400 border border-rose-500/20 p-3 rounded-lg text-xs space-y-1">
                  <p className="font-semibold">Google Drive Connection Issue</p>
                  <p className="opacity-90">{driveError}</p>
                </div>
              )}
              {loadingDrive ? (
                <div className="flex flex-col items-center justify-center py-6 gap-2 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
                  <span className="text-xs">Accessing Google Drive...</span>
                </div>
              ) : driveFiles.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs space-y-2">
                  <HardDrive className="w-8 h-8 mx-auto opacity-30 text-slate-400" />
                  <p>No compatible spreadsheets, documents, or PDF lists found in your recent Google Drive.</p>
                  <button onClick={fetchDriveFiles} className="text-emerald-400 underline text-[11px] font-bold">
                    Retry Fetching
                  </button>
                </div>
              ) : (
                <div className="bg-slate-950/60 border border-slate-800 rounded-lg max-h-52 overflow-y-auto divide-y divide-slate-800">
                  {driveFiles.map((file) => (
                    <div key={file.id} className="p-3 flex items-center justify-between hover:bg-slate-900/50 transition-colors">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        {file.mimeType.includes('spreadsheet') || file.mimeType.includes('excel') || file.mimeType.includes('csv') ? (
                          <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : (
                          <HardDrive className="w-4 h-4 text-blue-400 shrink-0" />
                        )}
                        <div className="text-left overflow-hidden">
                          <p className="text-xs text-slate-200 font-semibold truncate max-w-sm">{file.name}</p>
                          <p className="text-[10px] text-slate-500">Modified: {new Date(file.modifiedTime).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDriveImport(file.id, file.mimeType, file.name)}
                        disabled={importingDriveId !== null}
                        className="px-2.5 py-1 text-[10px] font-sans font-bold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded transition-all flex items-center gap-1.5"
                      >
                        {importingDriveId === file.id ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                            Ingesting...
                          </>
                        ) : (
                          <>
                            <HardDrive className="w-3 h-3" />
                            Import Leads
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {driveSuccess && (
                <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 p-2.5 rounded-lg text-xs flex items-center gap-2">
                  <Check className="w-4 h-4" /> Google Drive file imported and parsed by AI successfully!
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Manual CRM Creation Form */}
      {showAddForm && (
        <form onSubmit={handleManualSave} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 animate-fade-in" id="manual-lead-form">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-sans font-bold text-white flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-emerald-400" />
              Prospect Details Card
            </h3>
            <button type="button" onClick={() => setShowAddForm(false)} className="text-slate-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Prospect Name *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Organization / Company</label>
              <input
                type="text"
                value={organization}
                onChange={(e) => setOrganization(e.target.value)}
                placeholder="e.g. Acme Corp"
                className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Contact Emails *</label>
              <input
                type="text"
                value={emailsRaw}
                onChange={(e) => setEmailsRaw(e.target.value)}
                placeholder="john@example.com, contact@example.com"
                required
                className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Website URL</label>
              <input
                type="text"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://john.com"
                className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Bio / Credentials Summary</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                placeholder="Background profile details..."
                className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Speaking Topics (one per line)</label>
              <textarea
                value={topicsRaw}
                onChange={(e) => setTopicsRaw(e.target.value)}
                rows={3}
                placeholder="Expertise keywords..."
                className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Niche Category</label>
              <input
                type="text"
                value={niche}
                onChange={(e) => setNiche(e.target.value)}
                className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Priority Rating</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="high">High priority</option>
                <option value="medium">Medium priority</option>
                <option value="low">Low priority</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Role Segment</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="guest">Guest Segment</option>
                <option value="host">Host Segment</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-300">Availability / Sched Notes</label>
              <input
                type="text"
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                placeholder="Thursdays only, booked via PR..."
                className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded bg-emerald-500 text-slate-950 font-sans font-bold text-xs transition-all shadow-md shadow-emerald-500/10"
            >
              Save Prospect
            </button>
          </div>
        </form>
      )}

      {/* Advanced Filter, Search and Tag Management Dashboard */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4" id="filter-dashboard">
        <div className="flex flex-col lg:flex-row gap-3">
          {/* SEARCH */}
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search prospects by name, bio, niche, or tag labels..."
              className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-white">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* CHIPS FILTERS */}
          <div className="flex flex-wrap gap-2.5">
            {/* PRIORITY */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg text-xs">
              <span className="text-slate-500 font-medium mr-1">Priority:</span>
              {(['all', 'high', 'medium', 'low'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPriorityFilter(p)}
                  className={`px-2 py-0.5 rounded text-[10px] font-sans font-bold uppercase transition-all ${
                    priorityFilter === p
                      ? p === 'high'
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : p === 'low'
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                        : p === 'medium'
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            {/* SOURCE */}
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg text-xs">
              <span className="text-slate-500 font-medium">Source:</span>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as any)}
                className="bg-transparent text-slate-300 text-xs font-bold outline-none cursor-pointer focus:text-white"
              >
                <option value="all">ALL SOURCES</option>
                <option value="manual">MANUAL</option>
                <option value="sheets">GOOGLE SHEETS</option>
                <option value="file">LOCAL FILES</option>
                <option value="url">URL SCRAPED</option>
                <option value="drive">DRIVE FILE</option>
              </select>
            </div>

            {/* STATUS */}
            <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2.5 py-1 rounded-lg text-xs">
              <span className="text-slate-500 font-medium">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="bg-transparent text-slate-300 text-xs font-bold outline-none cursor-pointer focus:text-white"
              >
                <option value="all">ALL STATUSES</option>
                <option value="new">NEW</option>
                <option value="outreached">OUTREACHED</option>
                <option value="replied">REPLIED</option>
                <option value="booked">BOOKED</option>
                <option value="declined">DECLINED</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* CRM Leads Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden" id="leads-table-wrapper">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase font-mono tracking-wider text-[10px] border-b border-slate-800">
              <tr>
                <th className="p-4">Name & Profile</th>
                <th className="p-4">Tags & Labeling</th>
                <th className="p-4">Category & Coordinates</th>
                <th className="p-4">Source</th>
                <th className="p-4">Priority</th>
                <th className="p-4">CRM Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-800/40 transition-colors">
                  {/* Name & Bio */}
                  <td className="p-4 max-w-xs">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-sans font-bold text-white text-sm">{lead.name}</p>
                        {lead.role && (
                          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${
                            lead.role === 'host' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' : 'bg-pink-500/10 text-pink-400 border-pink-500/20'
                          }`} title="Role Segment">
                            {lead.role}
                          </span>
                        )}
                        {lead.organization && (
                          <span className="text-[10px] font-sans font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20" title="Organization / Company">
                            {lead.organization}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed mt-1 line-clamp-2">{lead.bio || 'No biography added'}</p>
                    </div>
                  </td>

                  {/* Tags */}
                  <td className="p-4 max-w-xs">
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-1">
                        {(lead.tags || []).map((t, idx) => (
                          <span
                            key={idx}
                            className="bg-slate-950 text-slate-300 border border-slate-800 px-1.5 py-0.5 rounded text-[10px] flex items-center gap-1 font-medium font-sans hover:border-slate-600 transition-colors"
                          >
                            <Tag className="w-2.5 h-2.5 text-emerald-400" />
                            {t}
                            <button
                              onClick={() => handleRemoveTag(lead.id, t, lead.tags)}
                              className="text-slate-500 hover:text-red-400 shrink-0 ml-0.5"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                        {(lead.tags || []).length === 0 && (
                          <span className="text-[10px] text-slate-600 italic">No labels</span>
                        )}
                      </div>
                      
                      {/* Tag Inserter */}
                      <div className="flex gap-1 max-w-xs">
                        <input
                          type="text"
                          value={tagInputs[lead.id] || ''}
                          onChange={(e) => setTagInputs(prev => ({ ...prev, [lead.id]: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddTag(lead.id, lead.tags);
                            }
                          }}
                          placeholder="Add tag..."
                          className="bg-slate-950 text-slate-200 border border-slate-800 rounded px-1.5 py-0.5 text-[10px] w-20 focus:outline-none focus:border-emerald-500 font-sans"
                        />
                        <button
                          onClick={() => handleAddTag(lead.id, lead.tags)}
                          className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold px-1.5 rounded text-[10px]"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </td>

                  {/* Niche & Coordinates */}
                  <td className="p-4">
                    <div className="space-y-1.5">
                      <span className="bg-slate-800 border border-slate-700 px-2 py-0.5 rounded text-[10px] uppercase font-mono font-bold text-slate-300 inline-block">
                        {lead.niche || 'General'}
                      </span>
                      <div className="space-y-1 font-mono text-[10px] text-slate-400">
                        {lead.contactEmails.map((email, idx) => (
                          <div key={idx} className="flex items-center gap-1">
                            <Mail className="w-3 h-3 text-slate-500" />
                            <span className="truncate max-w-[140px]" title={email}>{email}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </td>

                  {/* Source */}
                  <td className="p-4">
                    <div className="text-left">
                      <span className="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded text-[10px] uppercase font-sans text-slate-400 font-bold">
                        {lead.source || 'manual'}
                      </span>
                      {lead.sourceName && (
                        <p className="text-[9px] text-slate-500 mt-1 truncate max-w-[100px]" title={lead.sourceName}>
                          {lead.sourceName}
                        </p>
                      )}
                    </div>
                  </td>

                  {/* Priority selector */}
                  <td className="p-4">
                    <select
                      value={lead.priority || 'medium'}
                      onChange={(e) => updateLead(lead.id, { priority: e.target.value as any })}
                      className={`border border-slate-800 rounded p-1 text-[10px] font-sans font-bold uppercase transition-all focus:outline-none ${
                        lead.priority === 'high'
                          ? 'bg-red-950/40 text-red-400 border-red-500/20'
                          : lead.priority === 'low'
                          ? 'bg-blue-950/40 text-blue-400 border-blue-500/20'
                          : 'bg-amber-950/40 text-amber-400 border-amber-500/20'
                      }`}
                    >
                      <option value="high" className="bg-slate-950 text-red-400 font-bold">HIGH</option>
                      <option value="medium" className="bg-slate-950 text-amber-400 font-bold">MEDIUM</option>
                      <option value="low" className="bg-slate-950 text-blue-400 font-bold">LOW</option>
                    </select>
                  </td>

                  {/* Status selector */}
                  <td className="p-4">
                    <select
                      value={lead.status}
                      onChange={(e) => updateLead(lead.id, { status: e.target.value as any })}
                      className={`bg-slate-950 text-slate-200 border border-slate-800 rounded p-1 text-[10px] font-sans font-bold uppercase transition-all cursor-pointer focus:outline-none ${
                        lead.status === 'booked' ? 'text-cyan-400 border-cyan-500/30' :
                        lead.status === 'outreached' ? 'text-blue-400 border-blue-500/30' :
                        lead.status === 'replied' ? 'text-emerald-400 border-emerald-500/30' :
                        lead.status === 'declined' ? 'text-red-400 border-red-500/30' :
                        'text-slate-400 border-slate-700'
                      }`}
                    >
                      <option value="new">NEW</option>
                      <option value="outreached">OUTREACHED</option>
                      <option value="replied">REPLIED</option>
                      <option value="booked">BOOKED</option>
                      <option value="declined">DECLINED</option>
                    </select>
                  </td>

                  {/* Actions */}
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {lead.website && (
                        <a
                          href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-slate-400 hover:text-emerald-400 p-1.5 bg-slate-950 rounded border border-slate-800 hover:border-slate-700 transition-all"
                          title="Visit Website"
                        >
                          <Globe className="w-3.5 h-3.5" />
                        </a>
                      )}
                      {lead.mediaKitUrl && (
                        <a
                          href={lead.mediaKitUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-emerald-400 hover:text-emerald-300 p-1.5 bg-emerald-500/10 rounded border border-emerald-500/20 transition-all flex items-center"
                          title="View Prep Kit"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button
                        onClick={() => startEditing(lead)}
                        className="p-1.5 rounded bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-emerald-400 transition-all cursor-pointer"
                        title="Edit Lead Details"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteLead(lead.id)}
                        className="p-1.5 rounded bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-500 hover:text-red-400 transition-all"
                        title="Delete Lead"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredLeads.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500 font-sans">
                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                      <AlertTriangle className="w-7 h-7 text-slate-600" />
                      <p className="text-xs text-slate-400 font-bold">No Leads Found</p>
                      <p className="text-[11px] text-slate-500">There are no leads matching your selected filter. Clear filters or add more prospects to get started.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Lead Modal */}
      {editingLead && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" id="edit-lead-modal-overlay">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden" id="edit-lead-modal">
            {/* Header */}
            <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-emerald-400" />
                <span className="font-sans text-slate-200 font-bold text-sm">Edit Prospect Details: {editingLead.name}</span>
              </div>
              <button onClick={() => setEditingLead(null)} className="text-slate-500 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!editName || !editEmailsRaw) return;

                const emails = editEmailsRaw.split(/[,;\s]+/).map(em => em.trim()).filter(em => em.includes('@'));
                const topics = editTopicsRaw.split('\n').map(t => t.trim()).filter(Boolean);

                await updateLead(editingLead.id, {
                  name: editName,
                  organization: editOrganization,
                  contactEmails: emails,
                  website: editWebsite,
                  bio: editBio,
                  topics,
                  niche: editNiche,
                  requirements: editRequirements,
                  priority: editPriority,
                  status: editStatus,
                  role: editRole
                });

                setEditingLead(null);
              }}
              className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-900/50"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Prospect Name *</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Organization / Company</label>
                  <input
                    type="text"
                    value={editOrganization}
                    onChange={(e) => setEditOrganization(e.target.value)}
                    placeholder="e.g. Acme Corp"
                    className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Contact Emails *</label>
                  <input
                    type="text"
                    value={editEmailsRaw}
                    onChange={(e) => setEditEmailsRaw(e.target.value)}
                    required
                    className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Website URL</label>
                  <input
                    type="text"
                    value={editWebsite}
                    onChange={(e) => setEditWebsite(e.target.value)}
                    className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Bio / Credentials Summary</label>
                  <textarea
                    value={editBio}
                    onChange={(e) => setEditBio(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Speaking Topics (one per line)</label>
                  <textarea
                    value={editTopicsRaw}
                    onChange={(e) => setEditTopicsRaw(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="space-y-1 md:col-span-2">
                  <label className="text-xs font-medium text-slate-300">Niche Category</label>
                  <input
                    type="text"
                    value={editNiche}
                    onChange={(e) => setEditNiche(e.target.value)}
                    className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Priority</label>
                  <select
                    value={editPriority}
                    onChange={(e) => setEditPriority(e.target.value as any)}
                    className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="high">High priority</option>
                    <option value="medium">Medium priority</option>
                    <option value="low">Low priority</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">CRM Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as any)}
                    className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="new">NEW</option>
                    <option value="outreached">OUTREACHED</option>
                    <option value="replied">REPLIED</option>
                    <option value="booked">BOOKED</option>
                    <option value="declined">DECLINED</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Role Segment</label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as any)}
                    className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="guest">Guest Segment</option>
                    <option value="host">Host Segment</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Availability / Scheduling Notes</label>
                <input
                  type="text"
                  value={editRequirements}
                  onChange={(e) => setEditRequirements(e.target.value)}
                  className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingLead(null)}
                  className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded bg-emerald-500 text-slate-950 font-sans font-bold text-xs transition-all shadow-md shadow-emerald-500/10 cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
