import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Client, Campaign } from '../types';
import { 
  Briefcase, 
  Globe, 
  Tag, 
  Plus, 
  Trash2, 
  Edit3, 
  Search, 
  Sparkles, 
  Check, 
  Loader2, 
  FolderOpen, 
  FileText, 
  BarChart2, 
  CheckCircle2, 
  Mail, 
  MessageSquare,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

export const ClientTab: React.FC = () => {
  const { 
    clients, 
    campaigns, 
    createClient, 
    updateClient, 
    deleteClient, 
    parseClientWithAI,
    outreachStates
  } = useApp();

  // Search & filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  // Form states (Create / Edit)
  const [showForm, setShowForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  
  // Manual field states
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [niche, setNiche] = useState('');
  const [podcastName, setPodcastName] = useState('');
  const [description, setDescription] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  // AI Parser states
  const [rawBioText, setRawBioText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState('');

  // Client list search
  const filteredClients = clients.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.niche && c.niche.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (c.tags && c.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const selectedClient = clients.find(c => c.id === selectedClientId) || clients[0];

  const handleOpenCreateForm = () => {
    setEditingClient(null);
    setName('');
    setWebsite('');
    setNiche('');
    setPodcastName('');
    setDescription('');
    setTagsInput('');
    setShowForm(true);
  };

  const handleOpenEditForm = (client: Client, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingClient(client);
    setName(client.name);
    setWebsite(client.website || '');
    setNiche(client.niche || '');
    setPodcastName(client.podcastName || '');
    setDescription(client.description || '');
    setTagsInput((client.tags || []).join(', '));
    setShowForm(true);
  };

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const parsedTags = tagsInput
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0);

    const clientData = {
      name,
      website: website.trim() || undefined,
      niche: niche.trim() || undefined,
      podcastName: podcastName.trim() || undefined,
      description: description.trim() || undefined,
      tags: parsedTags.length > 0 ? parsedTags : undefined,
    };

    try {
      if (editingClient) {
        await updateClient(editingClient.id, clientData);
      } else {
        await createClient(clientData);
      }
      setShowForm(false);
      setEditingClient(null);
    } catch (err) {
      console.error('Error saving client:', err);
    }
  };

  const handleParseWithAI = async () => {
    if (!rawBioText.trim()) return;
    setIsParsing(true);
    setParseError('');

    try {
      const parsed = await parseClientWithAI(rawBioText);
      setName(parsed.name || '');
      setWebsite(parsed.website || '');
      setNiche(parsed.niche || '');
      setPodcastName(parsed.podcastName || '');
      setDescription(parsed.description || '');
      setTagsInput((parsed.tags || []).join(', '));
      setRawBioText('');
    } catch (err: any) {
      setParseError(err.message || 'AI parsing failed. Please check OpenRouter/Gemini settings.');
    } finally {
      setIsParsing(false);
    }
  };

  // Associated Campaigns metrics
  const getClientCampaignStats = (campaign: Campaign) => {
    const campOutreaches = outreachStates.filter(o => o.campaignId === campaign.id);
    const sentCount = campOutreaches.filter(o => o.history && o.history.length > 0).length;
    const replies = campOutreaches.filter(o => o.status === 'replied' || (o.history && o.history.some(h => h.status === 'replied'))).length;
    const completes = campOutreaches.filter(o => o.status === 'completed').length;
    
    return {
      total: campaign.leadIds.length,
      sent: sentCount,
      replies,
      completes
    };
  };

  const clientCampaigns = selectedClient 
    ? campaigns.filter(c => c.clientId === selectedClient.id)
    : [];

  return (
    <div className="space-y-6" id="client-tab-container">
      {/* Top Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800/80">
        <div>
          <h1 className="text-xl font-sans font-extrabold text-white tracking-tight flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-emerald-400" />
            Client Management Hub
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-sans">
            Add and organize brand clients, generate AI pitches, and monitor campaign performance outcomes.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleOpenCreateForm}
            className="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-sans text-xs font-semibold px-4 py-2 rounded-lg shadow-md transition-all cursor-pointer flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Client Profile
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Clients List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder="Search clients, niches, tags..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors placeholder-slate-500"
              />
            </div>

            <div className="space-y-2 max-h-[550px] overflow-y-auto">
              {filteredClients.map(c => {
                const isSelected = selectedClient?.id === c.id;
                const campCount = campaigns.filter(camp => camp.clientId === c.id).length;
                return (
                  <div
                    key={c.id}
                    onClick={() => setSelectedClientId(c.id)}
                    className={`p-3.5 rounded-lg border transition-all cursor-pointer text-left relative overflow-hidden group ${
                      isSelected
                        ? 'bg-emerald-500/5 border-emerald-500/30 shadow-sm'
                        : 'bg-slate-950 hover:bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                    }`}
                  >
                    {isSelected && (
                      <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
                    )}
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-sans font-bold text-xs text-white group-hover:text-emerald-300 transition-colors">
                          {c.name}
                        </h3>
                        {c.podcastName && (
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            Podcast: <strong className="text-slate-300">{c.podcastName}</strong>
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => handleOpenEditForm(c, e)}
                        className="text-slate-500 hover:text-emerald-400 p-1 hover:bg-slate-800 rounded transition-colors"
                        title="Edit manual details"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1 mt-2.5">
                      {c.niche && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-900 text-slate-400 font-medium border border-slate-800">
                          {c.niche}
                        </span>
                      )}
                      {c.tags?.slice(0, 2).map(t => (
                        <span key={t} className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/10">
                          #{t}
                        </span>
                      ))}
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-900 text-slate-500 font-semibold border border-slate-800/80 ml-auto">
                        {campCount} {campCount === 1 ? 'campaign' : 'campaigns'}
                      </span>
                    </div>
                  </div>
                );
              })}

              {filteredClients.length === 0 && (
                <div className="text-center py-10 bg-slate-950/40 rounded-lg border border-dashed border-slate-800 p-4">
                  <FolderOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">No clients matching search criteria found.</p>
                </div>
              )}
            </div>
          </div>

          {/* AI Bio Organizer Input Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              AI Profile Builder
            </h3>
            <p className="text-[10px] text-slate-400">
              Paste raw text about a brand or person (website bio, pitch notes, background, etc.). AI will format it and prep a detailed client profile automatically!
            </p>
            <textarea
              placeholder="Paste raw guest bio, speaker notes, brand details here..."
              rows={4}
              value={rawBioText}
              onChange={e => setRawBioText(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all resize-none"
            />
            {parseError && (
              <p className="text-[10px] text-red-400 leading-normal bg-red-950/20 p-2 rounded border border-red-900/30">
                {parseError}
              </p>
            )}
            <button
              type="button"
              onClick={handleParseWithAI}
              disabled={isParsing || !rawBioText.trim()}
              className="w-full bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-sans text-xs font-semibold py-2 rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isParsing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  Analyzing Client Profile...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  AI Organize & Load Details
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Column: Client Overview & Performance */}
        <div className="lg:col-span-8 space-y-6">
          {selectedClient ? (
            <div className="space-y-6">
              {/* Profile Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-emerald-500/5 p-4 rounded-bl-3xl border-l border-b border-emerald-500/10">
                  <Briefcase className="w-10 h-10 text-emerald-500/10" />
                </div>

                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                  <div className="space-y-1">
                    <h2 className="text-xl font-sans font-bold text-white flex items-center gap-2">
                      {selectedClient.name}
                    </h2>
                    
                    {selectedClient.website && (
                      <a 
                        href={selectedClient.website.startsWith('http') ? selectedClient.website : `https://${selectedClient.website}`} 
                        target="_blank" 
                        referrerPolicy="no-referrer"
                        className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 w-fit cursor-pointer"
                      >
                        <Globe className="w-3.5 h-3.5" />
                        {selectedClient.website}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={(e) => handleOpenEditForm(selectedClient, e)}
                      className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-sans text-xs px-3 py-1.5 rounded-lg border border-slate-700 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit Client Profile
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm(`Are you sure you want to delete ${selectedClient.name}?`)) {
                          await deleteClient(selectedClient.id);
                          setSelectedClientId(null);
                        }
                      }}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 font-sans text-xs px-3 py-1.5 rounded-lg border border-red-500/20 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </div>
                </div>

                {/* Sub Metadata Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 border-t border-slate-800/80 pt-5">
                  {selectedClient.podcastName && (
                    <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800/50">
                      <span className="text-[10px] text-slate-500 uppercase font-mono block">Podcast / Brand Name</span>
                      <strong className="text-xs text-white block mt-1">{selectedClient.podcastName}</strong>
                    </div>
                  )}
                  {selectedClient.niche && (
                    <div className="bg-slate-950/50 p-3 rounded-lg border border-slate-800/50">
                      <span className="text-[10px] text-slate-500 uppercase font-mono block">Industry Niche / Category</span>
                      <strong className="text-xs text-white block mt-1">{selectedClient.niche}</strong>
                    </div>
                  )}
                </div>

                {/* Tags */}
                {selectedClient.tags && selectedClient.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {selectedClient.tags.map(t => (
                      <span key={t} className="px-2.5 py-1 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                        #{t}
                      </span>
                    ))}
                  </div>
                )}

                {/* Client AI Pitch/Brand Description */}
                {selectedClient.description && (
                  <div className="mt-6 bg-slate-950/60 border border-slate-800/80 rounded-lg p-4 space-y-2">
                    <h4 className="text-[11px] text-emerald-400 font-mono uppercase tracking-wider flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      AI Organized Brand bio & Pitch Strategy
                    </h4>
                    <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-line font-sans">
                      {selectedClient.description}
                    </p>
                  </div>
                )}
              </div>

              {/* Performance & Associated Campaigns Section */}
              <div className="space-y-4">
                <h3 className="text-xs font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <BarChart2 className="w-4 h-4 text-emerald-400" />
                  Client Campaign Delivery & Outcomes
                </h3>

                {clientCampaigns.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {clientCampaigns.map(camp => {
                      const stats = getClientCampaignStats(camp);
                      return (
                        <div key={camp.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4 text-left relative overflow-hidden">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-sans font-bold text-xs text-white flex items-center gap-1.5">
                                {camp.title}
                              </h4>
                              <span className="text-[9px] text-slate-500 uppercase font-mono mt-0.5 block">
                                Status: <strong className="text-emerald-400">{camp.status}</strong>
                              </span>
                            </div>
                            <span className="text-[9px] bg-slate-950 text-slate-400 border border-slate-800 px-1.5 py-0.5 rounded uppercase font-mono">
                              {camp.steps.length} steps
                            </span>
                          </div>

                          <div className="grid grid-cols-4 gap-2 text-center bg-slate-950/50 p-2.5 rounded-lg border border-slate-850">
                            <div>
                              <span className="text-[8px] text-slate-500 uppercase block font-mono">Leads</span>
                              <strong className="text-xs text-white block mt-0.5">{stats.total}</strong>
                            </div>
                            <div>
                              <span className="text-[8px] text-slate-500 uppercase block font-mono">Sent</span>
                              <strong className="text-xs text-emerald-400 block mt-0.5">{stats.sent}</strong>
                            </div>
                            <div>
                              <span className="text-[8px] text-slate-500 uppercase block font-mono">Replies</span>
                              <strong className="text-xs text-indigo-400 block mt-0.5">{stats.replies}</strong>
                            </div>
                            <div>
                              <span className="text-[8px] text-slate-500 uppercase block font-mono">Done</span>
                              <strong className="text-xs text-emerald-400 block mt-0.5">{stats.completes}</strong>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-10 bg-slate-900/30 rounded-xl border border-dashed border-slate-800 p-6">
                    <BarChart2 className="w-8 h-8 text-slate-700 mx-auto mb-2 animate-pulse" />
                    <p className="text-xs text-slate-400">No active campaigns have been run for this client yet.</p>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Mention this client during Campaign creation to automatically link performance outputs here.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-20 bg-slate-900/40 rounded-xl border border-dashed border-slate-800 p-6 flex flex-col items-center justify-center">
              <Briefcase className="w-12 h-12 text-slate-600 mb-3" />
              <h2 className="text-sm font-sans font-bold text-white mb-1">No Clients Defined</h2>
              <p className="text-xs text-slate-400 max-w-sm">
                Add your first Brand Client manually or paste raw bios to leverage elite AI profiling.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Manual Add/Edit Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-fade-in text-left">
            <h2 className="text-sm font-mono uppercase tracking-wider text-emerald-400">
              {editingClient ? 'Edit Client Profile' : 'Add Brand Client Profile'}
            </h2>

            <form onSubmit={handleSaveClient} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-slate-400 uppercase">Client Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Acme Fintech Corp or Sarah Jenkins"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-400 uppercase">Website</label>
                  <input
                    type="text"
                    value={website}
                    onChange={e => setWebsite(e.target.value)}
                    placeholder="e.g. acmefintech.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-400 uppercase">Industry Niche</label>
                  <input
                    type="text"
                    value={niche}
                    onChange={e => setNiche(e.target.value)}
                    placeholder="e.g. Fintech, SaaS, Health"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-400 uppercase">Podcast Name (Optional)</label>
                  <input
                    type="text"
                    value={podcastName}
                    onChange={e => setPodcastName(e.target.value)}
                    placeholder="e.g. The Fintech Loop"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-medium text-slate-400 uppercase">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={e => setTagsInput(e.target.value)}
                    placeholder="SaaS, AI, founder, tech"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-medium text-slate-400 uppercase">AI Pitch Description / Speaker bio</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Summarize key talking points, speaking achievements, and background expertise..."
                  rows={4}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-850">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="bg-slate-800 hover:bg-slate-750 text-slate-400 px-4 py-2 rounded-lg cursor-pointer transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-semibold px-4 py-2 rounded-lg cursor-pointer transition-all flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  Save Client
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
