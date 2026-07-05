/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Plus, Mail, Clock, Eye, Check, AlertCircle, Play, Pause, ChevronDown, Sparkles, Loader2, Edit2, Trash2, FileText, Tag, X, Search } from 'lucide-react';
import { Campaign, CampaignStep, Lead, PitchTemplate } from '../types';

export const CampaignsTab: React.FC = () => {
  const {
    leads,
    campaigns,
    outreachStates,
    createCampaign,
    updateCampaign,
    updateCampaignStatus,
    deleteCampaign,
    approveOutreach,
    sendCampaignImmediate,
    templates,
    saveTemplate,
    deleteTemplate,
    refreshData,
    token,
    clients,
    connectedAccounts
  } = useApp();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [senderEmail, setSenderEmail] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [testLeadId, setTestLeadId] = useState<string>('');
  const [testStepIndex, setTestStepIndex] = useState<number>(0);
  const [testEmailInput, setTestEmailInput] = useState<string>('');
  const [isTestSending, setIsTestSending] = useState<boolean>(false);
  const [testSendResult, setTestSendResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [campaignTitle, setCampaignTitle] = useState('');
  const [dailySendLimit, setDailySendLimit] = useState(50);
  const [selectedLeads, setSelectedLeads] = useState<string[]>([]);

  // Segment-based targeting states
  const [targetingMode, setTargetingMode] = useState<'segment' | 'individual'>('individual');
  const [targetRoles, setTargetRoles] = useState<('guest' | 'host')[]>([]);
  const [targetNiches, setTargetNiches] = useState<string[]>([]);
  const [targetTags, setTargetTags] = useState<string[]>([]);
  const [excludedLeadIds, setExcludedLeadIds] = useState<string[]>([]);

  // Queue tab states
  const [selectedQueueLeadIds, setSelectedQueueLeadIds] = useState<string[]>([]);
  const [autoApproveQueue, setAutoApproveQueue] = useState<boolean>(() => {
    return localStorage.getItem('auto_approve_queue') === 'true';
  });

  // Timezone-based scheduling states
  const [timezone, setTimezone] = useState("Prospect's Local");
  const [preferredTime, setPreferredTime] = useState('09:00');
  const [deliveryDaysMode, setDeliveryDaysMode] = useState<'weekdays' | 'everyday' | 'custom'>('weekdays');
  const [selectedCustomDays, setSelectedCustomDays] = useState<string[]>(['1', '2', '3', '4', '5']); // Mon-Fri by default

  // Campaign list filtering states
  const [campaignSearch, setCampaignSearch] = useState('');
  const [campaignTagFilter, setCampaignTagFilter] = useState('All');

  // Campaign Details Tracking Modal State
  const [selectedCampaignDetails, setSelectedCampaignDetails] = useState<Campaign | null>(null);

  // Dynamic list elements derived from existing CRM prospects
  const uniqueNiches = Array.from(new Set(leads.map(l => l.niche).filter(Boolean))) as string[];
  const uniqueTags = Array.from(
    new Set(
      leads.flatMap(l => {
        if (Array.isArray(l.tags)) return l.tags;
        if (typeof l.tags === 'string' && l.tags) return (l.tags as string).split(',').map(t => t.trim());
        return [];
      }).filter(Boolean)
    )
  ) as string[];

  // Real-time matching leads calculation
  const matchingLeads = leads.filter(l => {
    if (targetingMode === 'individual') {
      return selectedLeads.includes(l.id);
    }
    const roleMatch = targetRoles.length === 0 || (
      l.role && targetRoles.some(r => r.toLowerCase() === l.role?.toLowerCase())
    );
    const nicheMatch = targetNiches.length === 0 || (
      l.niche && targetNiches.some(n => n.toLowerCase() === l.niche?.toLowerCase())
    );

    let leadTags: string[] = [];
    if (Array.isArray(l.tags)) {
      leadTags = l.tags;
    } else if (typeof l.tags === 'string' && l.tags) {
      leadTags = (l.tags as string).split(',').map(t => t.trim());
    }

    const tagMatch = targetTags.length === 0 || (
      leadTags.length > 0 && leadTags.some(t => 
        targetTags.some(sel => sel.toLowerCase() === t.toLowerCase())
      )
    );
    return roleMatch && nicheMatch && tagMatch;
  });

  const allCampaignTags = Array.from(
    new Set(
      campaigns.flatMap(c => c.targetSegments?.tags || [])
    )
  ).filter(Boolean) as string[];

  const filteredCampaigns = campaigns.filter(camp => {
    const matchesSearch = camp.title.toLowerCase().includes(campaignSearch.toLowerCase()) || 
                          camp.id.toLowerCase().includes(campaignSearch.toLowerCase());
    
    const matchesTag = campaignTagFilter === 'All' || 
                       (camp.targetSegments?.tags && camp.targetSegments.tags.includes(campaignTagFilter));
    
    return matchesSearch && matchesTag;
  });

  // Sequence steps state (start with 1 step, can add up to 5)
  const [steps, setSteps] = useState<Omit<CampaignStep, 'id'>[]>([
    {
      subject: 'Interview request: Pitching {{guest_name}} for your podcast',
      bodyTemplate: 'Hi Host,\n\nI’ve been listening to your podcast and love your episodes about {{niche}}. I wanted to pitch {{guest_name}} as a guest. He/She has extensive expertise in {{niche}} and can talk on: {{topics}}.\n\nLet me know if you’d like to book an interview!\n\nBest regards,\nPR Team',
      delayDays: 0
    }
  ]);

  const [activeTab, setActiveTab] = useState<'campaigns' | 'queue' | 'templates'>('campaigns');

  // Sync autoApproveQueue with localStorage
  useEffect(() => {
    localStorage.setItem('auto_approve_queue', String(autoApproveQueue));
  }, [autoApproveQueue]);

  // Client-side background Auto-Approve loop
  useEffect(() => {
    if (autoApproveQueue) {
      const pendingLeads = leads.filter(l => l.status === 'new');
      if (pendingLeads.length > 0 && campaigns.length > 0) {
        const activeCampaign = campaigns[0];
        if (activeCampaign) {
          const runAutoApprove = async () => {
            for (const lead of pendingLeads) {
              try {
                await sendCampaignImmediate(activeCampaign.id, lead.id);
              } catch (err) {
                console.error(`Auto-approve failed for ${lead.name}:`, err);
              }
            }
          };
          runAutoApprove();
        }
      }
    }
  }, [leads, autoApproveQueue, campaigns]);
  const [previewLeadId, setPreviewLeadId] = useState<string | null>(null);
  const [previewStepIdx, setPreviewStepIdx] = useState<number>(0);

  // Email Preview Modal States
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [modalSubject, setModalSubject] = useState('');
  const [modalBody, setModalBody] = useState('');
  const [modalLead, setModalLead] = useState<Lead | null>(null);
  const [modalCampaign, setModalCampaign] = useState<Campaign | null>(null);
  const [isSendingFromModal, setIsSendingFromModal] = useState(false);

  const simulateEngagement = async (outreachId: string, type: 'open' | 'reply') => {
    try {
      const response = await fetch(`/api/outreach/${outreachId}/simulate-activity`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ type })
      });
      if (response.ok) {
        await refreshData();
      }
    } catch (err) {
      console.error('Error simulating engagement:', err);
    }
  };

  // Reusable Script Templates Management States
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [tTitle, setTTitle] = useState('');
  const [tSubject, setTSubject] = useState('');
  const [tBody, setTBody] = useState('');
  const [tCategory, setTCategory] = useState('General');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);


  // Add another step to outreach sequence (limit to 5)
  const addStep = () => {
    if (steps.length >= 5) return;
    setSteps([
      ...steps,
      {
        subject: 'Follow-up regarding interview request: {{guest_name}}',
        bodyTemplate: 'Hi Host,\n\nJust following up on my previous pitch regarding booking {{guest_name}} as a guest. Let me know if you have any open slots in your recording schedule!\n\nBest,\nPR Team',
        delayDays: 3
      }
    ]);
  };

  const removeStep = (index: number) => {
    if (steps.length === 1) return;
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleStepChange = (index: number, field: keyof Omit<CampaignStep, 'id'>, value: any) => {
    const updated = [...steps];
    updated[index] = { ...updated[index], [field]: value };
    setSteps(updated);
  };

  const handleLeadToggle = (leadId: string) => {
    if (selectedLeads.includes(leadId)) {
      setSelectedLeads(selectedLeads.filter(id => id !== leadId));
    } else {
      setSelectedLeads([...selectedLeads, leadId]);
    }
  };

  const handleSaveCampaign = async (e: React.FormEvent) => {
    e.preventDefault();

    // Filter matching leads based on manual exclusions
    const finalTargetedLeads = targetingMode === 'segment'
      ? matchingLeads.filter(l => !excludedLeadIds.includes(l.id))
      : matchingLeads;

    if (!campaignTitle || finalTargetedLeads.length === 0) {
      alert('Please select or match at least one prospect to create this campaign.');
      return;
    }

    // Build unique IDs for steps
    const formattedSteps: CampaignStep[] = steps.map((s, idx) => ({
      ...s,
      id: s.id || `step_${idx}_${Date.now()}`
    }));

    const campaignPayload = {
      title: campaignTitle,
      leadIds: finalTargetedLeads.map(l => l.id),
      steps: formattedSteps,
      dailySendLimit,
      clientId: selectedClientId || undefined,
      senderEmail: senderEmail || undefined,
      targetSegments: targetingMode === 'segment' ? {
        roles: targetRoles,
        niches: targetNiches,
        tags: targetTags
      } : undefined,
      excludedLeadIds: targetingMode === 'segment' ? excludedLeadIds : [],
      timezone,
      preferredTime,
      sendDays: deliveryDaysMode === 'custom' ? selectedCustomDays : deliveryDaysMode
    };

    if (editingCampaign) {
      await updateCampaign(editingCampaign.id, {
        ...editingCampaign,
        ...campaignPayload
      });
    } else {
      await createCampaign({
        ...campaignPayload,
        status: 'draft'
      });
    }

    // Reset Form
    setCampaignTitle('');
    setSelectedLeads([]);
    setTargetRoles([]);
    setTargetNiches([]);
    setTargetTags([]);
    setExcludedLeadIds([]);
    setTargetingMode('individual');
    setTimezone("Prospect's Local");
    setPreferredTime('09:00');
    setDeliveryDaysMode('weekdays');
    setSelectedCustomDays(['1', '2', '3', '4', '5']);
    setSelectedClientId('');
    setSenderEmail('');
    setEditingCampaign(null);
    setSteps([
      {
        subject: 'Interview request: Pitching {{guest_name}} for your podcast',
        bodyTemplate: 'Hi Host,\n\nI’ve been listening to your podcast and love your episodes about {{niche}}. I wanted to pitch {{guest_name}} as a guest. He/She has extensive expertise in {{niche}} and can talk on: {{topics}}.\n\nLet me know if you’d like to book an interview!\n\nBest regards,\nPR Team',
        delayDays: 0
      }
    ]);
    setShowCreateForm(false);
  };

  const handleSendCampaignTest = async (campaignId: string) => {
    if (!testLeadId || !testEmailInput) {
      setTestSendResult({ type: 'error', message: 'Please select a prospect and enter a valid test email address.' });
      return;
    }
    setIsTestSending(true);
    setTestSendResult(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/test-send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          leadId: testLeadId,
          testEmail: testEmailInput,
          stepIndex: testStepIndex
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send campaign test email');
      }
      setTestSendResult({ type: 'success', message: 'Success! Test email sent successfully via Gmail API.' });
    } catch (err: any) {
      setTestSendResult({ type: 'error', message: err.message || 'Failed to send test email.' });
    } finally {
      setIsTestSending(false);
    }
  };

  const [isTicking, setIsTicking] = useState(false);
  const handleManualTick = async () => {
    setIsTicking(true);
    try {
      const res = await fetch('/api/campaigns/tick', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        alert('Automation sequence tick triggered successfully! Emails matching the current date & UTC timezone schedules will execute immediately.');
        await refreshData();
      } else {
        alert('Failed to trigger automation sequence tick.');
      }
    } catch (err: any) {
      alert(`Error triggering manual tick: ${err.message}`);
    } finally {
      setIsTicking(false);
    }
  };

  // Helper to substitute placeholders for front-end previewing
  const getPersonalizedPreview = (template: string, lead: Lead) => {
    return template
      .replace(/\{\{guest_name\}\}/g, lead.name)
      .replace(/\{\{bio\}\}/g, lead.bio || '')
      .replace(/\{\{niche\}\}/g, lead.niche || '')
      .replace(/\{\{topics\}\}/g, (lead.topics || []).join(', '))
      .replace(/\{\{website\}\}/g, lead.website || '');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Tab Navigation */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-3">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('campaigns')}
            className={`text-lg font-sans font-bold pb-2 border-b-2 transition-all ${
              activeTab === 'campaigns'
                ? 'text-emerald-400 border-emerald-400'
                : 'text-slate-400 border-transparent hover:text-white'
            }`}
          >
            Campaign Sequences
          </button>
          <button
            onClick={() => setActiveTab('templates')}
            className={`text-lg font-sans font-bold pb-2 border-b-2 transition-all ${
              activeTab === 'templates'
                ? 'text-emerald-400 border-emerald-400'
                : 'text-slate-400 border-transparent hover:text-white'
            }`}
          >
            Script Templates
          </button>
          <button
            onClick={() => setActiveTab('queue')}
            className={`text-lg font-sans font-bold pb-2 border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'queue'
                ? 'text-emerald-400 border-emerald-400'
                : 'text-slate-400 border-transparent hover:text-white'
            }`}
          >
            Approval Queue (HITL Gate)
            <span className="bg-emerald-500 text-slate-950 font-mono font-bold text-xs px-2 py-0.5 rounded-full">
              {leads.filter(l => l.status === 'new').length}
            </span>
          </button>
        </div>
        {activeTab === 'campaigns' && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleManualTick}
              disabled={isTicking}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 font-sans font-semibold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isTicking ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Running tick...
                </>
              ) : (
                <>
                  <Clock className="w-4 h-4 text-emerald-400" />
                  Trigger Manual Run
                </>
              )}
            </button>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-sans font-semibold px-4 py-2 rounded-lg text-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Campaign Sequence
            </button>
          </div>
        )}
        {activeTab === 'templates' && (
          <button
            onClick={() => {
              setEditingTemplateId(null);
              setTTitle('');
              setTSubject('');
              setTBody('');
              setTCategory('General');
              setShowTemplateForm(!showTemplateForm);
            }}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-sans font-semibold px-4 py-2 rounded-lg text-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            {showTemplateForm ? 'Close Template Editor' : 'Create Outreach Template'}
          </button>
        )}
      </div>

      {activeTab === 'campaigns' && (
        <>
          {/* Create Campaign Sequence Form */}
          {showCreateForm && (
            <form onSubmit={handleSaveCampaign} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-6 animate-fade-in">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-sm font-sans font-bold text-white">
                  {editingCampaign ? `Edit Outreach Sequence: ${editingCampaign.title}` : 'New Outreach Sequence'}
                </h3>
                <span className="text-[10px] font-mono text-slate-400">Up to 5 steps automated follow-ups</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Campaign Title</label>
                  <input
                    type="text"
                    value={campaignTitle}
                    onChange={(e) => setCampaignTitle(e.target.value)}
                    placeholder="e.g. Fintech Guest Pitch Q3"
                    required
                    className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Daily Deliverability Limit</label>
                  <input
                    type="number"
                    value={dailySendLimit}
                    onChange={(e) => setDailySendLimit(Number(e.target.value))}
                    max={150}
                    min={5}
                    className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Link Brand Client (Optional)</label>
                  <select
                    value={selectedClientId}
                    onChange={(e) => setSelectedClientId(e.target.value)}
                    className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">-- No Linked Client --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name} {c.podcastName ? `(${c.podcastName})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Sender Gmail Account</label>
                  <select
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    className="w-full bg-slate-950 text-slate-100 border border-emerald-500/20 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="">Default (First Connected Account)</option>
                    {connectedAccounts && connectedAccounts.map((acc: any) => (
                      <option key={acc.id} value={acc.email}>{acc.email} {acc.isSimulated ? '(Simulated)' : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Targeting Mode */}
              <div className="space-y-3 bg-slate-950/40 p-4 border border-slate-800 rounded-lg">
                <label className="text-xs font-mono uppercase tracking-wider text-emerald-400 block">Targeting & Segmentation</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="targetingMode"
                      value="segment"
                      checked={targetingMode === 'segment'}
                      onChange={() => setTargetingMode('segment')}
                      className="text-emerald-500 focus:ring-0"
                    />
                    <span>Target by Segments (Tags, Niches, Roles)</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="radio"
                      name="targetingMode"
                      value="individual"
                      checked={targetingMode === 'individual'}
                      onChange={() => setTargetingMode('individual')}
                      className="text-emerald-500 focus:ring-0"
                    />
                    <span>Target Individual Prospects Manually</span>
                  </label>
                </div>

                {targetingMode === 'segment' ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 animate-fade-in">
                    {/* Role segment */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-medium text-slate-400">Prospect Role Segment</label>
                      <div className="flex gap-3 mt-1">
                        <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={targetRoles.includes('guest')}
                            onChange={(e) => {
                              if (e.target.checked) setTargetRoles([...targetRoles, 'guest']);
                              else setTargetRoles(targetRoles.filter(r => r !== 'guest'));
                            }}
                            className="rounded bg-slate-900 border-slate-800 text-emerald-500"
                          />
                          <span>Guests</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={targetRoles.includes('host')}
                            onChange={(e) => {
                              if (e.target.checked) setTargetRoles([...targetRoles, 'host']);
                              else setTargetRoles(targetRoles.filter(r => r !== 'host'));
                            }}
                            className="rounded bg-slate-900 border-slate-800 text-emerald-500"
                          />
                          <span>Hosts</span>
                        </label>
                      </div>
                    </div>

                    {/* Niche list */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-medium text-slate-400">Niche Categories</label>
                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 h-24 overflow-y-auto flex flex-wrap gap-1.5">
                        {uniqueNiches.map(n => {
                          const isSelected = targetNiches.includes(n);
                          return (
                            <button
                              key={n}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setTargetNiches(targetNiches.filter(x => x !== n));
                                } else {
                                  setTargetNiches([...targetNiches, n]);
                                }
                              }}
                              className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all cursor-pointer border ${
                                isSelected
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-semibold'
                                  : 'bg-slate-900 text-slate-400 border-slate-800/80 hover:text-slate-300 hover:border-slate-700'
                              }`}
                            >
                              {n}
                            </button>
                          );
                        })}
                        {uniqueNiches.length === 0 && (
                          <span className="text-[10px] text-slate-500 italic">No niches found in CRM</span>
                        )}
                      </div>
                    </div>

                    {/* Tag list */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-medium text-slate-400">Target Tags</label>
                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 h-24 overflow-y-auto flex flex-wrap gap-1.5">
                        {uniqueTags.map(t => {
                          const isSelected = targetTags.includes(t);
                          return (
                            <button
                              key={t}
                              type="button"
                              onClick={() => {
                                if (isSelected) {
                                  setTargetTags(targetTags.filter(x => x !== t));
                                } else {
                                  setTargetTags([...targetTags, t]);
                                }
                              }}
                              className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all cursor-pointer border ${
                                isSelected
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 font-semibold'
                                  : 'bg-slate-900 text-slate-400 border-slate-800/80 hover:text-slate-300 hover:border-slate-700'
                              }`}
                            >
                              {t}
                            </button>
                          );
                        })}
                        {uniqueTags.length === 0 && (
                          <span className="text-[10px] text-slate-500 italic">No tags found in CRM</span>
                        )}
                      </div>
                    </div>
                    {/* Matched Prospects Checklist with Manual Exclude */}
                    {matchingLeads.length > 0 && (
                      <div className="space-y-2 pt-3 border-t border-slate-800/60 mt-3 animate-fade-in col-span-1 md:col-span-3 text-left">
                        <label className="text-[10px] font-mono uppercase tracking-wider text-slate-400 block font-bold">
                          Matched Prospects List (Uncheck to Exclude)
                        </label>
                        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 max-h-36 overflow-y-auto space-y-1.5 text-left">
                          {matchingLeads.map(lead => {
                            const isExcluded = excludedLeadIds.includes(lead.id);
                            return (
                              <label key={lead.id} className="flex items-center gap-2.5 text-xs text-slate-300 hover:text-white cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={!isExcluded}
                                  onChange={() => {
                                    if (isExcluded) {
                                      setExcludedLeadIds(excludedLeadIds.filter(id => id !== lead.id));
                                    } else {
                                      setExcludedLeadIds([...excludedLeadIds, lead.id]);
                                    }
                                  }}
                                  className="rounded bg-slate-900 border-slate-800 text-emerald-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                                />
                                <span className="font-semibold text-slate-200">{lead.name}</span>
                                <span className="text-[10px] font-mono text-slate-500">
                                  ({lead.contactEmails[0]}, role: {lead.role || 'unassigned'}, niche: {lead.niche || 'unassigned'})
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2 pt-2 animate-fade-in">
                    <label className="text-xs font-medium text-slate-300">Select Individual Prospects</label>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 max-h-36 overflow-y-auto space-y-1.5">
                      {leads.map(lead => (
                        <label key={lead.id} className="flex items-center gap-2.5 text-xs text-slate-300 hover:text-white cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedLeads.includes(lead.id)}
                            onChange={() => handleLeadToggle(lead.id)}
                            className="rounded bg-slate-900 border-slate-800 text-emerald-500 focus:ring-0 focus:ring-offset-0"
                          />
                          <span className="font-semibold">{lead.name}</span>
                          <span className="text-[10px] font-mono text-slate-500">({lead.contactEmails[0]}, role: {lead.role || 'unassigned'}, niche: {lead.niche || 'unassigned'})</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Live Preview of Matching Leads */}
                <div className="text-[10px] text-slate-400 bg-slate-900/50 px-3 py-2 border border-slate-800 rounded-lg flex items-center justify-between">
                  <span>Matching prospects currently targeted:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {matchingLeads.length} prospect{matchingLeads.length !== 1 ? 's' : ''} matched
                  </span>
                </div>
              </div>

              {/* Timezone & Scheduling Format */}
              <div className="space-y-3 bg-slate-950/40 p-4 border border-slate-800 rounded-lg">
                <label className="text-xs font-mono uppercase tracking-wider text-emerald-400 block">Timezone & Scheduling Format</label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-slate-400">Preferred Timezone</label>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className="w-full bg-slate-900 text-slate-100 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="Prospect's Local">Prospect's Local (Auto-Detect)</option>
                      <option value="UTC">UTC (Coordinated Universal Time)</option>
                      <option value="America/New_York">EST / EDT (Eastern Time)</option>
                      <option value="America/Chicago">CST / CDT (Central Time)</option>
                      <option value="America/Denver">MST / MDT (Mountain Time)</option>
                      <option value="America/Los_Angeles">PST / PDT (Pacific Time)</option>
                      <option value="Europe/London">GMT / BST (London Time)</option>
                      <option value="Europe/Paris">CET / CEST (Paris Time)</option>
                      <option value="Europe/Athens">EET / EEST (Athens Time)</option>
                      <option value="Asia/Dubai">GST (Gulf Time, UTC+4)</option>
                      <option value="Asia/Kolkata">IST (India Time, UTC+5.5)</option>
                      <option value="Asia/Dhaka">BST (Bangladesh Time, UTC+6)</option>
                      <option value="Asia/Singapore">SGT (Singapore Time, UTC+8)</option>
                      <option value="Asia/Tokyo">JST (Japan Time, UTC+9)</option>
                      <option value="Australia/Sydney">AEST / AEDT (Sydney Time)</option>
                      <option value="Pacific/Auckland">NZST / NZDT (Auckland Time)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-slate-400">Preferred Daily Send Time</label>
                    <input
                      type="time"
                      value={preferredTime}
                      onChange={(e) => setPreferredTime(e.target.value)}
                      className="w-full bg-slate-900 text-slate-100 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-medium text-slate-400">Delivery Days Constraint</label>
                    <select
                      value={deliveryDaysMode}
                      onChange={(e) => setDeliveryDaysMode(e.target.value as any)}
                      className="w-full bg-slate-900 text-slate-100 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                    >
                      <option value="weekdays">Weekdays Only (Mon-Fri, High Open Rate)</option>
                      <option value="everyday">Every Day (Mon-Sun, Fast Execution)</option>
                      <option value="custom">Custom Days (Select specific days of week)</option>
                    </select>

                    {deliveryDaysMode === 'custom' && (
                      <div className="mt-2.5 space-y-1.5 animate-fade-in">
                        <label className="text-[10px] font-medium text-slate-400">Select Allowed Days</label>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { label: 'S', value: '0', name: 'Sunday' },
                            { label: 'M', value: '1', name: 'Monday' },
                            { label: 'T', value: '2', name: 'Tuesday' },
                            { label: 'W', value: '3', name: 'Wednesday' },
                            { label: 'T', value: '4', name: 'Thursday' },
                            { label: 'F', value: '5', name: 'Friday' },
                            { label: 'S', value: '6', name: 'Saturday' }
                          ].map(day => {
                            const isSelected = selectedCustomDays.includes(day.value);
                            return (
                              <button
                                key={day.value}
                                type="button"
                                title={day.name}
                                onClick={() => {
                                  if (isSelected) {
                                    if (selectedCustomDays.length > 1) {
                                      setSelectedCustomDays(selectedCustomDays.filter(d => d !== day.value));
                                    }
                                  } else {
                                    setSelectedCustomDays([...selectedCustomDays, day.value]);
                                  }
                                }}
                                className={`w-8 h-8 rounded-full font-semibold text-xs transition-all flex items-center justify-center border cursor-pointer ${
                                  isSelected
                                    ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-bold shadow-md shadow-emerald-500/10'
                                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white hover:border-slate-700'
                                }`}
                              >
                                {day.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Sequence Steps Builder with Quick Tips Sidebar */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="lg:col-span-3 space-y-4 text-left">
                  <h4 className="text-xs font-sans font-bold text-emerald-400">Campaign Sequence Steps</h4>
                  {steps.map((step, idx) => (
                    <div key={idx} className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3 relative text-left">
                      <div className="flex justify-between items-center gap-4">
                        <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[10px] font-bold">
                          STEP {idx + 1}
                        </span>
                        
                        {templates && templates.length > 0 && (
                          <div className="flex items-center gap-1.5 ml-auto">
                            <span className="text-[10px] text-slate-500 font-mono">Quick load template:</span>
                            <select
                              onChange={(e) => {
                                const t = templates.find(item => item.id === e.target.value);
                                if (t) {
                                  handleStepChange(idx, 'subject', t.subject);
                                  handleStepChange(idx, 'bodyTemplate', t.bodyTemplate);
                                }
                                e.target.value = ''; // reset
                              }}
                              className="bg-slate-900 text-slate-300 border border-slate-800 rounded px-1.5 py-0.5 text-[10px] focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                            >
                              <option value="">-- Choose Template --</option>
                              {templates.map(t => (
                                <option key={t.id} value={t.id}>{t.title} ({t.category})</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {steps.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeStep(idx)}
                            className="text-xs text-red-400 hover:text-red-300 font-mono cursor-pointer"
                          >
                            Delete
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-2 space-y-1">
                          <label className="text-[10px] text-slate-400">Subject Template (supports place-holders like {"{{guest_name}}"})</label>
                          <input
                            type="text"
                            value={step.subject}
                            onChange={(e) => handleStepChange(idx, 'subject', e.target.value)}
                            required
                            className="w-full bg-slate-900 text-slate-100 border border-slate-800 rounded p-1.5 text-xs focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400">Send Delay Days (after previous step)</label>
                          <input
                            type="number"
                            value={step.delayDays}
                            onChange={(e) => handleStepChange(idx, 'delayDays', Number(e.target.value))}
                            required
                            className="w-full bg-slate-900 text-slate-100 border border-slate-800 rounded p-1.5 text-xs focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400">Body Template</label>
                        <textarea
                          value={step.bodyTemplate}
                          onChange={(e) => handleStepChange(idx, 'bodyTemplate', e.target.value)}
                          rows={4}
                          required
                          className="w-full bg-slate-900 text-slate-100 border border-slate-800 rounded p-1.5 text-xs font-mono focus:outline-none"
                        />
                      </div>
                    </div>
                  ))}

                  {steps.length < 5 && (
                    <button
                      type="button"
                      onClick={addStep}
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-sans flex items-center gap-1 cursor-pointer"
                    >
                      + Add Sequence Step (Follow-up)
                    </button>
                  )}
                </div>

                {/* Sticky Quick Tips & Tokens Panel */}
                <div className="lg:col-span-1 bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4 self-start sticky top-4 text-left">
                  <div>
                    <h4 className="text-xs font-sans font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wider">
                      <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
                      Quick Tips & Tokens
                    </h4>
                    <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">
                      Click any dynamic token below to instantly copy it. You can paste it into your Subject or Body templates to inject real prospect/client variables.
                    </p>
                  </div>
                  
                  <div className="space-y-2">
                    <h5 className="text-[9px] font-mono uppercase text-slate-500 tracking-wider font-bold">Prospect Fields</h5>
                    <div className="space-y-1.5">
                      {[
                        { token: '{{guest_name}}', desc: 'Prospect full name' },
                        { token: '{{niche}}', desc: 'Niche / Category' },
                        { token: '{{topics}}', desc: 'Speaking topics list' },
                        { token: '{{bio}}', desc: 'Brief guest biography' },
                        { token: '{{website}}', desc: 'Website address' },
                        { token: '{{podcast}}', desc: 'Show / Organization' }
                      ].map(item => (
                        <button
                          key={item.token}
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(item.token);
                            alert(`Copied "${item.token}" to clipboard!`);
                          }}
                          className="px-2 py-1 bg-slate-900 border border-slate-800 rounded text-[10px] font-mono text-emerald-300 hover:text-emerald-200 hover:border-slate-700 hover:bg-slate-850 cursor-pointer flex flex-col items-start gap-0.5 w-full text-left transition-all"
                        >
                          <span className="font-bold text-emerald-400">{item.token}</span>
                          <span className="text-[9px] text-slate-500 font-sans">{item.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-slate-800/60 pt-3">
                    <h5 className="text-[9px] font-mono uppercase text-slate-500 tracking-wider font-bold">Linked Client Fields</h5>
                    <div className="space-y-1.5">
                      {[
                        { token: '{{client_name}}', desc: 'Client brand name' },
                        { token: '{{client_podcast}}', desc: 'Client podcast show' },
                        { token: '{{client_niche}}', desc: 'Client industry niche' },
                        { token: '{{client_description}}', desc: 'Client description / pitch' }
                      ].map(item => (
                        <button
                          key={item.token}
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(item.token);
                            alert(`Copied "${item.token}" to clipboard!`);
                          }}
                          className="px-2 py-1 bg-slate-900 border border-slate-800 rounded text-[10px] font-mono text-indigo-300 hover:text-indigo-200 hover:border-slate-700 hover:bg-slate-850 cursor-pointer flex flex-col items-start gap-0.5 w-full text-left transition-all"
                        >
                          <span className="font-bold text-indigo-400">{item.token}</span>
                          <span className="text-[9px] text-slate-500 font-sans">{item.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingCampaign(null);
                    setSelectedClientId('');
                    setCampaignTitle('');
                    setSteps([
                      {
                        subject: 'Interview request: Pitching {{guest_name}} for your podcast',
                        bodyTemplate: 'Hi Host,\n\nI’ve been listening to your podcast and love your episodes about {{niche}}. I wanted to pitch {{guest_name}} as a guest. He/She has extensive expertise in {{niche}} and can talk on: {{topics}}.\n\nLet me know if you’d like to book an interview!\n\nBest regards,\nPR Team',
                        delayDays: 0
                      }
                    ]);
                  }}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold text-xs cursor-pointer"
                >
                  {editingCampaign ? 'Save Changes' : 'Save Campaign Sequence'}
                </button>
              </div>
            </form>
          )}

          {/* Campaigns Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-3 bg-slate-900 border border-slate-800 p-4 rounded-xl items-center justify-between shadow-sm my-4">
            <div className="relative w-full sm:w-72">
              <input
                type="text"
                value={campaignSearch}
                onChange={(e) => setCampaignSearch(e.target.value)}
                placeholder="Search campaigns by name or ID..."
                className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <span className="text-[10px] text-slate-400 font-mono uppercase whitespace-nowrap">Filter by Tag:</span>
              <select
                value={campaignTagFilter}
                onChange={(e) => setCampaignTagFilter(e.target.value)}
                className="bg-slate-950 text-slate-200 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
              >
                <option value="All">All Campaign Tags</option>
                {allCampaignTags.map(tag => (
                  <option key={tag} value={tag}>{tag}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Campaigns Lists */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredCampaigns.map((camp) => (
              <div key={camp.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 
                      onClick={() => setSelectedCampaignDetails(camp)}
                      className="text-base font-sans font-bold text-white hover:text-emerald-400 cursor-pointer transition-colors flex items-center gap-1.5"
                      title="Click to view detailed campaign tracking & metrics"
                    >
                      {camp.title}
                      <span className="text-[10px] text-slate-500 font-normal underline hover:text-emerald-300">(details)</span>
                    </h3>
                    <p className="text-[10px] font-mono text-slate-400">ID: {camp.id}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                    camp.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {camp.status}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                  <div>
                    <p className="text-[10px] text-slate-500">STEPS</p>
                    <p className="text-sm font-semibold text-white">{camp.steps.length}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">LEADS</p>
                    <p className="text-sm font-semibold text-white">
                      {camp.targetSegments ? (
                        leads.filter(l => {
                          const { tags, niches, roles } = camp.targetSegments!;
                          const roleMatch = !roles || roles.length === 0 || (l.role && roles.some(r => r.toLowerCase() === l.role?.toLowerCase()));
                          const nicheMatch = !niches || niches.length === 0 || (l.niche && niches.some(n => n.toLowerCase() === l.niche?.toLowerCase()));
                          
                          let leadTags: string[] = [];
                          if (Array.isArray(l.tags)) {
                            leadTags = l.tags;
                          } else if (typeof l.tags === 'string' && l.tags) {
                            leadTags = (l.tags as string).split(',').map(t => t.trim());
                          }

                          const tagMatch = !tags || tags.length === 0 || (
                            leadTags.length > 0 && leadTags.some(t => tags.some(sel => sel.toLowerCase() === t.toLowerCase()))
                          );
                          return roleMatch && nicheMatch && tagMatch;
                        }).length
                      ) : (
                        camp.leadIds.length
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500">SEND LIMIT</p>
                    <p className="text-sm font-semibold text-white">{camp.dailySendLimit}/day</p>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  <button
                    onClick={async () => {
                      if (confirm(`Are you sure you want to delete campaign "${camp.title}"? This cannot be undone.`)) {
                        await deleteCampaign(camp.id);
                      }
                    }}
                    className="px-3 py-1 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs flex items-center gap-1 transition-colors cursor-pointer mr-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedCampaignDetails(camp)}
                    className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 text-xs flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Details & Test Run
                  </button>

                  <button
                    onClick={() => {
                      setEditingCampaign(camp);
                      setCampaignTitle(camp.title);
                      setDailySendLimit(camp.dailySendLimit);
                      setSelectedLeads(camp.leadIds);
                      setTargetingMode(camp.targetSegments ? 'segment' : 'individual');
                      setTargetRoles(camp.targetSegments?.roles || []);
                      setTargetNiches(camp.targetSegments?.niches || []);
                      setTargetTags(camp.targetSegments?.tags || []);

                      // Pre-populate excluded lead IDs
                      if (camp.excludedLeadIds) {
                        setExcludedLeadIds(camp.excludedLeadIds);
                      } else if (camp.targetSegments) {
                        const roles = camp.targetSegments.roles || [];
                        const niches = camp.targetSegments.niches || [];
                        const tags = camp.targetSegments.tags || [];
                        const matched = leads.filter(l => {
                          const roleMatch = roles.length === 0 || (l.role && roles.some(r => r.toLowerCase() === l.role?.toLowerCase()));
                          const nicheMatch = niches.length === 0 || (l.niche && niches.some(n => n.toLowerCase() === l.niche?.toLowerCase()));
                          
                          let leadTags: string[] = [];
                          if (Array.isArray(l.tags)) leadTags = l.tags;
                          else if (typeof l.tags === 'string' && l.tags) leadTags = l.tags.split(',').map(t => t.trim());
                          
                          const tagMatch = tags.length === 0 || (leadTags.length > 0 && leadTags.some(t => tags.some(sel => sel.toLowerCase() === t.toLowerCase())));
                          return roleMatch && nicheMatch && tagMatch;
                        });
                        const excluded = matched.filter(l => !camp.leadIds.includes(l.id)).map(l => l.id);
                        setExcludedLeadIds(excluded);
                      } else {
                        setExcludedLeadIds([]);
                      }

                      setTimezone(camp.timezone || "Prospect's Local");
                      setPreferredTime(camp.preferredTime || '09:00');
                      if (camp.sendDays === 'weekdays' || camp.sendDays === 'everyday') {
                        setDeliveryDaysMode(camp.sendDays as any);
                      } else {
                        setDeliveryDaysMode('custom');
                        setSelectedCustomDays(camp.sendDays || []);
                      }
                      setSteps(camp.steps.map(s => ({ ...s })));
                      setSelectedClientId(camp.clientId || '');
                      setSenderEmail(camp.senderEmail || '');
                      setShowCreateForm(true);
                    }}
                    className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 border border-slate-700 text-xs flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit
                  </button>

                  {camp.status === 'draft' ? (
                    <button
                      onClick={() => updateCampaignStatus(camp.id, 'active')}
                      className="px-3 py-1 rounded bg-emerald-500 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Activate
                    </button>
                  ) : (
                    <button
                      onClick={() => updateCampaignStatus(camp.id, 'draft')}
                      className="px-3 py-1 rounded bg-slate-800 text-slate-300 font-semibold text-xs flex items-center gap-1.5 border border-slate-700 transition-colors cursor-pointer"
                    >
                      <Pause className="w-3.5 h-3.5" />
                      Pause
                    </button>
                  )}
                </div>
              </div>
            ))}
            {campaigns.length === 0 && (
              <div className="md:col-span-2 text-center text-slate-500 font-sans py-12 bg-slate-900 border border-slate-800 rounded-xl">
                No campaign sequences defined yet. Click "Create Campaign Sequence" to launch your first PR flow.
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'templates' && (
        <div className="space-y-6">
          {/* Template Creation/Editing Form */}
          {showTemplateForm && (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (!tTitle || !tSubject || !tBody) return;
                setIsSavingTemplate(true);
                try {
                  await saveTemplate({
                    id: editingTemplateId || undefined,
                    title: tTitle,
                    subject: tSubject,
                    bodyTemplate: tBody,
                    category: tCategory
                  });
                  // Reset form
                  setTTitle('');
                  setTSubject('');
                  setTBody('');
                  setTCategory('General');
                  setEditingTemplateId(null);
                  setShowTemplateForm(false);
                } catch (err) {
                  console.error(err);
                } finally {
                  setIsSavingTemplate(false);
                }
              }}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 animate-fade-in animate-fade-in"
            >
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-sm font-sans font-bold text-white">
                  {editingTemplateId ? 'Edit Outreach Template' : 'New Outreach Template'}
                </h3>
                <span className="text-[10px] font-mono text-slate-400">Save reusable scripts with personalized tokens</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-xs font-medium text-slate-300">Template Name / Title</label>
                  <input
                    type="text"
                    value={tTitle}
                    onChange={(e) => setTTitle(e.target.value)}
                    placeholder="e.g. Fintech Founder Outreach - Short Version"
                    required
                    className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">Guest Persona / Category</label>
                  <select
                    value={tCategory}
                    onChange={(e) => setTCategory(e.target.value)}
                    className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="General">General</option>
                    <option value="Fintech">Fintech</option>
                    <option value="Tech & SaaS">Tech & SaaS</option>
                    <option value="Health & Wellness">Health & Wellness</option>
                    <option value="Venture Capital">Venture Capital</option>
                    <option value="AI & Web3">AI & Web3</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">Subject Line Template</label>
                <input
                  type="text"
                  value={tSubject}
                  onChange={(e) => setTSubject(e.target.value)}
                  placeholder="e.g. Guest Interview request: {{guest_name}} for your podcast"
                  required
                  className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-2 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 space-y-1">
                  <label className="text-xs font-medium text-slate-300">Email Body Template</label>
                  <textarea
                    value={tBody}
                    onChange={(e) => setTBody(e.target.value)}
                    placeholder="Hi Host,&#10;&#10;I've been a listener of your podcast and loved your recent episode on {{niche}}.&#10;&#10;I wanted to pitch {{guest_name}} as a premium guest..."
                    rows={8}
                    required
                    className="w-full bg-slate-950 text-slate-100 border border-slate-800 rounded-lg p-3 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed resize-y"
                  />
                </div>
                
                {/* Token explanation sidebar */}
                <div className="bg-slate-950 border border-slate-850 rounded-lg p-4 space-y-3">
                  <h4 className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5" />
                    Personalization Tokens
                  </h4>
                  <p className="text-[10px] text-slate-400 leading-relaxed">
                    Insert these tokens in your subject or body template. They will be auto-substituted with actual CRM prospect data during campaign execution:
                  </p>
                  <div className="space-y-2 font-mono text-[10px]">
                    <div className="bg-slate-900 border border-slate-800 p-1.5 rounded">
                      <span className="text-emerald-400 font-bold">{"{{guest_name}}"}</span>
                      <p className="text-[9px] text-slate-500 mt-0.5">Prospect's full name</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-1.5 rounded">
                      <span className="text-emerald-400 font-bold">{"{{niche}}"}</span>
                      <p className="text-[9px] text-slate-500 mt-0.5">Niche or industry focus</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-1.5 rounded">
                      <span className="text-emerald-400 font-bold">{"{{topics}}"}</span>
                      <p className="text-[9px] text-slate-500 mt-0.5">Speaking topics (comma-separated list)</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-1.5 rounded">
                      <span className="text-emerald-400 font-bold">{"{{bio}}"}</span>
                      <p className="text-[9px] text-slate-500 mt-0.5">Prospect bio</p>
                    </div>
                    <div className="bg-slate-900 border border-slate-800 p-1.5 rounded">
                      <span className="text-emerald-400 font-bold">{"{{website}}"}</span>
                      <p className="text-[9px] text-slate-500 mt-0.5">Prospect website URL</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowTemplateForm(false);
                    setEditingTemplateId(null);
                  }}
                  className="px-3.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingTemplate}
                  className="px-4 py-1.5 rounded bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-sans font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSavingTemplate ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Save Template
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* Categories / Persona Filters */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-900 border border-slate-850 p-1.5 rounded-lg">
            <span className="text-[10px] text-slate-500 font-mono uppercase px-2">Filter Category:</span>
            {['All', 'Fintech', 'Tech & SaaS', 'Health & Wellness', 'Venture Capital', 'AI & Web3', 'General'].map(cat => {
              const count = cat === 'All' ? templates.length : templates.filter(t => t.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1 text-xs rounded-md transition-all font-medium cursor-pointer ${
                    categoryFilter === cat
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'text-slate-400 hover:text-white border border-transparent'
                  }`}
                >
                  {cat} <span className="opacity-50 font-mono text-[10px]">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Templates Grid / Empty State */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates
              .filter(t => categoryFilter === 'All' || t.category === categoryFilter)
              .map(temp => (
                <div key={temp.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all shadow-sm">
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-slate-950 rounded-lg flex items-center justify-center text-emerald-400 border border-slate-800">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white leading-snug">{temp.title}</h4>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-950 rounded text-[9px] font-mono font-semibold text-slate-400 border border-slate-800/60 mt-1">
                            <Tag className="w-2.5 h-2.5 text-emerald-400" />
                            {temp.category}
                          </span>
                        </div>
                      </div>

                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setEditingTemplateId(temp.id);
                            setTTitle(temp.title);
                            setTSubject(temp.subject);
                            setTBody(temp.bodyTemplate);
                            setTCategory(temp.category);
                            setShowTemplateForm(true);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title="Edit Script Template"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm(`Are you sure you want to delete "${temp.title}"?`)) {
                              await deleteTemplate(temp.id);
                            }
                          }}
                          className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-red-400 transition-colors cursor-pointer"
                          title="Delete Script Template"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Subject line template:</p>
                      <div className="bg-slate-950 px-2.5 py-1.5 rounded border border-slate-850 text-xs text-slate-300 font-sans truncate">
                        {temp.subject}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider">Email body template:</p>
                      <div className="bg-slate-950 p-3 rounded border border-slate-850 text-xs text-slate-400 font-mono whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
                        {temp.bodyTemplate}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-850/60 pt-3 text-[10px] text-slate-500 flex items-center gap-1 font-mono">
                    <Sparkles className="w-3 h-3 text-emerald-400 animate-pulse" />
                    <span>Supports variable placeholders: guest_name, niche, topics, bio, website.</span>
                  </div>
                </div>
              ))}

            {templates.filter(t => categoryFilter === 'All' || t.category === categoryFilter).length === 0 && (
              <div className="md:col-span-2 text-center py-12 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
                <FileText className="w-8 h-8 text-slate-700 mx-auto" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-400">No script templates saved here yet.</p>
                  <p className="text-xs text-slate-500 max-w-md mx-auto px-4">
                    Create reusable script templates categorized by prospect guest personas so your team can easily load them during campaign design.
                  </p>
                </div>
                
                <button
                  type="button"
                  onClick={async () => {
                    const DEMO_TEMPLATES = [
                      {
                        title: 'Fintech Leader Persona Pitch',
                        subject: 'Guest Pitch: Fintech Founder {{guest_name}} for your podcast',
                        category: 'Fintech',
                        bodyTemplate: 'Hi Host,\n\nI’ve been listening to your show and love your episodes discussing finance, tech, and banking infrastructure.\n\nI wanted to pitch {{guest_name}} as a guest. He/She is a Fintech Founder who built a platform in {{niche}} with extensive background in scale. Some topics they can address:\n- The future of digital assets and banking\n- Scaling in highly regulated spaces\n- Key lessons from raising capital\n\nWould you be open to booking a short guest slot for an interview?\n\nBest,\nPR Team'
                      },
                      {
                        title: 'SaaS Executive PLG Pitch',
                        subject: 'Interview pitch: SaaS Expert {{guest_name}} on scaling products',
                        category: 'Tech & SaaS',
                        bodyTemplate: 'Hi Host,\n\nI love your episodes on modern software growth strategies. I’d love to pitch {{guest_name}} as a guest for your upcoming schedule.\n\n{{guest_name}} is a seasoned executive specializing in {{niche}} and Product-Led Growth (PLG). They can share actionable insights on:\n- Transitioning to product-led customer acquisition\n- Scaling remote engineering and product teams\n- The biggest mistakes in software pricing strategy\n\nWould this match your audience\'s current interests? Let me know if you have an open slot.\n\nBest regards,\nPR Team'
                      },
                      {
                        title: 'Health Practitioner Wellness Pitch',
                        subject: 'Pitch: Biohacking & Health Expert {{guest_name}} for your show',
                        category: 'Health & Wellness',
                        bodyTemplate: 'Hi Host,\n\nYour recent discussions on wellness and performance were fantastic. I wanted to propose {{guest_name}} as a premium guest.\n\n{{guest_name}} is an authority in {{niche}} with deep expertise in optimizing physical and mental performance. They are ready to discuss:\n- Evidence-based biohacking secrets for busy professionals\n- Overcoming fatigue through metabolic fitness\n- The science of high-performance sleep\n\nLet me know if this would be a great fit for a wellness segment!\n\nBest,\nPR Team'
                      }
                    ];
                    
                    for (const demo of DEMO_TEMPLATES) {
                      await saveTemplate(demo);
                    }
                  }}
                  className="px-4 py-2 bg-slate-950 text-emerald-400 border border-slate-800 rounded-lg hover:bg-slate-900 transition-colors text-xs font-semibold cursor-pointer"
                >
                  🌱 Load Professional Persona Templates
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'queue' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* List of pending approvals */}
          <div className="lg:col-span-1 space-y-3 bg-slate-900 border border-slate-800 p-4 rounded-xl max-h-[550px] overflow-y-auto flex flex-col text-left">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <h3 className="text-sm font-sans font-bold text-white">Pending Ingestion</h3>
              
              {/* Auto-Approve Toggle */}
              <button
                type="button"
                onClick={() => setAutoApproveQueue(!autoApproveQueue)}
                className={`flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono font-bold border transition-all cursor-pointer ${
                  autoApproveQueue
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 font-semibold'
                    : 'bg-slate-950 text-slate-500 border-slate-800'
                }`}
                title="Automatically approve and send newly parsed prospects"
              >
                <Sparkles className={`w-3 h-3 ${autoApproveQueue ? 'animate-pulse text-emerald-400' : ''}`} />
                {autoApproveQueue ? 'AUTO-APPROVE: ON' : 'AUTO-APPROVE: OFF'}
              </button>
            </div>

            {/* Bulk Selection / Actions Bar */}
            {leads.filter(l => l.status === 'new').length > 0 && (
              <div className="flex justify-between items-center bg-slate-950 p-2 border border-slate-800/80 rounded-lg gap-2 text-left">
                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={
                      leads.filter(l => l.status === 'new').length > 0 &&
                      leads.filter(l => l.status === 'new').every(l => selectedQueueLeadIds.includes(l.id))
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedQueueLeadIds(leads.filter(l => l.status === 'new').map(l => l.id));
                      } else {
                        setSelectedQueueLeadIds([]);
                      }
                    }}
                    className="rounded bg-slate-900 border-slate-800 text-emerald-500 focus:ring-0 cursor-pointer"
                  />
                  <span>Select All</span>
                </label>
                
                {selectedQueueLeadIds.length > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      const activeCampaign = campaigns[0];
                      if (!activeCampaign) {
                        alert('Please create a campaign sequence first under the campaigns tab!');
                        return;
                      }
                      if (confirm(`Are you sure you want to approve and send emails to ${selectedQueueLeadIds.length} selected prospects?`)) {
                        let successCount = 0;
                        for (const id of selectedQueueLeadIds) {
                          try {
                            await sendCampaignImmediate(activeCampaign.id, id);
                            successCount++;
                          } catch (err) {
                            console.error(`Bulk sending failed for lead ID ${id}:`, err);
                          }
                        }
                        setSelectedQueueLeadIds([]);
                        alert(`Successfully processed and sent emails to ${successCount} prospect(s)!`);
                      }
                    }}
                    className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-sans font-bold text-[10px] uppercase tracking-wider rounded-lg transition-colors cursor-pointer"
                  >
                    Send Selected ({selectedQueueLeadIds.length})
                  </button>
                )}
              </div>
            )}

            {/* List */}
            <div className="space-y-2 flex-1 overflow-y-auto">
              {leads.filter(l => l.status === 'new').map((lead) => {
                const isChecked = selectedQueueLeadIds.includes(lead.id);
                return (
                  <div
                    key={lead.id}
                    className={`p-3 rounded-lg border transition-all flex items-start gap-2 text-left ${
                      previewLeadId === lead.id
                        ? 'bg-slate-800 border-emerald-500/50 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900/40'
                    }`}
                  >
                    {/* Multi-select Checkbox */}
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        if (isChecked) {
                          setSelectedQueueLeadIds(selectedQueueLeadIds.filter(id => id !== lead.id));
                        } else {
                          setSelectedQueueLeadIds([...selectedQueueLeadIds, lead.id]);
                        }
                      }}
                      className="rounded bg-slate-900 border-slate-800 text-emerald-500 focus:ring-0 mt-1 cursor-pointer"
                    />
                    
                    {/* Remaining clickable card body */}
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewLeadId(lead.id);
                        setPreviewStepIdx(0);
                      }}
                      className="flex-1 text-left"
                    >
                      <p className="text-xs font-semibold">{lead.name}</p>
                      <p className="text-[10px] font-mono text-slate-400">{lead.contactEmails[0]}</p>
                      <div className="flex justify-between items-center mt-1">
                        <span className="text-[9px] bg-slate-850 px-1.5 py-0.5 rounded uppercase font-bold text-slate-400">
                          {lead.niche}
                        </span>
                        <span className="text-[9px] text-emerald-400 flex items-center gap-0.5">
                          <Sparkles className="w-2.5 h-2.5 animate-pulse" /> AI Ready
                        </span>
                      </div>
                    </button>
                  </div>
                );
              })}
              {leads.filter(l => l.status === 'new').length === 0 && (
                <div className="text-center text-xs text-slate-600 py-12">No pending manual approvals. All leads processed!</div>
              )}
            </div>
          </div>

          {/* Interactive Personalized Preview Panel */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-6 rounded-xl flex flex-col justify-between">
            {previewLeadId ? (
              (() => {
                const lead = leads.find(l => l.id === previewLeadId);
                const activeCampaign = campaigns[0]; // defaults to first available campaign
                if (!lead) return null;

                const step = activeCampaign?.steps[previewStepIdx];
                const subject = step ? getPersonalizedPreview(step.subject, lead) : '';
                const body = step ? getPersonalizedPreview(step.bodyTemplate, lead) : '';

                return (
                  <div className="space-y-4 flex-1 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                        <div>
                          <h3 className="text-sm font-sans font-bold text-white">Recipient: {lead.name}</h3>
                          <p className="text-xs text-slate-400 font-mono">Email: {lead.contactEmails[0]}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-300 font-sans font-medium">Campaign: {activeCampaign?.title || 'PR Default'}</p>
                          <p className="text-[10px] text-slate-500 font-mono">Step: {previewStepIdx + 1} of {activeCampaign?.steps.length || 1}</p>
                        </div>
                      </div>

                      {/* Subject */}
                      <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex items-center gap-2">
                        <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">Subject</span>
                        <span className="text-xs text-slate-200">{subject || 'No active campaigns created yet'}</span>
                      </div>

                      {/* Body */}
                      <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs font-mono text-slate-300 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto">
                        {body || 'Create a campaign sequence first under "Campaign Templates" to automatically generate drafts here.'}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-end gap-3 border-t border-slate-800 pt-4">
                      <button
                        onClick={() => {
                          setPreviewLeadId(null);
                        }}
                        className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs cursor-pointer"
                      >
                        Skip
                      </button>
                      <button
                        onClick={() => {
                          if (!activeCampaign) return alert('Please create a campaign templates sequence first!');
                          setModalSubject(subject);
                          setModalBody(body);
                          setModalLead(lead);
                          setModalCampaign(activeCampaign);
                          setIsPreviewModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded bg-slate-950 hover:bg-slate-900 text-emerald-400 border border-slate-800 text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                        Full Email Preview
                      </button>
                      <button
                        onClick={async () => {
                          if (!activeCampaign) return alert('Please create a campaign templates sequence first!');
                          await sendCampaignImmediate(activeCampaign.id, lead.id);
                          setPreviewLeadId(null);
                        }}
                        className="px-4 py-1.5 rounded bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-sans font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <Mail className="w-4 h-4" />
                        Approve & Send via Gmail
                      </button>
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="flex flex-col items-center justify-center text-center text-slate-500 py-24 space-y-3">
                <Mail className="w-8 h-8 text-slate-700" />
                <p className="font-sans text-xs">Select a prospect from the left queue to preview and personalize their Gmail pitch before sending.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Gmail-Style Email Preview Modal */}
      {isPreviewModalOpen && modalLead && (
        <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" id="email-preview-modal-overlay">
          <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden" id="email-preview-modal">
            {/* Gmail Top Header Bar */}
            <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className="bg-red-500/10 text-red-400 p-1 rounded font-mono font-bold text-[10px] tracking-wider uppercase">
                  GMAIL DRAFT
                </div>
                <h3 className="text-xs font-sans font-bold text-slate-200">Personalized Pitch Preview</h3>
              </div>
              <button
                onClick={() => setIsPreviewModalOpen(false)}
                className="text-slate-400 hover:text-white font-sans text-xs hover:bg-slate-800 px-2 py-1 rounded transition-colors cursor-pointer"
              >
                ✕ Close
              </button>
            </div>

            {/* Email Header Metadata */}
            <div className="p-4 border-b border-slate-800 bg-slate-900/50 space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <span className="w-12 text-slate-500 font-mono text-right">From:</span>
                <span className="font-sans text-slate-300 font-medium">Me (via Authorized Gmail API)</span>
              </div>
              <div className="flex items-center gap-2 border-t border-slate-800/40 pt-2">
                <span className="w-12 text-slate-500 font-mono text-right">To:</span>
                <span className="font-sans text-emerald-400 font-semibold">{modalLead.name}</span>
                <span className="font-mono text-[10px] text-slate-400">&lt;{modalLead.contactEmails[0]}&gt;</span>
              </div>
              <div className="flex items-center gap-2 border-t border-slate-800/40 pt-2">
                <span className="w-12 text-slate-500 font-mono text-right">Subject:</span>
                <input
                  type="text"
                  value={modalSubject}
                  onChange={(e) => setModalSubject(e.target.value)}
                  className="bg-slate-950 text-slate-200 border border-slate-800 rounded px-2.5 py-1 flex-1 text-xs focus:outline-none focus:border-emerald-500/50 font-sans"
                />
              </div>
            </div>

            {/* Email Body Template */}
            <div className="p-4 flex-1 bg-slate-950 overflow-y-auto">
              <div className="text-[10px] text-slate-500 font-mono mb-2 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-emerald-400" /> Editable Draft Body template
              </div>
              <textarea
                value={modalBody}
                onChange={(e) => setModalBody(e.target.value)}
                rows={12}
                className="w-full bg-slate-950 text-slate-300 border border-slate-800 rounded-lg p-3 text-xs font-mono focus:outline-none focus:border-emerald-500/50 leading-relaxed resize-none"
              />
            </div>

            {/* Information Warning Banner */}
            <div className="px-4 py-2 bg-slate-950/80 border-t border-slate-850 text-[10px] text-slate-400 font-sans leading-relaxed flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
              <span>Personalized tags were populated successfully. You can tweak subject/body text before triggering sending.</span>
            </div>

            {/* Bottom Actions Row */}
            <div className="p-4 bg-slate-900 border-t border-slate-800 flex justify-between items-center">
              <div className="flex gap-2 text-slate-500 font-mono text-[9px] uppercase">
                <span>Format: Plain Text</span>
                <span>•</span>
                <span>Tracks: Open, Clicks</span>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsPreviewModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-slate-200 font-medium bg-slate-800 hover:bg-slate-750 rounded-lg cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSendingFromModal}
                  onClick={async () => {
                    if (!modalCampaign) return;
                    setIsSendingFromModal(true);
                    try {
                      // Call standard immediate send
                      await sendCampaignImmediate(modalCampaign.id, modalLead.id);
                      setIsPreviewModalOpen(false);
                      setPreviewLeadId(null); // clears from queue
                    } catch (err) {
                      console.error(err);
                    } finally {
                      setIsSendingFromModal(false);
                    }
                  }}
                  className="px-4 py-1.5 text-xs font-sans font-bold bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSendingFromModal ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      Send Pitch via Gmail
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Details & Tracking Modal */}
      {selectedCampaignDetails && (() => {
        const activeCamp = campaigns.find(c => c.id === selectedCampaignDetails.id) || selectedCampaignDetails;
        const campOutreaches = outreachStates.filter(o => o.campaignId === activeCamp.id);
        
        const targetedLeadsList = activeCamp.targetSegments ? (
          leads.filter(l => {
            const { tags, niches, roles } = activeCamp.targetSegments!;
            const roleMatch = !roles || roles.length === 0 || (l.role && roles.some(r => r.toLowerCase() === l.role?.toLowerCase()));
            const nicheMatch = !niches || niches.length === 0 || (l.niche && niches.some(n => n.toLowerCase() === l.niche?.toLowerCase()));
            
            let leadTags: string[] = [];
            if (Array.isArray(l.tags)) {
              leadTags = l.tags;
            } else if (typeof l.tags === 'string' && l.tags) {
              leadTags = (l.tags as string).split(',').map(t => t.trim());
            }

            const tagMatch = !tags || tags.length === 0 || (
              leadTags.length > 0 && leadTags.some(t => tags.some(sel => sel.toLowerCase() === t.toLowerCase()))
            );
            return roleMatch && nicheMatch && tagMatch;
          })
        ) : (
          activeCamp.leadIds.map(id => leads.find(l => l.id === id)).filter(Boolean) as Lead[]
        );

        // Calculate campaign performance metrics
        const totalTargeted = targetedLeadsList.length;
        const completedCount = campOutreaches.filter(o => o.status === 'completed').length;
        const scheduledCount = campOutreaches.filter(o => o.status === 'scheduled').length;
        const sentCount = campOutreaches.filter(o => o.history && o.history.length > 0).length;
        const openedCount = campOutreaches.filter(o => o.status === 'opened' || (o.history && o.history.some(h => h.status === 'opened'))).length;
        const repliedCount = campOutreaches.filter(o => o.status === 'replied' || (o.history && o.history.some(h => h.status === 'replied'))).length;

        const openRate = sentCount > 0 ? Math.round((openedCount / sentCount) * 100) : 0;
        const replyRate = sentCount > 0 ? Math.round((repliedCount / sentCount) * 100) : 0;

        return (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-fade-in">
              {/* Header */}
              <div className="p-5 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-lg font-sans font-bold text-white">{activeCamp.title}</h2>
                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold border ${
                      activeCamp.status === 'active' 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 animate-pulse' 
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {activeCamp.status}
                    </span>
                  </div>
                  <div className="flex gap-4 mt-1 text-[11px] text-slate-400">
                    <span>Timezone: <strong className="text-emerald-400">{activeCamp.timezone || "Prospect's Local"}</strong></span>
                    <span>Preferred Time: <strong className="text-emerald-400">{activeCamp.preferredTime || '09:00'}</strong></span>
                    <span>Constraint: <strong className="text-emerald-400">{activeCamp.sendDays === 'weekdays' ? 'Weekdays only' : 'Everyday'}</strong></span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCampaignDetails(null)}
                  className="text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 p-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1">
                {/* Performance Analytics Bento-Grid */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                  <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-center">
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Prospects</p>
                    <p className="text-xl font-sans font-bold text-white mt-1">{totalTargeted}</p>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-center">
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Sent / Delivered</p>
                    <p className="text-xl font-sans font-bold text-emerald-400 mt-1">{sentCount}</p>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-center">
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Scheduled</p>
                    <p className="text-xl font-sans font-bold text-yellow-500 mt-1">{scheduledCount}</p>
                  </div>
                  <div className="bg-slate-950/60 p-3 rounded-lg border border-slate-800 text-center">
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Completed</p>
                    <p className="text-xl font-sans font-bold text-indigo-400 mt-1">{completedCount}</p>
                  </div>
                  <div className="bg-emerald-500/5 p-3 rounded-lg border border-emerald-500/20 text-center">
                    <p className="text-[10px] text-emerald-500 uppercase font-bold">Open Rate</p>
                    <p className="text-xl font-sans font-bold text-emerald-400 mt-1">{openRate}%</p>
                    <p className="text-[9px] text-slate-500 font-mono mt-0.5">{openedCount} opens</p>
                  </div>
                  <div className="bg-indigo-500/5 p-3 rounded-lg border border-indigo-500/20 text-center">
                    <p className="text-[10px] text-indigo-400 uppercase font-bold">Reply Rate</p>
                    <p className="text-xl font-sans font-bold text-indigo-400 mt-1">{replyRate}%</p>
                    <p className="text-[9px] text-slate-500 font-mono mt-0.5">{repliedCount} replies</p>
                  </div>
                </div>

                {/* Instant Campaign Test Suite */}
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4 text-left">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-400" />
                      Instant Campaign Test Suite
                    </h4>
                    <span className="text-[10px] text-slate-500 font-mono">Test delivery & placeholders before active run</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-slate-400">1. Select Target Prospect (Lead)</label>
                      <select
                        value={testLeadId}
                        onChange={(e) => {
                          setTestLeadId(e.target.value);
                          setTestSendResult(null);
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="">-- Choose Prospect --</option>
                        {(targetedLeadsList.length > 0 ? targetedLeadsList : leads).map(l => (
                          <option key={l.id} value={l.id}>{l.name} ({l.niche || 'No Niche'})</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-slate-400">2. Select Campaign Step</label>
                      <select
                        value={testStepIndex}
                        onChange={(e) => {
                          setTestStepIndex(Number(e.target.value));
                          setTestSendResult(null);
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        {activeCamp.steps.map((step, idx) => (
                          <option key={idx} value={idx}>Step {idx + 1}: {step.subject.substring(0, 30)}...</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-medium text-slate-400">3. Recipient Test Email Address</label>
                      <input
                        type="email"
                        value={testEmailInput}
                        onChange={(e) => {
                          setTestEmailInput(e.target.value);
                          setTestSendResult(null);
                        }}
                        placeholder="e.g. your_email@gmail.com"
                        className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => handleSendCampaignTest(activeCamp.id)}
                        disabled={isTestSending || !testLeadId || !testEmailInput}
                        className="w-full bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 disabled:opacity-50 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs transition-colors h-9 flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        {isTestSending ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-950" />
                            Sending Test...
                          </>
                        ) : (
                          <>
                            <Mail className="w-3.5 h-3.5" />
                            Send Test Email
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {testSendResult && (
                    <div className={`p-3 rounded-lg border text-xs leading-normal flex items-start gap-2 ${
                      testSendResult.type === 'success'
                        ? 'bg-emerald-950/20 text-emerald-300 border-emerald-500/20'
                        : 'bg-red-950/20 text-red-300 border-red-500/20'
                    }`}>
                      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                      <div>
                        {testSendResult.message}
                      </div>
                    </div>
                  )}
                </div>

                {/* Prospects Delivery Tracking Table */}
                <div className="space-y-3">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-emerald-400">Prospect Delivery Tracking Matrix</h3>
                  <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-[10px] text-slate-400 font-mono bg-slate-900/50 uppercase">
                          <th className="p-3">Prospect Info</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Sequence Step</th>
                          <th className="p-3">Next Scheduled Send</th>
                          <th className="p-3">Last Activity</th>
                          <th className="p-3 text-right">Actions / Simulation Suite</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-xs">
                        {targetedLeadsList.map(leadObj => {
                          const stateObj = campOutreaches.find(s => s.leadId === leadObj.id);

                          return (
                            <tr key={leadObj.id} className="hover:bg-slate-900/30">
                              <td className="p-3">
                                <div className="font-sans font-bold text-white">{leadObj.name}</div>
                                <div className="text-[10px] text-slate-500 flex items-center gap-2 mt-0.5">
                                  <span>{leadObj.contactEmails[0]}</span>
                                  {leadObj.role && (
                                    <span className="text-[9px] font-mono font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1 rounded uppercase">
                                      {leadObj.role}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                                  stateObj?.status === 'replied' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                                  stateObj?.status === 'opened' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                                  stateObj?.status === 'scheduled' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                                  stateObj?.status === 'completed' ? 'bg-slate-800 text-slate-400 border-slate-700' :
                                  'bg-slate-950 text-slate-600'
                                }`}>
                                  {stateObj?.status || 'NOT INITIALIZED'}
                                </span>
                              </td>
                              <td className="p-3">
                                <div className="font-mono">
                                  {stateObj 
                                    ? `Step ${stateObj.currentStepIndex + 1} of ${activeCamp.steps.length}`
                                    : 'Pending Init'
                                  }
                                </div>
                              </td>
                              <td className="p-3 text-slate-300 font-mono text-[11px]">
                                {stateObj?.status === 'scheduled' && stateObj.nextSendTime
                                  ? new Date(stateObj.nextSendTime).toLocaleString()
                                  : stateObj?.status === 'completed'
                                    ? 'Sequence Completed'
                                    : 'N/A'
                                }
                              </td>
                              <td className="p-3">
                                {stateObj && stateObj.history && stateObj.history.length > 0 ? (
                                  <div>
                                    <span className="text-slate-300">Step {stateObj.history[stateObj.history.length - 1].stepIndex + 1} sent</span>
                                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                                      {new Date(stateObj.history[stateObj.history.length - 1].sentAt).toLocaleString()}
                                    </p>
                                  </div>
                                ) : (
                                  <span className="text-slate-600">No emails sent yet</span>
                                )}
                              </td>
                              <td className="p-3 text-right">
                                {stateObj && stateObj.status !== 'completed' && (
                                  <div className="flex gap-1.5 justify-end">
                                    <button
                                      type="button"
                                      onClick={() => simulateEngagement(stateObj.id, 'open')}
                                      className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded text-[10px] font-bold transition-all cursor-pointer"
                                      title="Simulate the prospect opening this sequence email"
                                    >
                                      Simulate Open
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => simulateEngagement(stateObj.id, 'reply')}
                                      className="px-2 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded text-[10px] font-bold transition-all cursor-pointer"
                                      title="Simulate the prospect replying to this sequence email"
                                    >
                                      Simulate Reply
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {targetedLeadsList.length === 0 && (
                          <tr>
                            <td colSpan={6} className="text-center p-8 text-slate-500">No prospects targeted in this campaign yet.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Email Template Sequences Preview */}
                <div className="space-y-3">
                  <h3 className="text-xs font-mono uppercase tracking-wider text-emerald-400">Sequence Steps Structure</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeCamp.steps.map((st, sIdx) => (
                      <div key={sIdx} className="bg-slate-950 p-4 border border-slate-800 rounded-lg space-y-2">
                        <div className="flex justify-between items-center border-b border-slate-800 pb-1.5">
                          <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-bold">
                            STEP {sIdx + 1}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            Delay: {st.delayDays} day{st.delayDays !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div>
                          <p className="text-[11px] text-slate-500 font-mono">Subject:</p>
                          <p className="text-xs font-semibold text-white truncate">{st.subject}</p>
                        </div>
                        <div className="pt-1">
                          <p className="text-[11px] text-slate-500 font-mono">Body Outline:</p>
                          <p className="text-xs text-slate-400 line-clamp-3 bg-slate-900/50 p-2 rounded border border-slate-800/40 font-mono whitespace-pre-wrap mt-1">
                            {st.bodyTemplate}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-5 border-t border-slate-800 bg-slate-950/50 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedCampaignDetails(null)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-sans font-bold rounded-lg transition-colors cursor-pointer"
                >
                  Close Campaign Dashboard
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
