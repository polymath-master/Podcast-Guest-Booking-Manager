/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Core business types for Podcast Guest Booking Manager

export interface Lead {
  id: string;
  userId: string;
  name: string;
  contactEmails: string[];
  website?: string;
  socials?: {
    twitter?: string;
    linkedin?: string;
    youtube?: string;
    instagram?: string;
  };
  // Structured and unstructured data
  rawInput?: string;
  bio?: string;
  topics?: string[];
  highlights?: string[];
  niche?: string;
  requirements?: string;
  mediaKitUrl?: string; // Link to media kit in Google Drive
  priority?: 'high' | 'medium' | 'low';
  tags?: string[];
  role?: 'guest' | 'host'; // guest or host segment role
  source?: 'manual' | 'sheets' | 'file' | 'url' | 'drive';
  sourceName?: string;
  organization?: string; // organization or company affiliation of the guest
  createdAt: string;
  status: 'new' | 'outreached' | 'replied' | 'booked' | 'declined';
}

export interface CampaignStep {
  id: string;
  subject: string;
  bodyTemplate: string; // supports placeholders like {{guest_name}}, {{podcast_name}}, {{niche}}
  delayDays: number; // days after the previous step
}

export interface Campaign {
  id: string;
  userId: string;
  title: string;
  leadIds: string[];
  steps: CampaignStep[]; // standard sequence up to 5 steps
  dailySendLimit: number;
  status: 'draft' | 'active' | 'paused' | 'completed';
  createdAt: string;
  senderEmail?: string; // Specific connected Gmail address to send from
  
  // New Segment-based Targeting
  targetSegments?: {
    tags?: string[];
    niches?: string[];
    roles?: ('guest' | 'host')[];
  };
  excludedLeadIds?: string[];

  // New Timezone-based Scheduling
  timezone?: string; // e.g. "America/New_York", "Europe/London", "UTC", "Prospect's Local"
  preferredTime?: string; // e.g. "09:00"
  sendDays?: 'weekdays' | 'everyday';
  clientId?: string; // Optional reference to associated client
}

export interface OutreachState {
  id: string; // leadId_campaignId
  leadId: string;
  campaignId: string;
  userId: string;
  currentStepIndex: number;
  status: 'pending_approval' | 'scheduled' | 'sent' | 'replied' | 'completed' | 'paused' | 'retry';
  nextSendTime?: string; // ISO string
  approvedByUser: boolean;
  retryCount?: number; // Number of retries for exponential backoff
  history: {
    stepIndex: number;
    messageId?: string; // Gmail message ID
    threadId?: string; // Gmail thread ID
    sentAt?: string;
    subject: string;
    body: string;
    status?: 'draft' | 'sent' | 'delivered' | 'failed' | 'opened' | 'replied';
    deliveryTime?: string;
    openedAt?: string;
  }[];
  lastReplyTime?: string;
}

export interface CalendarSyncEvent {
  id: string;
  userId: string;
  leadId: string;
  eventId: string; // Google Calendar Event ID
  summary: string;
  startTime: string;
  endTime: string;
  status: 'confirmed' | 'cancelled';
  reminderSent: boolean;
  notes?: string;
}

export interface AutomationTask {
  id: string;
  userId: string;
  title: string;
  type: 'gmail_reply_check' | 'outreach_sender' | 'reminder_sender';
  cronExpression: string; // cron or description
  enabled: boolean;
  lastRunTime?: string;
  status: 'idle' | 'running' | 'failed' | 'success';
}

export interface AuditLog {
  id: string;
  userId: string;
  timestamp: string;
  action: string;
  details: string;
  category: 'auth' | 'campaign' | 'gmail' | 'calendar' | 'system' | 'sheets';
  severity: 'info' | 'warn' | 'error';
}

export interface ModelThinkingConfig {
  thinkingLevel: 'HIGH' | 'LOW' | 'OFF';
}

export interface AppSettings {
  id: string;
  userId: string;
  provider: 'gemini' | 'openrouter';
  openRouterApiKey?: string;
  openRouterModel?: string;
}

export interface Client {
  id: string;
  userId: string;
  name: string;
  website?: string;
  niche?: string;
  podcastName?: string;
  description?: string; // Organized by AI agent
  rawInput?: string;
  tags?: string[];
  createdAt: string;
  contactEmails?: string[];
  socials?: {
    twitter?: string;
    linkedin?: string;
    youtube?: string;
    instagram?: string;
    facebook?: string;
  };
  detailedInfo?: string;
}

export interface PitchTemplate {
  id: string;
  userId: string;
  title: string; // e.g. "Fintech Founder Pitch"
  subject: string; // email subject
  bodyTemplate: string; // email body with template placeholders
  category: string; // e.g. "Fintech", "Health/Biology", "Web3/Crypto", "General"
  createdAt: string;
}

export interface ConnectedAccount {
  id: string;
  userId: string;
  email: string;
  createdAt: string;
  status: 'connected' | 'error';
  errorDetails?: string;
  isSimulated?: boolean;
}

export interface InboxSummary {
  summary: string;
  actionItems: string[];
  replies: any[];
}


