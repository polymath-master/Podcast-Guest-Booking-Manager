/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import cron from 'node-cron';
import { createServer as createViteServer } from 'vite';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { google } from 'googleapis';
import { GoogleGenAI, Type } from '@google/genai';
import * as fs from 'fs';
import * as XLSX from 'xlsx';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { Lead, Campaign, OutreachState, CalendarSyncEvent, AuditLog, AppSettings, PitchTemplate, Client } from './src/types';

// Initialize Express App
const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize Gemini SDK with telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Helper to turn responseSchema into a concrete JSON mockup template for non-native LLM understanding
function schemaToTemplate(schema: any): any {
  if (!schema) return null;
  const typeStr = String(schema.type).toLowerCase();
  if (typeStr === 'object' || schema.type === 6) { // 6 is Type.OBJECT in Google GenAI
    const obj: any = {};
    if (schema.properties) {
      for (const [key, value] of Object.entries(schema.properties)) {
        obj[key] = schemaToTemplate(value);
      }
    }
    return obj;
  } else if (typeStr === 'array' || schema.type === 5) { // 5 is Type.ARRAY
    return [schemaToTemplate(schema.items)];
  } else {
    return schema.description ? `${schema.description} (${typeStr})` : `<${typeStr}>`;
  }
}

// Robust JSON responder cleanups (strips markdown code fences if outputted by raw models)
function cleanJsonResponse(text: string): string {
  let cleaned = text.trim();
  // Strip markdown code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/i, '');
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.replace(/\n?```$/i, '');
  }
  return cleaned.trim();
}

interface AICallParams {
  userId: string;
  model: string;
  prompt: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
  responseSchema?: any;
}

// Database-backed user settings retrieval
const getSettings = async (userId: string): Promise<AppSettings> => {
  try {
    const list = await getDocuments<AppSettings>('settings', userId);
    const userSettings = list.find(s => s.userId === userId);
    if (userSettings) return userSettings;
  } catch (err) {
    console.error('Error fetching settings, using default:', err);
  }
  return {
    id: `settings_${userId}`,
    userId,
    provider: 'gemini'
  };
};

// Unified platform-independent AI content generator
async function generateAIContent(params: AICallParams): Promise<string> {
  const { userId, model, prompt, inlineData, responseSchema } = params;
  const settings = await getSettings(userId);

  // Generate robust system prompt & JSON constraints
  let schemaInstruction = '';
  if (responseSchema) {
    const template = schemaToTemplate(responseSchema);
    schemaInstruction = `\n\n[CRITICAL DIRECTIVE - JSON FORMAT MANDATE]
You are a highly structured data parser. You MUST return ONLY a valid, parseable JSON object adhering exactly to this structure:
${JSON.stringify(template, null, 2)}

Do NOT include any extra conversational filler, prelude, explanations, or code fence decorators like \`\`\`json. Your output must start with '{' and end with '}'. Ensure all fields are filled based on the input text.`;
  }

  const fullyStructuredPrompt = `${prompt}${schemaInstruction}`;

  if (settings.provider === 'openrouter' && settings.openRouterApiKey) {
    const selectedModel = settings.openRouterModel || 'deepseek/deepseek-chat';
    console.log(`[AI Routing] Directing request to OpenRouter using model: ${selectedModel}`);
    
    let finalPrompt = fullyStructuredPrompt;
    if (inlineData) {
      try {
        const decoded = Buffer.from(inlineData.data, 'base64').toString('utf8');
        finalPrompt = `Attached File Content:\n\`\`\`\n${decoded}\n\`\`\`\n\nInstructions:\n${fullyStructuredPrompt}`;
      } catch (err) {
        console.error('Error decoding file base64 for OpenRouter:', err);
      }
    }

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://ai.studio/build',
          'X-Title': 'Podcast PR Automator'
        },
        body: JSON.stringify({
          model: selectedModel,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: 'You are an elite Podcast Guest Sourcing and Booking Assistant. You MUST analyze the request and return a valid JSON object matching the requested structure. Never write text outside the JSON.'
            },
            {
              role: 'user',
              content: finalPrompt
            }
          ],
          temperature: 0.1
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API failed: ${response.statusText} (${response.status}) - ${errorText}`);
      }

      const json: any = await response.json();
      const rawContent = json.choices?.[0]?.message?.content || '{}';
      return cleanJsonResponse(rawContent);
    } catch (openRouterError: any) {
      console.warn('OpenRouter API call failed, falling back to Google Gemini:', openRouterError.message);
      try {
        await createAuditLog(userId, 'OpenRouter Fallback', `OpenRouter call failed (${openRouterError.message}). Safely fell back to Google Gemini.`, 'system', 'warn');
      } catch (logErr) {
        console.error('Failed to write audit log for fallback:', logErr);
      }
      // Fall through to Gemini execution below
    }
  }

  // Google Gemini execution (either direct or fallback)
  {
    console.log(`[AI Routing] Directing request to Google Gemini using model: ${model}`);
    
    let contents: any;
    if (inlineData) {
      contents = {
        parts: [
          {
            inlineData: {
              mimeType: inlineData.mimeType,
              data: inlineData.data
            }
          },
          {
            text: fullyStructuredPrompt
          }
        ]
      };
    } else {
      contents = fullyStructuredPrompt;
    }

    const config: any = {
      responseMimeType: 'application/json'
    };

    if (responseSchema) {
      config.responseSchema = responseSchema;
    }

    if (model.includes('pro')) {
      config.thinkingConfig = {
        thinkingLevel: 'HIGH'
      };
    }

    const response = await ai.models.generateContent({
      model: model,
      contents: contents,
      config: config
    });

    return cleanJsonResponse(response.text?.trim() || '{}');
  }
}


/**
 * Helper function to process data rows in chunks concurrently using Gemini.
 * This completely resolves "Long sheet processing, importing and categorizing takes too long and suddenly timeout exception"
 * by breaking down large spreadsheets/CSVs into smaller, extremely fast batches.
 */
async function processLeadChunksInBatches(
  userId: string,
  headers: string[],
  dataRows: any[][],
  chunkSize: number = 25,
  concurrency: number = 3
): Promise<any[]> {
  // Cap the total number of processed rows to avoid extreme runtimes (e.g. 300 rows maximum)
  const maxRows = 300;
  const slicedRows = dataRows.slice(0, maxRows);
  
  // Group rows into batches of `chunkSize`
  const chunks: any[][][] = [];
  for (let i = 0; i < slicedRows.length; i += chunkSize) {
    chunks.push(slicedRows.slice(i, i + chunkSize));
  }

  console.log(`[Chunking Engine] Processing ${slicedRows.length} rows split into ${chunks.length} chunks (chunkSize=${chunkSize}, concurrency=${concurrency})`);

  const allLeads: any[] = [];

  // Sub-routine to process a single chunk of data rows with Gemini
  async function processChunk(rowsChunk: any[][], chunkIndex: number) {
    const prompt = `You are an AI Lead Sourcing Agent.
Analyze this list of spreadsheet column headers and data rows from a podcast lead tracker:
Headers: ${JSON.stringify(headers)}
Data Rows: ${JSON.stringify(rowsChunk)}

Please map and parse each data row into our structured Lead object format. For each row:
1. Extract the contact name and email(s). (Skip rows without valid names or email addresses).
2. Extract or infer the organization, company, or podcast affiliation.
3. Extract or infer the website and bio/description.
4. Extract speaking topics or expertise keywords.
5. Intelligently classify their 'niche' (e.g. Technology, Finance, Health, Marketing, Business, etc.).
6. Rate their 'priority' ('high', 'medium', or 'low') based on their credentials, reach, or relevance.
7. Determine their contact 'status' ('new', 'outreached', 'replied', 'booked', or 'declined'). Default to 'new' unless indicated.
8. Generate a list of 2-4 descriptive labels/tags (e.g. "SaaS Founder", "Author", "AI Expert").

Return a JSON array of the parsed Lead objects under the "leads" key.`;

    try {
      const geminiResText = await generateAIContent({
        userId,
        model: 'gemini-3.5-flash',
        prompt,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            leads: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  organization: { type: Type.STRING },
                  contactEmails: { type: Type.ARRAY, items: { type: Type.STRING } },
                  website: { type: Type.STRING },
                  bio: { type: Type.STRING },
                  topics: { type: Type.ARRAY, items: { type: Type.STRING } },
                  niche: { type: Type.STRING },
                  priority: { type: Type.STRING },
                  status: { type: Type.STRING },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ['name', 'contactEmails']
              }
            }
          },
          required: ['leads']
        }
      });

      const parsed = JSON.parse(geminiResText || '{"leads":[]}');
      if (parsed.leads && Array.isArray(parsed.leads)) {
        console.log(`[Chunking Engine] Chunk ${chunkIndex + 1}/${chunks.length} successfully parsed ${parsed.leads.length} leads.`);
        return parsed.leads;
      }
    } catch (err) {
      console.error(`[Chunking Engine] Error processing chunk ${chunkIndex + 1}/${chunks.length}:`, err);
    }
    return [];
  }

  // Process chunks in sequential batches of size `concurrency` to avoid rate limits
  for (let i = 0; i < chunks.length; i += concurrency) {
    const batch = chunks.slice(i, i + concurrency);
    const batchPromises = batch.map((chunk, index) => processChunk(chunk, i + index));
    const batchResults = await Promise.all(batchPromises);
    for (const results of batchResults) {
      allLeads.push(...results);
    }
  }

  console.log(`[Chunking Engine] Completed. Total parsed leads across all chunks: ${allLeads.length}`);
  return allLeads;
}


// Resilient Supabase configuration with local JSON fallback
const mockDbPath = path.join(process.cwd(), 'local-db');

// Ensure mock db path exists
if (!fs.existsSync(mockDbPath)) {
  fs.mkdirSync(mockDbPath, { recursive: true });
}

const getMockDataFile = (collection: string): string => {
  return path.join(mockDbPath, `${collection}.json`);
};

const readMockCollection = <T>(collection: string): T[] => {
  const filePath = getMockDataFile(collection);
  if (!fs.existsSync(filePath)) return [];
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data) as T[];
  } catch (e) {
    console.error(`Error reading local db collection ${collection}:`, e);
    return [];
  }
};

const writeMockCollection = <T>(collection: string, data: T[]) => {
  const filePath = getMockDataFile(collection);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error(`Error writing local db collection ${collection}:`, e);
  }
};

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase: any = null;

if (supabaseUrl && supabaseServiceKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      }
    });
    console.log('Supabase Client initialized successfully.');
  } catch (err: any) {
    console.error('Failed to initialize Supabase Client:', err.message);
  }
} else {
  console.warn('Supabase URL or Service Role Key is missing. Falling back to local file-based database.');
}

const seedSupabaseIfEmpty = async () => {
  if (!supabase) return;
  try {
    const { count, error } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true });
      
    if (error) {
      if (error.code === '42P01') {
        console.warn('[SEED] documents table does not exist yet. Skipping seed.');
      } else {
        console.error('[SEED] Error checking if documents table is empty:', error);
      }
      return;
    }
    
    if (count === 0) {
      console.log('[SEED] Supabase database is empty. Seeding elegant default workspace data...');
      
      const defaultUserId = 'rahmanshuvo.4360@gmail.com';
      
      // 1. App Settings
      const defaultSettings = {
        id: 'settings_default',
        userId: defaultUserId,
        companyName: 'AI Studio Ventures',
        senderName: 'PR Relations Team',
        signature: 'Warm regards,\nPR & Podcast Sourcing Team',
        autoApproveQueue: false,
        dailyMaxEmails: 50,
        preferredTime: '09:00',
        timezone: 'Asia/Dhaka'
      };
      await saveDocument('settings', defaultSettings);

      // 2. Clients
      const client1 = {
        id: 'client_1',
        userId: defaultUserId,
        name: 'Sarah Jenkins',
        website: 'https://sarahdevs.io',
        niche: 'AI & Software Engineering',
        podcastName: 'CodeCraft Podcast',
        description: 'Sarah is an AI developer and SaaS founder building next-generation productivity tools. She speaks on the practical application of modern large language models, startup scaling, and cloud architectures.',
        tags: ['Founder', 'AI Engineer', 'SaaS', 'Cloud Architect'],
        createdAt: new Date().toISOString()
      };
      await saveDocument('clients', client1);

      // 3. Pitch Templates
      const template1 = {
        id: 'template_1',
        userId: defaultUserId,
        title: 'Premium Founder Booking Pitch',
        subject: 'Collaboration: Sarah Jenkins (SaaS Founder) on {{podcast_name}}',
        bodyTemplate: 'Hi {{name}},\n\nI hope you are doing well!\n\nI have been following {{podcast_name}} and love your recent episodes on technology development. I wanted to pitch Sarah Jenkins as a potential guest.\n\nSarah is an AI developer and the founder of several high-growth productivity products. She can share unique insights on:\n- {{topics}}\n- Practical scaling of AI systems in 2026\n\nWould you be open to a quick chat about booking Sarah for a future episode?\n\nBest,\nPR Team',
        category: 'pitch',
        createdAt: new Date().toISOString()
      };
      await saveDocument('templates', template1);

      // 4. Campaigns
      const campaign1 = {
        id: 'campaign_1',
        userId: defaultUserId,
        title: 'Tech & SaaS Sourcing Campaign',
        description: 'Targeting prominent software engineering and artificial intelligence shows.',
        clientId: 'client_1',
        templateId: 'template_1',
        status: 'active',
        senderEmail: 'primary.outreach@gmail.com',
        timezone: 'Asia/Dhaka',
        preferredTime: '09:00',
        steps: [
          {
            id: 'step_1',
            subject: 'Collaboration: Sarah Jenkins on {{podcast_name}}',
            bodyTemplate: 'Hi {{name}},\n\nI hope you are doing well!\n\nI have been following {{podcast_name}} and love your recent episodes on technology development. I wanted to pitch Sarah Jenkins as a potential guest.\n\nSarah is an AI developer and the founder of several high-growth productivity products. She can share unique insights on:\n- {{topics}}\n- Practical scaling of AI systems in 2026\n\nWould you be open to a quick chat about booking Sarah for a future episode?\n\nBest,\nPR Team',
            delayDays: 0
          },
          {
            id: 'step_2',
            subject: 'Quick follow up regarding Sarah Jenkins on {{podcast_name}}',
            bodyTemplate: 'Hi {{name}},\n\nJust wanted to briefly follow up and see if you had any interest in booking Sarah Jenkins for {{podcast_name}}? She just launched a new feature that has been trending, and she has fantastic advice to share.\n\nLet me know if you would like more details!\n\nBest,\nPR Team',
            delayDays: 3
          }
        ],
        createdAt: new Date().toISOString()
      };
      await saveDocument('campaigns', campaign1);

      // 5. Leads
      const lead1 = {
        id: 'lead_1',
        userId: defaultUserId,
        name: 'Alex Rivera',
        organization: 'The Future of Tech Podcast',
        contactEmails: ['alex.rivera@example.com'],
        website: 'https://futureoftech.show',
        bio: 'Alex Rivera hosts The Future of Tech Podcast, exploring how software, AI, and cloud technology shape business models.',
        topics: ['AI agents', 'LLM optimization', 'SaaS trends'],
        niche: 'Technology',
        priority: 'high',
        status: 'new',
        tags: ['Podcast Host', 'Tech Influencer', 'SaaS Enthusiast'],
        role: 'host',
        source: 'manual',
        createdAt: new Date().toISOString()
      };
      const lead2 = {
        id: 'lead_2',
        userId: defaultUserId,
        name: 'Elena Rostova',
        organization: 'SaaS Builder Collective',
        contactEmails: ['elena@saasbuilders.net'],
        website: 'https://saasbuilders.net',
        bio: 'Elena hosts a weekly roundtable with SaaS developers sharing launch secrets and growth strategies.',
        topics: ['Bootstrapping', 'Growth Loops', 'Developer Marketing'],
        niche: 'Business',
        priority: 'medium',
        status: 'new',
        tags: ['Developer Relations', 'Bootstrapper'],
        role: 'host',
        source: 'manual',
        createdAt: new Date().toISOString()
      };
      await saveDocument('leads', lead1);
      await saveDocument('leads', lead2);

      // 6. Audit Log
      await createAuditLog(defaultUserId, 'Database Initial Seeding', 'Successfully seeded default workspace records to Supabase.', 'system', 'info');
      
      console.log('[SEED] Supabase database seeded successfully.');
    } else {
      console.log(`[SEED] Supabase already has ${count} records. No seeding needed.`);
    }
  } catch (err: any) {
    console.error('[SEED] Error seeding Supabase:', err.message);
  }
};

// Database helper functions supporting both Supabase and Local Mock Fallback
const getDocuments = async <T>(collection: string, userId: string): Promise<T[]> => {
  const sharedCollections = ['leads', 'clients', 'templates'];
  const isShared = sharedCollections.includes(collection);

  if (supabase) {
    try {
      let query = supabase
        .from('documents')
        .select('data')
        .eq('collection', collection);
        
      if (!isShared) {
        query = query.eq('user_id', userId);
      }
      
      const { data, error } = await query;
      
      if (error) {
        if (error.code === '42P01') {
          console.warn(`Supabase table 'documents' does not exist yet. Please run the SQL schema in Supabase. Falling back to local db.`);
        } else {
          throw error;
        }
      } else if (data) {
        return data.map((row: any) => row.data as T);
      }
    } catch (error) {
      console.error(`Supabase read error on ${collection}:`, error);
    }
  }

  // Fallback
  const list = readMockCollection<T>(collection);
  if (isShared) {
    return list;
  }
  return list.filter((item: any) => item.userId === userId);
};

const saveDocument = async <T extends { id: string; userId: string }>(collection: string, doc: T): Promise<void> => {
  if (supabase) {
    try {
      const { error } = await supabase
        .from('documents')
        .upsert({
          id: doc.id,
          collection,
          user_id: doc.userId || null,
          data: doc,
          updated_at: new Date().toISOString()
        });
        
      if (error) {
        if (error.code === '42P01') {
          console.warn(`Supabase table 'documents' does not exist yet. Falling back to local db.`);
        } else {
          throw error;
        }
      } else {
        return;
      }
    } catch (error) {
      console.error(`Supabase write error on ${collection}:`, error);
    }
  }

  // Fallback
  const list = readMockCollection<T>(collection);
  const idx = list.findIndex((item: any) => item.id === doc.id);
  if (idx > -1) {
    list[idx] = doc;
  } else {
    list.push(doc);
  }
  writeMockCollection(collection, list);
};

const deleteDocument = async (collection: string, docId: string, userId: string): Promise<void> => {
  const sharedCollections = ['leads', 'clients', 'templates'];
  const isShared = sharedCollections.includes(collection);

  if (supabase) {
    try {
      let query = supabase
        .from('documents')
        .delete()
        .eq('id', docId);
        
      if (!isShared) {
        query = query.eq('user_id', userId);
      }
      
      const { error } = await query;
      
      if (error) {
        if (error.code === '42P01') {
          console.warn(`Supabase table 'documents' does not exist yet. Falling back to local db.`);
        } else {
          throw error;
        }
      } else {
        return;
      }
    } catch (error) {
      console.error(`Supabase delete error on ${collection}:`, error);
    }
  }

  // Fallback
  const list = readMockCollection<any>(collection);
  const filtered = list.filter((item: any) => {
    if (isShared) {
      return item.id !== docId;
    }
    return !(item.id === docId && item.userId === userId);
  });
  writeMockCollection(collection, filtered);
};

const createAuditLog = async (userId: string, action: string, details: string, category: AuditLog['category'], severity: AuditLog['severity'] = 'info') => {
  const log: AuditLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    userId,
    timestamp: new Date().toISOString(),
    action,
    details,
    category,
    severity
  };
  await saveDocument('logs', log);
  console.log(`[AUDIT LOG] [${category.toUpperCase()}] [${severity.toUpperCase()}] ${action}: ${details}`);
};

// Encryption/Decryption Helpers for Google OAuth Refresh Tokens
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'pr-automation-secret-key-32-chars!!'; // Must be 32 chars
const IV_LENGTH = 16;

function encryptToken(text: string): string {
  if (!text) return '';
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (err) {
    console.error('Encryption failed:', err);
    return text;
  }
}

function decryptToken(text: string): string {
  if (!text) return '';
  try {
    const textParts = text.split(':');
    const ivHex = textParts.shift();
    if (!ivHex) return text;
    const iv = Buffer.from(ivHex, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY.padEnd(32).slice(0, 32)), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (err) {
    console.error('Decryption failed:', err);
    return text;
  }
}

// Refresh Google Access Token using Refresh Token
const refreshAccessToken = async (account: any) => {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/google/callback`;

  const oauth2Client = new google.auth.OAuth2(clientID, clientSecret, redirectUri);
  const refreshToken = decryptToken(account.refreshToken);
  
  oauth2Client.setCredentials({
    refresh_token: refreshToken
  });

  const { credentials } = await oauth2Client.refreshAccessToken();
  const updatedAccount = {
    ...account,
    accessToken: encryptToken(credentials.access_token || ''),
    expiryDate: credentials.expiry_date || (Date.now() + 3500 * 1000),
    updatedAt: new Date().toISOString()
  };
  await saveDocument('connected_accounts', updatedAccount);
  return credentials.access_token || '';
};

// Google OAuth Helpers
const activeUserTokens = new Map<string, string>();
const tokenToEmailCache = new Map<string, string>();

const getOAuth2Client = (authHeader?: string) => {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or malformed Authorization header');
  }
  const token = authHeader.substring(7);
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: token });
  return oauth2Client;
};

const getUserEmail = async (authHeader?: string, userEmailHeader?: string): Promise<string> => {
  if (userEmailHeader && userEmailHeader !== 'unknown_user') {
    if (authHeader) {
      tokenToEmailCache.set(authHeader, userEmailHeader);
    }
    return userEmailHeader;
  }

  if (authHeader && tokenToEmailCache.has(authHeader)) {
    return tokenToEmailCache.get(authHeader)!;
  }

  try {
    const client = getOAuth2Client(authHeader);
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email || 'unknown_user';
    if (email !== 'unknown_user' && authHeader) {
      tokenToEmailCache.set(authHeader, email);
      activeUserTokens.set(email, authHeader);
      try {
        await saveDocument('user_tokens', {
          id: email,
          userId: email,
          email,
          authHeader,
          updatedAt: new Date().toISOString()
        });
      } catch (err) {
        console.error('Failed to persist user token in database:', err);
      }
    }
    return email;
  } catch (error) {
    return 'unknown_user';
  }
};

// API ROUTES

app.get('/api/db-status', async (req, res) => {
  try {
    let supabaseTableExists = false;
    let errorDetails = null;
    if (supabase) {
      const { error } = await supabase.from('documents').select('id').limit(1);
      if (!error) {
        supabaseTableExists = true;
      } else {
        errorDetails = error.message;
      }
    }
    res.json({
      supabaseConnected: supabase !== null,
      supabaseTableExists,
      supabaseConfigured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      localDbExists: fs.existsSync(mockDbPath),
      errorDetails
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// AI Settings Endpoints
app.get('/api/settings', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization, req.headers['x-user-email'] as string);
    const settings = await getSettings(userId);
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Google OAuth & Connected Accounts Endpoints
app.get('/api/auth/google/url', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId is required' });

    const clientID = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/google/callback`;

    if (!clientID || !clientSecret) {
      // Fallback to simulated connect
      return res.json({ 
        url: `/api/auth/google/simulated-callback?state=${userId}`,
        isSimulated: true
      });
    }

    const oauth2Client = new google.auth.OAuth2(clientID, clientSecret, redirectUri);
    const scopes = [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      prompt: 'consent',
      scope: scopes,
      state: String(userId)
    });

    res.json({ url: authUrl, isSimulated: false });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/google/simulated-callback', async (req, res) => {
  try {
    const userId = req.query.state ? String(req.query.state) : 'unknown_user';
    const mockEmails = [
      'primary.outreach@gmail.com',
      'booking.agent@gmail.com',
      'media.pitch@gmail.com',
      'press.relations@gmail.com'
    ];
    const existing = await getDocuments<any>('connected_accounts', userId);
    const nextEmail = mockEmails[existing.length % mockEmails.length];

    const newAccount = {
      id: nextEmail,
      userId,
      email: nextEmail,
      accessToken: encryptToken('mock_access_token'),
      refreshToken: encryptToken('mock_refresh_token'),
      expiryDate: Date.now() + 3600 * 1000,
      createdAt: new Date().toISOString(),
      status: 'connected',
      isSimulated: true
    };

    await saveDocument('connected_accounts', newAccount);
    await createAuditLog(userId, 'Google Account Connected', `Connected mock Gmail account: ${nextEmail} (Simulated)`, 'auth', 'info');

    res.send(`
      <html>
        <body style="background: #020617; color: #f8fafc; font-family: monospace; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh;">
          <div style="background: #0f172a; border: 1px solid #1e293b; padding: 2rem; border-radius: 1rem; text-align: center; max-width: 400px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
            <h2 style="color: #10b981; margin-bottom: 1rem;">✔ Connection Successful!</h2>
            <p style="font-size: 0.875rem; color: #94a3b8; line-height: 1.5; margin-bottom: 2rem;">
              Simulated Google account <strong>${nextEmail}</strong> has been successfully connected to your PR Workspace.
            </p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                setTimeout(() => window.close(), 1500);
              } else {
                window.location.href = '/';
              }
            </script>
            <p style="font-size: 0.75rem; color: #64748b;">Closing window automatically...</p>
          </div>
        </body>
      </html>
    `);
  } catch (error: any) {
    res.status(500).send(`Error: ${error.message}`);
  }
});

app.get('/api/auth/google/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const userId = state ? String(state) : 'unknown_user';

    if (!code) {
      return res.status(400).send('Missing authorization code');
    }

    const clientID = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = `${process.env.APP_URL || 'http://localhost:3000'}/api/auth/google/callback`;

    const oauth2Client = new google.auth.OAuth2(clientID, clientSecret, redirectUri);
    const { tokens } = await oauth2Client.getToken(String(code));
    oauth2Client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    const email = userInfo.data.email;

    if (!email) {
      throw new Error('Failed to retrieve user email from Google');
    }

    const accountDoc = {
      id: email,
      userId,
      email,
      accessToken: encryptToken(tokens.access_token || ''),
      refreshToken: encryptToken(tokens.refresh_token || ''),
      expiryDate: tokens.expiry_date || (Date.now() + 3500 * 1000),
      createdAt: new Date().toISOString(),
      status: 'connected',
      isSimulated: false
    };

    await saveDocument('connected_accounts', accountDoc);
    await createAuditLog(userId, 'Google Account Connected', `Connected Gmail account: ${email}`, 'auth', 'info');

    res.send(`
      <html>
        <body style="background: #020617; color: #f8fafc; font-family: monospace; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh;">
          <div style="background: #0f172a; border: 1px solid #1e293b; padding: 2rem; border-radius: 1rem; text-align: center; max-width: 400px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
            <h2 style="color: #10b981; margin-bottom: 1rem;">✔ Integration Successful!</h2>
            <p style="font-size: 0.875rem; color: #94a3b8; line-height: 1.5; margin-bottom: 2rem;">
              Your Google Workspace account <strong>${email}</strong> has been successfully integrated into your PR Workspace.
            </p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                setTimeout(() => window.close(), 1500);
              } else {
                window.location.href = '/';
              }
            </script>
            <p style="font-size: 0.75rem; color: #64748b;">Closing window automatically...</p>
          </div>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error('OAuth callback failed:', error);
    res.status(500).send(`OAuth Error: ${error.message}`);
  }
});

app.get('/api/connected-accounts', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization);
    const accounts = await getDocuments<any>('connected_accounts', userId);
    const cleanAccounts = accounts.map(a => ({
      id: a.id,
      userId: a.userId,
      email: a.email,
      createdAt: a.createdAt,
      status: a.status,
      errorDetails: a.errorDetails,
      isSimulated: a.isSimulated
    }));
    res.json(cleanAccounts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/connected-accounts/:id', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization);
    const accountId = req.params.id;
    await deleteDocument('connected_accounts', accountId, userId);
    await createAuditLog(userId, 'Google Account Disconnected', `Disconnected account: ${accountId}`, 'auth', 'warn');
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/inbox/summary', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization);
    const accounts = await getDocuments<any>('connected_accounts', userId);

    if (accounts.length === 0) {
      return res.json({
        summary: "No Google accounts connected. Connect a Gmail account in Settings to see summaries of unread pitches and follow-up replies.",
        replies: [],
        actionItems: []
      });
    }

    const allReplies: any[] = [];
    let containsSimulated = false;

    for (const acc of accounts) {
      if (acc.isSimulated) {
        containsSimulated = true;
        continue;
      }

      try {
        let accessToken = decryptToken(acc.accessToken);
        if (Date.now() >= (acc.expiryDate || 0)) {
          accessToken = await refreshAccessToken(acc);
        }

        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({ access_token: accessToken });
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        const listRes = await gmail.users.messages.list({
          userId: 'me',
          q: 'is:unread',
          maxResults: 10
        });

        const messages = listRes.data.messages || [];
        for (const msg of messages) {
          const detailRes = await gmail.users.messages.get({
            userId: 'me',
            id: msg.id!
          });

          const headers = detailRes.data.payload?.headers || [];
          const from = headers.find(h => h.name === 'From')?.value || 'Unknown';
          const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
          const date = headers.find(h => h.name === 'Date')?.value || '';
          const snippet = detailRes.data.snippet || '';

          allReplies.push({
            id: msg.id,
            account: acc.email,
            from,
            subject,
            date,
            snippet,
            isSimulated: false
          });
        }
      } catch (err: any) {
        console.error(`Failed to fetch unread messages for ${acc.email}:`, err.message);
      }
    }

    if (containsSimulated || allReplies.length === 0) {
      const mockReplies = [
        {
          id: 'msg_mock_1',
          account: accounts[0]?.email || 'primary.outreach@gmail.com',
          from: 'Lex Fridman <lex@fridmanpodcast.com>',
          subject: 'Re: Interview request: Pitching Dr. Arthur Stone',
          date: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
          snippet: 'Thanks for reaching out! Dr. Stone’s research on AI safety and alignment is very interesting. We would love to schedule a 2-hour interview next Tuesday at 2 PM EST. Does that work for him?',
          isSimulated: true
        },
        {
          id: 'msg_mock_2',
          account: accounts[0]?.email || 'primary.outreach@gmail.com',
          from: 'Sarah Jenkins (The Daily Tech Show) <sarah@dailytech.io>',
          subject: 'Re: Podcast Pitch: SaaS Scaling Secrets with Mark Vance',
          date: new Date(Date.now() - 3600 * 1000 * 8).toISOString(),
          snippet: 'Hi there, I looked at Mark’s bio and bio/topics and think he would be a great fit for our Founder Stories series. Can you share his media kit or speaker reel? Thanks!',
          isSimulated: true
        },
        {
          id: 'msg_mock_3',
          account: accounts[1]?.email || accounts[0]?.email || 'booking.agent@gmail.com',
          from: 'John Lee (Entrepreneurs on Fire) <john@eofire.com>',
          subject: 'Re: Booking Inquiry: Growth Marketing Masterclass',
          date: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
          snippet: 'Hey! Appreciate the outreach. Our calendar is currently booked out for Q3, but we are opening slots for Q4 next week. Let’s stay in touch, check back with me around then.',
          isSimulated: true
        }
      ];
      allReplies.push(...mockReplies);
    }

    const prompt = `You are an elite Podcast PR Assistant.
Please analyze these recent emails and replies from podcast hosts:
${JSON.stringify(allReplies)}

Provide a unified inbox executive summary:
1. State the total number of unread replies.
2. Identify hot leads/booking approvals (e.g., Lex Fridman wanting to schedule, Sarah Jenkins asking for a media kit).
3. Draft a list of recommended immediate next action items.
4. Categorize the replies into 'High Interest/Schedule Now', 'Requesting Info', and 'Deferred/Polite Decline'.

Return a structured JSON with two fields:
- "summary": A beautiful, well-formatted markdown or text executive summary.
- "actionItems": A list of short, actionable strings.`;

    const geminiResText = await generateAIContent({
      userId,
      model: 'gemini-3.5-flash',
      prompt,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          actionItems: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ['summary', 'actionItems']
      }
    });

    const parsed = JSON.parse(geminiResText || '{"summary":"","actionItems":[]}');
    res.json({
      summary: parsed.summary,
      actionItems: parsed.actionItems,
      replies: allReplies
    });
  } catch (error: any) {
    console.error('Inbox summary error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization, req.headers['x-user-email'] as string);
    const settingsData = req.body;
    const settings: AppSettings = {
      ...settingsData,
      id: `settings_${userId}`,
      userId
    };
    await saveDocument('settings', settings);
    await createAuditLog(userId, 'Update Settings', `Updated AI Settings provider to ${settings.provider}`, 'system', 'info');
    res.json(settings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 1. Leads CRUD
app.get('/api/leads', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization, req.headers['x-user-email'] as string);
    const leads = await getDocuments<Lead>('leads', userId);
    res.json(leads);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/leads', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization, req.headers['x-user-email'] as string);
    const leadData = req.body;
    const lead: Lead = {
      ...leadData,
      id: leadData.id || `lead_${Date.now()}`,
      userId,
      createdAt: new Date().toISOString(),
      status: leadData.status || 'new'
    };
    await saveDocument('leads', lead);
    await createAuditLog(userId, 'Create Lead', `Created lead ${lead.name}`, 'system', 'info');
    res.status(201).json(lead);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/leads/:id/status', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization);
    const { status } = req.body;
    const leads = await getDocuments<Lead>('leads', userId);
    const lead = leads.find(l => l.id === req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const oldStatus = lead.status;
    lead.status = status;
    await saveDocument('leads', lead);
    await createAuditLog(userId, 'Update Lead Status', `Updated lead ${lead.name} status from ${oldStatus} to ${status}`, 'system', 'info');
    res.json(lead);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/leads/:id', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization);
    const updates = req.body;
    const leads = await getDocuments<Lead>('leads', userId);
    const lead = leads.find(l => l.id === req.params.id);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const updatedLead: Lead = {
      ...lead,
      ...updates,
      id: lead.id,
      userId: lead.userId,
      createdAt: lead.createdAt
    };

    await saveDocument('leads', updatedLead);
    await createAuditLog(userId, 'Update Lead', `Updated details for lead: ${lead.name}`, 'system', 'info');
    res.json(updatedLead);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/leads/:id', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization);
    await deleteDocument('leads', req.params.id, userId);
    await createAuditLog(userId, 'Delete Lead', `Deleted lead ID: ${req.params.id}`, 'system', 'warn');
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 2. AI Parsing Route using structured output and High Thinking Level
app.post('/api/leads/parse', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization);
    const { rawText } = req.body;

    if (!rawText) {
      return res.status(400).json({ error: 'Raw text is required' });
    }

    // Call Gemini to auto-organize into structured fields.
    // Setting thinkingLevel to HIGH and model to gemini-3.1-pro-preview
    const prompt = `Analyze this raw text about a podcast guest or host prospect, and organize it into a structured biography, bulleted topics they can speak on, key highlights/credentials, and specific booking requirements or constraints. Extract their name, contact email(s), website, and main industry niche/genre.

Text:
"${rawText}"`;

    const responseText = await generateAIContent({
      userId,
      model: 'gemini-3.5-flash',
      prompt,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: 'The candidate name' },
          organization: { type: Type.STRING, description: 'The candidate organization, company, or podcast affiliation' },
          contactEmails: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Extracted contact email addresses'
          },
          website: { type: Type.STRING, description: 'Website URL if present' },
          bio: { type: Type.STRING, description: 'Summary bio/background' },
          topics: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Main presentation/speaking topics'
          },
          highlights: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Key achievements/credentials'
          },
          niche: { type: Type.STRING, description: 'Specific niche or industry genre' },
          requirements: { type: Type.STRING, description: 'Special booking requirements/availability' }
        },
        required: ['name', 'contactEmails']
      }
    });

    const parsedData = JSON.parse(responseText || '{}');
    await createAuditLog(userId, 'AI Parsing', `Successfully parsed unstructured text for prospect: ${parsedData.name || 'Unknown'}`, 'system', 'info');
    res.json(parsedData);
  } catch (error: any) {
    console.error('AI Parsing failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Campaigns API
app.get('/api/campaigns', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization, req.headers['x-user-email'] as string);
    const campaigns = await getDocuments<Campaign>('campaigns', userId);
    res.json(campaigns);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/campaigns', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization, req.headers['x-user-email'] as string);
    const campaignData = req.body;
    const campaign: Campaign = {
      ...campaignData,
      id: campaignData.id || `campaign_${Date.now()}`,
      userId,
      createdAt: new Date().toISOString(),
      status: 'draft'
    };
    await saveDocument('campaigns', campaign);
    await createAuditLog(userId, 'Create Campaign', `Created campaign ${campaign.title}`, 'campaign', 'info');
    res.status(201).json(campaign);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/campaigns/:id/status', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization);
    const { status } = req.body;
    const campaigns = await getDocuments<Campaign>('campaigns', userId);
    const campaign = campaigns.find(c => c.id === req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    campaign.status = status;
    await saveDocument('campaigns', campaign);
    await createAuditLog(userId, 'Campaign Status Changed', `Campaign ${campaign.title} status changed to ${status}`, 'campaign', 'info');
    res.json(campaign);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/campaigns/:id', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization);
    await deleteDocument('campaigns', req.params.id, userId);
    await createAuditLog(userId, 'Delete Campaign', `Deleted campaign ${req.params.id}`, 'campaign', 'info');
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/campaigns/:id', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization);
    const campaigns = await getDocuments<Campaign>('campaigns', userId);
    const campaign = campaigns.find(c => c.id === req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const updated = { ...campaign, ...req.body, id: req.params.id, userId };
    await saveDocument('campaigns', updated);
    await createAuditLog(userId, 'Update Campaign', `Updated campaign "${updated.title}" details`, 'campaign', 'info');
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Campaign Test Sending Endpoint
app.post('/api/campaigns/:id/test-send', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization);
    const { leadId, testEmail, stepIndex } = req.body;
    if (!leadId || !testEmail) {
      return res.status(400).json({ error: 'leadId and testEmail are required' });
    }

    const campaigns = await getDocuments<Campaign>('campaigns', userId);
    const campaign = campaigns.find(c => c.id === req.params.id);
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const leads = await getDocuments<Lead>('leads', userId);
    const lead = leads.find(l => l.id === leadId);
    if (!lead) return res.status(404).json({ error: 'Lead not found' });

    const stepIdx = typeof stepIndex === 'number' ? stepIndex : 0;
    const step = campaign.steps[stepIdx];
    if (!step) return res.status(404).json({ error: 'Campaign step not found' });

    let clientObj: Client | undefined;
    if (campaign.clientId) {
      const clients = await getDocuments<Client>('clients', userId);
      clientObj = clients.find(c => c.id === campaign.clientId);
    }

    const replacePlaceholders = (text: string) => {
      let guestName = lead.name;
      let hostName = "Host";

      if (lead.role === 'host') {
        hostName = lead.name;
        guestName = clientObj ? clientObj.name : "Guest";
      } else if (lead.role === 'guest') {
        guestName = lead.name;
        hostName = clientObj ? clientObj.name : "Host";
      }

      return text
        .replace(/\{\{guest_name\}\}/g, guestName)
        .replace(/\{\{name\}\}/g, lead.name)
        .replace(/\{\{guest\}\}/g, guestName)
        .replace(/\{\{host\}\}/g, hostName)
        .replace(/\{\{host_name\}\}/g, hostName)
        .replace(/\{\{bio\}\}/g, lead.bio || '')
        .replace(/\{\{niche\}\}/g, lead.niche || '')
        .replace(/\{\{category\}\}/g, lead.niche || '')
        .replace(/\{\{categories\}\}/g, lead.niche || '')
        .replace(/\{\{topics\}\}/g, (lead.topics || []).join(', '))
        .replace(/\{\{website\}\}/g, lead.website || '')
        .replace(/\{\{tags\}\}/g, (lead.tags || []).join(', '))
        .replace(/\{\{role\}\}/g, lead.role || '')
        .replace(/\{\{label\}\}/g, lead.priority || '')
        .replace(/\{\{podcast_name\}\}/g, lead.organization || lead.sourceName || '')
        .replace(/\{\{podcast name\}\}/g, lead.organization || lead.sourceName || '')
        .replace(/\{\{podcast\}\}/g, lead.organization || lead.sourceName || '')
        .replace(/\{\{client_name\}\}/g, clientObj ? clientObj.name : '')
        .replace(/\{\{client_podcast\}\}/g, clientObj ? (clientObj.podcastName || clientObj.name) : '')
        .replace(/\{\{client_niche\}\}/g, clientObj ? clientObj.niche : '')
        .replace(/\{\{client_description\}\}/g, clientObj ? clientObj.description : '');
    };

    const subject = `[TEST] ${replacePlaceholders(step.subject)}`;
    const body = `
      <div style="background-color: #0c1524; color: #f1f5f9; padding: 15px; border-radius: 8px; margin-bottom: 20px; font-family: monospace; border: 1px dashed #334155;">
        <strong>CAMPAIGN TEST MODE</strong><br/>
        Sending to Test Address: ${testEmail}<br/>
        Simulating Lead: ${lead.name} (${lead.contactEmails[0] || 'no email'})
      </div>
      ${formatEmailBodyToHtml(replacePlaceholders(step.bodyTemplate))}
    `;

    const authHeader = req.headers.authorization;
    const userClient = getOAuth2Client(authHeader);
    const gmail = google.gmail({ version: 'v1', auth: userClient });

    const rawMessage = [
      `To: ${testEmail}`,
      `Subject: ${subject}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      body
    ].join('\r\n');

    const base64EncodedEmail = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: base64EncodedEmail
      }
    });

    await createAuditLog(userId, 'Campaign Test Sent', `Sent test email for campaign "${campaign.title}" step ${stepIdx + 1} to test address ${testEmail}`, 'campaign', 'info');
    res.json({ success: true, message: 'Test email sent successfully!' });
  } catch (error: any) {
    console.error('Campaign test send failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Clients API
app.get('/api/clients', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization);
    const clients = await getDocuments<Client>('clients', userId);
    res.json(clients);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/clients', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization);
    const clientData = req.body;
    const client: Client = {
      ...clientData,
      id: clientData.id || `client_${Date.now()}`,
      userId,
      createdAt: new Date().toISOString()
    };
    await saveDocument('clients', client);
    await createAuditLog(userId, 'Create Client', `Created client ${client.name}`, 'system', 'info');
    res.status(201).json(client);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/clients/:id', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization);
    const clients = await getDocuments<Client>('clients', userId);
    const client = clients.find(c => c.id === req.params.id);
    if (!client) return res.status(404).json({ error: 'Client not found' });

    const updated = { ...client, ...req.body, id: req.params.id, userId };
    await saveDocument('clients', updated);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/clients/:id', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization);
    await deleteDocument('clients', req.params.id, userId);
    await createAuditLog(userId, 'Delete Client', `Deleted client ${req.params.id}`, 'system', 'info');
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/clients/parse', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization);
    const { rawText } = req.body;

    if (!rawText) {
      return res.status(400).json({ error: 'Raw text is required' });
    }

    const prompt = `Analyze this raw text about a PR agency's client, and organize it into a structured name, website, industry niche, podcast/brand name, list of industry tags, and an AI-generated concise pitch description.
    
Text:
"${rawText}"`;

    const responseText = await generateAIContent({
      userId,
      model: 'gemini-3.5-flash',
      prompt,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: 'The client name or company name' },
          website: { type: Type.STRING, description: 'The website URL if present' },
          niche: { type: Type.STRING, description: 'Industry category or niche (e.g. Fintech, Health, SaaS)' },
          podcastName: { type: Type.STRING, description: 'Client\'s own podcast name, brand, or book title' },
          description: { type: Type.STRING, description: 'A detailed organized bio or pitch describing the client and their expertise' },
          tags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: '3-5 descriptive industry tags/keywords'
          }
        },
        required: ['name']
      }
    });

    const parsedData = JSON.parse(responseText || '{}');
    await createAuditLog(userId, 'AI Parsing Client', `Successfully parsed unstructured text for client: ${parsedData.name || 'Unknown'}`, 'system', 'info');
    res.json(parsedData);
  } catch (error: any) {
    console.error('AI Client Parsing failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3.5 Templates API
app.get('/api/templates', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization);
    const templates = await getDocuments<PitchTemplate>('templates', userId);
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/templates', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization);
    const templateData = req.body;
    const template: PitchTemplate = {
      ...templateData,
      id: templateData.id || `template_${Date.now()}`,
      userId,
      createdAt: templateData.createdAt || new Date().toISOString()
    };
    await saveDocument('templates', template);
    await createAuditLog(userId, 'Save Template', `Saved pitch template: ${template.title}`, 'campaign', 'info');
    res.status(201).json(template);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/templates/:id', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization);
    await deleteDocument('templates', req.params.id, userId);
    await createAuditLog(userId, 'Delete Template', `Deleted pitch template id ${req.params.id}`, 'campaign', 'info');
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Outreach Queue & Execution (HITL Gate)
app.get('/api/outreach', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization);
    const list = await getDocuments<OutreachState>('outreach_states', userId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Approve a message to be sent
app.post('/api/outreach/:id/approve', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization);
    const list = await getDocuments<OutreachState>('outreach_states', userId);
    const state = list.find(s => s.id === req.params.id);
    if (!state) return res.status(404).json({ error: 'Outreach state not found' });

    state.approvedByUser = true;
    state.status = 'scheduled';
    await saveDocument('outreach_states', state);
    await createAuditLog(userId, 'Outreach Approved', `Approved step ${state.currentStepIndex + 1} for lead ID ${state.leadId}`, 'campaign', 'info');
    res.json(state);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Send Campaign Immediate (Gmail Integration!)
app.post('/api/outreach/send-immediate', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization);
    const { campaignId, leadId } = req.body;

    const authHeader = req.headers.authorization;
    const client = getOAuth2Client(authHeader);
    const gmail = google.gmail({ version: 'v1', auth: client });

    // Fetch details
    const leads = await getDocuments<Lead>('leads', userId);
    const lead = leads.find(l => l.id === leadId);
    const campaigns = await getDocuments<Campaign>('campaigns', userId);
    const campaign = campaigns.find(c => c.id === campaignId);

    if (!lead || !campaign) {
      return res.status(404).json({ error: 'Lead or campaign not found' });
    }

    const firstStep = campaign.steps[0];
    if (!firstStep) {
      return res.status(400).json({ error: 'Campaign has no configured steps' });
    }

    let clientObj: Client | undefined;
    if (campaign.clientId) {
      try {
        const clients = await getDocuments<Client>('clients', userId);
        clientObj = clients.find(c => c.id === campaign.clientId);
      } catch (err) {
        console.error('Failed to load campaign client details for direct send placeholder replacement:', err);
      }
    }

    // Substitute template placeholders
    const replacePlaceholders = (text: string) => {
      let guestName = lead.name;
      let hostName = "Host";

      if (lead.role === 'host') {
        hostName = lead.name;
        guestName = clientObj ? clientObj.name : "Guest";
      } else if (lead.role === 'guest') {
        guestName = lead.name;
        hostName = clientObj ? clientObj.name : "Host";
      }

      return text
        .replace(/\{\{guest_name\}\}/g, guestName)
        .replace(/\{\{name\}\}/g, lead.name)
        .replace(/\{\{guest\}\}/g, guestName)
        .replace(/\{\{host\}\}/g, hostName)
        .replace(/\{\{host_name\}\}/g, hostName)
        .replace(/\{\{bio\}\}/g, lead.bio || '')
        .replace(/\{\{niche\}\}/g, lead.niche || '')
        .replace(/\{\{category\}\}/g, lead.niche || '')
        .replace(/\{\{categories\}\}/g, lead.niche || '')
        .replace(/\{\{topics\}\}/g, (lead.topics || []).join(', '))
        .replace(/\{\{website\}\}/g, lead.website || '')
        .replace(/\{\{tags\}\}/g, (lead.tags || []).join(', '))
        .replace(/\{\{role\}\}/g, lead.role || '')
        .replace(/\{\{label\}\}/g, lead.priority || '')
        .replace(/\{\{podcast_name\}\}/g, lead.organization || lead.sourceName || '')
        .replace(/\{\{podcast name\}\}/g, lead.organization || lead.sourceName || '')
        .replace(/\{\{podcast\}\}/g, lead.organization || lead.sourceName || '')
        .replace(/\{\{client_name\}\}/g, clientObj ? clientObj.name : '')
        .replace(/\{\{client_podcast\}\}/g, clientObj ? (clientObj.podcastName || clientObj.name) : '')
        .replace(/\{\{client_niche\}\}/g, clientObj ? clientObj.niche : '')
        .replace(/\{\{client_description\}\}/g, clientObj ? clientObj.description : '');
    };

    const subject = replacePlaceholders(firstStep.subject);
    const body = formatEmailBodyToHtml(replacePlaceholders(firstStep.bodyTemplate));

    // Send the actual email via the authorized Gmail client of the user
    const recipient = lead.contactEmails[0];
    if (!recipient) {
      return res.status(400).json({ error: 'Lead has no contact email' });
    }

    const rawMessage = [
      `To: ${recipient}`,
      `Subject: ${subject}`,
      'Content-Type: text/html; charset=utf-8',
      'MIME-Version: 1.0',
      '',
      body
    ].join('\r\n');

    const base64EncodedEmail = Buffer.from(rawMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const gmailRes = await gmail.users.messages.send({
      userId: 'me',
      requestBody: {
        raw: base64EncodedEmail
      }
    });

    // Record the OutreachState
    const stateId = `${leadId}_${campaignId}`;
    const outreachState: OutreachState = {
      id: stateId,
      leadId,
      campaignId,
      userId,
      currentStepIndex: 0,
      status: 'sent',
      approvedByUser: true,
      history: [
        {
          stepIndex: 0,
          messageId: gmailRes.data.id || '',
          threadId: gmailRes.data.threadId || '',
          sentAt: new Date().toISOString(),
          subject,
          body
        }
      ]
    };

    await saveDocument('outreach_states', outreachState);

    // Update Lead status to 'outreached'
    lead.status = 'outreached';
    await saveDocument('leads', lead);

    await createAuditLog(userId, 'Gmail Outreach Sent', `Sent highly personalized campaign "${campaign.title}" to ${lead.name} (${recipient})`, 'gmail', 'info');

    res.json({ success: true, outreachState });
  } catch (error: any) {
    console.error('Immediate send failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Simulate email open/reply for delivery tracking demos
app.post('/api/outreach/:id/simulate-activity', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization);
    const { activity } = req.body; // 'open' | 'reply'
    
    const list = await getDocuments<OutreachState>('outreach_states', userId);
    const state = list.find(s => s.id === req.params.id);
    if (!state) return res.status(404).json({ error: 'Outreach state not found' });

    if (state.history.length > 0) {
      const lastItem = state.history[state.history.length - 1];
      if (activity === 'open') {
        lastItem.status = 'opened';
        lastItem.openedAt = new Date().toISOString();
        await saveDocument('outreach_states', state);
        await createAuditLog(userId, 'Email Opened', `Prospect opened Step ${lastItem.stepIndex + 1} email`, 'gmail', 'info');
      } else if (activity === 'reply') {
        lastItem.status = 'replied';
        state.status = 'replied';
        state.lastReplyTime = new Date().toISOString();
        
        // Also update matching Lead status to 'replied'
        const leads = await getDocuments<Lead>('leads', userId);
        const lead = leads.find(l => l.id === state.leadId);
        if (lead) {
          lead.status = 'replied';
          await saveDocument('leads', lead);
        }
        
        await saveDocument('outreach_states', state);
        await createAuditLog(userId, 'Prospect Replied', `Prospect replied to Step ${lastItem.stepIndex + 1} email`, 'gmail', 'info');
      }
    }

    res.json(state);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Calendar API
app.get('/api/calendar', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization);
    const list = await getDocuments<CalendarSyncEvent>('calendar_events', userId);
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create Calendar Event with Official Google API
app.post('/api/calendar', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization);
    const eventData = req.body;

    const authHeader = req.headers.authorization;
    const client = getOAuth2Client(authHeader);
    const calendar = google.calendar({ version: 'v3', auth: client });

    const gEvent = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: eventData.summary,
        description: eventData.notes || 'Podcast booking scheduled via Podcast Guest Booking Manager.',
        start: { dateTime: eventData.startTime },
        end: { dateTime: eventData.endTime },
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 120 }, // 2 hours
            { method: 'popup', minutes: 30 }
          ]
        }
      }
    });

    const localEvent: CalendarSyncEvent = {
      ...eventData,
      id: `cal_${Date.now()}`,
      userId,
      eventId: gEvent.data.id || '',
      reminderSent: false,
      status: 'confirmed'
    };

    await saveDocument('calendar_events', localEvent);

    // Find the lead and update their status to booked!
    const leads = await getDocuments<Lead>('leads', userId);
    const lead = leads.find(l => l.id === eventData.leadId);
    if (lead) {
      lead.status = 'booked';
      await saveDocument('leads', lead);
    }

    await createAuditLog(userId, 'Calendar Event Created', `Created calendar event: "${eventData.summary}"`, 'calendar', 'info');
    res.status(201).json(localEvent);
  } catch (error: any) {
    console.error('Calendar create failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sync from Google Calendar
app.post('/api/calendar/sync', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization);
    const authHeader = req.headers.authorization;
    const client = getOAuth2Client(authHeader);
    const calendar = google.calendar({ version: 'v3', auth: client });

    const eventsList = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: 15,
      singleEvents: true,
      orderBy: 'startTime'
    });

    const items = eventsList.data.items || [];
    let addedCount = 0;

    for (const item of items) {
      if (item.summary?.toLowerCase().includes('podcast') || item.summary?.toLowerCase().includes('interview')) {
        const id = `cal_${item.id}`;
        const startTime = item.start?.dateTime || item.start?.date || '';
        const endTime = item.end?.dateTime || item.end?.date || '';

        const localEvent: CalendarSyncEvent = {
          id,
          userId,
          leadId: 'synced_lead',
          eventId: item.id || '',
          summary: item.summary,
          startTime,
          endTime,
          status: 'confirmed',
          reminderSent: false,
          notes: item.description || ''
        };
        await saveDocument('calendar_events', localEvent);
        addedCount++;
      }
    }

    await createAuditLog(userId, 'Calendar Synchronized', `Synchronized ${addedCount} podcast/interview events from Google Calendar`, 'calendar', 'info');
    res.json({ success: true, count: addedCount });
  } catch (error: any) {
    console.error('Calendar sync failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// 6. Sheets integration (Import/Analysis using Google Sheets API & AI Agent mappings)
app.post('/api/sheets/analyze', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization);
    let { spreadsheetId, sheetName } = req.body;
    if (spreadsheetId) {
      spreadsheetId = spreadsheetId.trim();
      const match = spreadsheetId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
      if (match && match[1]) {
        spreadsheetId = match[1];
      }
    }

    const authHeader = req.headers.authorization;
    const client = getOAuth2Client(authHeader);
    const sheets = google.sheets({ version: 'v4', auth: client });

    // Fetch Sheet values (up to 500 rows for generous but fast parsing)
    const range = sheetName ? `${sheetName}!A1:Z500` : 'A1:Z500';
    const sheetsRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range
    });

    const rows = sheetsRes.data.values;
    if (!rows || rows.length < 2) {
      return res.status(400).json({ error: 'Spreadsheet has no rows or header row' });
    }

    const headers = rows[0].map(h => String(h || '').trim());
    const dataRows = rows.slice(1);

    console.log(`[Google Sheets Import] Fetched ${dataRows.length} rows to analyze from Sheet: ${sheetName || 'default'}`);

    // Call chunked AI processor to prevent timeouts
    const parsedLeads = await processLeadChunksInBatches(userId, headers, dataRows, 25, 3);
    const importedLeads: Lead[] = [];

    for (const item of parsedLeads) {
      const lead: Lead = {
        ...item,
        id: `lead_sheet_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        userId,
        source: 'sheets',
        sourceName: sheetName || spreadsheetId,
        createdAt: new Date().toISOString(),
        status: item.status || 'new',
        priority: item.priority || 'medium',
        tags: item.tags || []
      };

      await saveDocument('leads', lead);
      importedLeads.push(lead);
    }

    await createAuditLog(userId, 'Google Sheets Analyzed', `Imported ${importedLeads.length} leads from spreadsheet ID ${spreadsheetId} using automated AI Agent row mapping & classification.`, 'sheets', 'info');
    res.json(importedLeads);
  } catch (error: any) {
    console.error('Sheets analysis failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// 6a. Google Drive files browser
app.get('/api/drive/files', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization);
    const authHeader = req.headers.authorization;
    const client = getOAuth2Client(authHeader);
    const drive = google.drive({ version: 'v3', auth: client });

    const driveRes = await drive.files.list({
      pageSize: 30,
      q: "mimeType = 'application/vnd.google-apps.spreadsheet' or mimeType = 'application/pdf' or mimeType = 'text/csv' or mimeType = 'application/vnd.google-apps.document' or mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or mimeType = 'application/vnd.ms-excel'",
      fields: 'files(id, name, mimeType, modifiedTime)',
      orderBy: 'modifiedTime desc'
    });

    res.json(driveRes.data.files || []);
  } catch (error: any) {
    console.error('Failed to list Google Drive files:', error);
    res.status(500).json({ error: error.message });
  }
});

// 6b. Google Drive Lead Import (downloads & parses Doc, PDF, Sheets, CSV, Excel from Drive)
app.post('/api/drive/import', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization);
    const { fileId, mimeType, fileName } = req.body;
    if (!fileId || !mimeType) {
      return res.status(400).json({ error: 'fileId and mimeType are required' });
    }

    const authHeader = req.headers.authorization;
    const client = getOAuth2Client(authHeader);
    const drive = google.drive({ version: 'v3', auth: client });

    let contentBase64 = '';

    // Check Google Workspace format vs direct download
    if (mimeType === 'application/vnd.google-apps.spreadsheet') {
      const csvExport = await drive.files.export({
        fileId,
        mimeType: 'text/csv'
      });
      contentBase64 = Buffer.from(csvExport.data as string).toString('base64');
    } else if (mimeType === 'application/vnd.google-apps.document') {
      const txtExport = await drive.files.export({
        fileId,
        mimeType: 'text/plain'
      });
      contentBase64 = Buffer.from(txtExport.data as string).toString('base64');
    } else {
      const downloadRes = await drive.files.get({
        fileId,
        alt: 'media'
      }, { responseType: 'arraybuffer' });
      contentBase64 = Buffer.from(downloadRes.data as ArrayBuffer).toString('base64');
    }

    let headers: string[] = [];
    let dataRows: any[][] = [];
    let isSpreadsheet = false;

    // Detect if Google Sheet, CSV, or Excel
    if (
      mimeType === 'application/vnd.google-apps.spreadsheet' ||
      mimeType.includes('sheet') ||
      mimeType.includes('excel') ||
      mimeType.includes('csv') ||
      fileName.endsWith('.xlsx') ||
      fileName.endsWith('.xls') ||
      fileName.endsWith('.csv')
    ) {
      isSpreadsheet = true;
      try {
        const buffer = Buffer.from(contentBase64, 'base64');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        if (rows && rows.length >= 2) {
          // Filter completely empty rows
          const nonOptionRows = rows.filter(r => r && r.length > 0 && r.some(cell => cell !== null && cell !== undefined && cell !== ''));
          if (nonOptionRows.length >= 2) {
            headers = nonOptionRows[0].map(h => String(h || '').trim());
            dataRows = nonOptionRows.slice(1);
          }
        }
      } catch (err) {
        console.error('[Drive Import] Failed to parse spreadsheet/csv using XLSX, falling back to unstructured:', err);
        isSpreadsheet = false;
      }
    }

    let parsedLeads: any[] = [];

    if (isSpreadsheet && headers.length > 0 && dataRows.length > 0) {
      console.log(`[Drive Import] Structured sheet found: ${dataRows.length} rows. Parsing in chunks.`);
      parsedLeads = await processLeadChunksInBatches(userId, headers, dataRows, 25, 3);
    } else {
      console.log(`[Drive Import] Unstructured file found: ${fileName}. Processing with direct Gemini call.`);
      let geminiMimeType = mimeType;
      if (mimeType === 'application/vnd.google-apps.spreadsheet') {
        geminiMimeType = 'text/csv';
      } else if (mimeType === 'application/vnd.google-apps.document') {
        geminiMimeType = 'text/plain';
      }

      const prompt = `You are an AI Lead Sourcing Agent.
Analyze the contents of this Google Drive file "${fileName}" and extract any contact or lead details.
For each lead, extract and organize:
1. Name
2. Organization/Company or podcast affiliation
3. Contact email(s) (only include leads that have a valid email)
4. Website or social profiles
5. A short biography or background summary
6. Focus talking topics
7. Primary Industry Niche (e.g. Technology, Health, Business)
8. Sourcing priority ('high' | 'medium' | 'low') based on influence or credentials
9. Logical starting status (default to 'new')
10. Descriptive tags (array of strings, e.g. "CEO", "Fintech", "Guest")

Organize them into structured fields and return a JSON list under the "leads" key.`;

      const geminiResText = await generateAIContent({
        userId,
        model: 'gemini-3.5-flash',
        prompt,
        inlineData: {
          mimeType: geminiMimeType,
          data: contentBase64
        },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            leads: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  organization: { type: Type.STRING },
                  contactEmails: { type: Type.ARRAY, items: { type: Type.STRING } },
                  website: { type: Type.STRING },
                  bio: { type: Type.STRING },
                  topics: { type: Type.ARRAY, items: { type: Type.STRING } },
                  niche: { type: Type.STRING },
                  priority: { type: Type.STRING },
                  status: { type: Type.STRING },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ['name', 'contactEmails']
              }
            }
          },
          required: ['leads']
        }
      });

      const parsed = JSON.parse(geminiResText || '{"leads":[]}');
      parsedLeads = parsed.leads || [];
    }

    const imported: Lead[] = [];

    for (const item of parsedLeads) {
      const lead: Lead = {
        ...item,
        id: `lead_drive_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        userId,
        source: 'drive',
        sourceName: fileName,
        createdAt: new Date().toISOString(),
        status: item.status || 'new',
        priority: item.priority || 'medium',
        tags: item.tags || []
      };
      await saveDocument('leads', lead);
      imported.push(lead);
    }

    await createAuditLog(userId, 'Google Drive Lead Imported', `Successfully imported ${imported.length} leads from Drive file ${fileName} via AI analysis.`, 'system', 'info');
    res.json(imported);
  } catch (error: any) {
    console.error('Google Drive file import failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// 6c. Local File Ingestion (PDF, CSV, Excel upload parser)
app.post('/api/leads/upload-file', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization);
    const { fileName, mimeType, base64Content } = req.body;
    if (!base64Content || !mimeType) {
      return res.status(400).json({ error: 'Base64 content and mimeType are required' });
    }

    let headers: string[] = [];
    let dataRows: any[][] = [];
    let isSpreadsheet = false;

    // Convert Excel sheets and CSVs to JSON rows locally to enable chunked processing
    if (
      mimeType.includes('sheet') ||
      mimeType.includes('excel') ||
      mimeType.includes('ms-excel') ||
      fileName.endsWith('.xlsx') ||
      fileName.endsWith('.xls') ||
      fileName.endsWith('.csv')
    ) {
      isSpreadsheet = true;
      try {
        const buffer = Buffer.from(base64Content, 'base64');
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        if (rows && rows.length >= 2) {
          // Filter completely empty rows
          const nonOptionRows = rows.filter(r => r && r.length > 0 && r.some(cell => cell !== null && cell !== undefined && cell !== ''));
          if (nonOptionRows.length >= 2) {
            headers = nonOptionRows[0].map(h => String(h || '').trim());
            dataRows = nonOptionRows.slice(1);
          }
        }
      } catch (err: any) {
        console.error('[Upload-File] Failed to parse spreadsheet/csv using XLSX, falling back to unstructured:', err);
        isSpreadsheet = false;
      }
    }

    let parsedLeads: any[] = [];

    if (isSpreadsheet && headers.length > 0 && dataRows.length > 0) {
      console.log(`[Upload-File] Structured sheet found: ${dataRows.length} rows. Parsing in chunks.`);
      parsedLeads = await processLeadChunksInBatches(userId, headers, dataRows, 25, 3);
    } else {
      console.log(`[Upload-File] Unstructured file found: ${fileName}. Processing with direct Gemini call.`);
      let finalBase64 = base64Content;
      let finalMimeType = mimeType;

      if (fileName.endsWith('.csv')) {
        finalMimeType = 'text/csv';
      } else if (fileName.endsWith('.txt')) {
        finalMimeType = 'text/plain';
      }

      const inlinePart = {
        inlineData: {
          mimeType: finalMimeType,
          data: finalBase64
        }
      };

      const prompt = `You are an AI Lead Sourcing Agent.
Analyze the attached file "${fileName}" and extract any contact or lead details.
For each lead, extract:
1. Name
2. Organization/Company or podcast affiliation
3. Contact email(s) (only include leads that have a valid email)
4. Website or social profiles
5. A short biography or background summary
6. Focus talking topics
7. Primary Industry Niche (e.g. Technology, Health, Business)
8. Sourcing priority ('high' | 'medium' | 'low') based on influence or credentials
9. Logical starting status (default to 'new')
10. Descriptive tags (array of strings, e.g. "CEO", "Fintech", "Guest")

Organize them into structured fields and return a JSON list under the "leads" key.`;

      const geminiResText = await generateAIContent({
        userId,
        model: 'gemini-3.5-flash',
        prompt,
        inlineData: inlinePart.inlineData,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            leads: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  organization: { type: Type.STRING },
                  contactEmails: { type: Type.ARRAY, items: { type: Type.STRING } },
                  website: { type: Type.STRING },
                  bio: { type: Type.STRING },
                  topics: { type: Type.ARRAY, items: { type: Type.STRING } },
                  niche: { type: Type.STRING },
                  priority: { type: Type.STRING },
                  status: { type: Type.STRING },
                  tags: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ['name', 'contactEmails']
              }
            }
          },
          required: ['leads']
        }
      });

      const parsed = JSON.parse(geminiResText || '{"leads":[]}');
      parsedLeads = parsed.leads || [];
    }

    const imported: Lead[] = [];

    for (const item of parsedLeads) {
      const lead: Lead = {
        ...item,
        id: `lead_file_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        userId,
        source: 'file',
        sourceName: fileName,
        createdAt: new Date().toISOString(),
        status: item.status || 'new',
        priority: item.priority || 'medium',
        tags: item.tags || []
      };
      await saveDocument('leads', lead);
      imported.push(lead);
    }

    await createAuditLog(userId, 'File Lead Sourced', `Parsed local file ${fileName} and extracted ${imported.length} prospects.`, 'system', 'info');
    res.json(imported);
  } catch (error: any) {
    console.error('File lead parsing failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// 6d. URL Sourcing (Fetches content from a URL and extracts leads with AI)
app.post('/api/leads/parse-url', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization);
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    // Fetch the URL
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch URL. Status code: ${response.status}`);
    }

    const html = await response.text();
    // Trim HTML to stay within token bounds
    const textContent = html.substring(0, 50000);

    const parsePrompt = `You are an AI Sourcing Agent. Analyze the following webpage content fetched from ${url}.
Extract any potential podcast host, guest, or key business contacts/leads.
For each contact, determine:
1. Name
2. Contact email address(es) (mandatory - only return contacts where you can find or infer a valid email)
3. Website or social profiles
4. A brief biography or summary of who they are
5. Expected speaking topics or domain expertise
6. Primary Industry Niche (e.g. Technology, Health, Business, SaaS)
7. Sourcing priority ('high' | 'medium' | 'low') based on their reach and relevance
8. Tag list (e.g. "Founder", "Author", "AI developer")

Content:
${textContent}`;

    const geminiResText = await generateAIContent({
      userId,
      model: 'gemini-3.5-flash',
      prompt: parsePrompt,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          leads: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                contactEmails: { type: Type.ARRAY, items: { type: Type.STRING } },
                website: { type: Type.STRING },
                bio: { type: Type.STRING },
                topics: { type: Type.ARRAY, items: { type: Type.STRING } },
                niche: { type: Type.STRING },
                priority: { type: Type.STRING },
                status: { type: Type.STRING },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ['name', 'contactEmails']
            }
          }
        },
        required: ['leads']
      }
    });

    const parsed = JSON.parse(geminiResText || '{"leads":[]}');
    const imported: Lead[] = [];

    for (const item of (parsed.leads || [])) {
      const lead: Lead = {
        ...item,
        id: `lead_url_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        userId,
        source: 'url',
        sourceName: url,
        createdAt: new Date().toISOString(),
        status: item.status || 'new',
        priority: item.priority || 'medium',
        tags: item.tags || []
      };
      await saveDocument('leads', lead);
      imported.push(lead);
    }

    await createAuditLog(userId, 'URL Lead Sourced', `Successfully scraped ${url} and extracted ${imported.length} leads.`, 'system', 'info');
    res.json(imported);
  } catch (error: any) {
    console.error('URL parse failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// 7. Docs & AI: Preparation Doc Generator
app.post('/api/prep/generate', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization);
    const { leadId } = req.body;

    const authHeader = req.headers.authorization;
    const client = getOAuth2Client(authHeader);
    const drive = google.drive({ version: 'v3', auth: client });
    const docs = google.docs({ version: 'v1', auth: client });

    // Fetch lead details
    const leads = await getDocuments<Lead>('leads', userId);
    const lead = leads.find(l => l.id === leadId);

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Generate Interview Prep Plan using Gemini
    const prepPrompt = `You are a Podcast Interview Producer. Design a premium, comprehensive preparation package for an interview featuring:
Guest: ${lead.name}
Niche: ${lead.niche || 'General/Business'}
Bio: ${lead.bio || 'Not provided'}
Topics: ${(lead.topics || []).join(', ') || 'Not provided'}

Deliver a detailed brief with:
1. Executive Guest Profile (background summary, unique selling points, core themes)
2. 10 Customized, high-impact Interview Questions (designed for engaging, dynamic podcast flow)
3. Direct pre-interview prep notes & background research suggestions.

Deliver a structured JSON object.`;

    const prepResponseText = await generateAIContent({
      userId,
      model: 'gemini-3.5-flash',
      prompt: prepPrompt,
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          summary: { type: Type.STRING },
          questions: { type: Type.ARRAY, items: { type: Type.STRING } },
          prepNotes: { type: Type.STRING }
        },
        required: ['title', 'summary', 'questions']
      }
    });

    const prepData = JSON.parse(prepResponseText || '{}');

    // Create Google Doc in user's Drive!
    const docMeta = await drive.files.create({
      requestBody: {
        name: `Podcast Prep Pack - ${lead.name}`,
        mimeType: 'application/vnd.google-apps.document'
      }
    });

    const documentId = docMeta.data.id;
    if (!documentId) {
      throw new Error('Failed to create Google Doc file in Drive');
    }

    // Write contents to Google Doc via Google Docs API
    const docTitle = `PODCAST GUEST PREP PACK: ${lead.name.toUpperCase()}\n\n`;
    const docSummaryHeader = `EXECUTIVE SUMMARY\n`;
    const docSummary = `${prepData.summary}\n\n`;
    const docQuestionsHeader = `SUGGESTED HIGH-IMPACT QUESTIONS\n`;
    const docQuestionsList = prepData.questions.map((q: string, idx: number) => `${idx + 1}. ${q}`).join('\n') + '\n\n';
    const docNotesHeader = `PRODUCER NOTES & TIPS\n`;
    const docNotes = `${prepData.prepNotes || 'Review social links and check recent posts.'}\n`;

    const fullText = docTitle + docSummaryHeader + docSummary + docQuestionsHeader + docQuestionsList + docNotesHeader + docNotes;

    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            insertText: {
              location: { index: 1 },
              text: fullText
            }
          }
        ]
      }
    });

    // Make file readable to anyone with link (for shareability)
    await drive.permissions.create({
      fileId: documentId,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });

    const docUrl = `https://docs.google.com/document/d/${documentId}/edit`;

    // Store Google Doc URL in the lead record
    lead.mediaKitUrl = docUrl;
    await saveDocument('leads', lead);

    await createAuditLog(userId, 'Prep Docs Generated', `Generated Podcast Prep Document in Google Drive for ${lead.name}: ${docUrl}`, 'system', 'info');

    res.json({ docUrl, questions: prepData.questions });
  } catch (error: any) {
    console.error('Docs generation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// 8. Logs API
app.get('/api/logs', async (req, res) => {
  try {
    const userId = await getUserEmail(req.headers.authorization);
    const logs = await getDocuments<AuditLog>('logs', userId);
    // Sort logs descending by timestamp
    const sorted = logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json(sorted);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 9. Root Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Converts a plain-text email body (with newlines) into well-formed HTML keeping paragraphs/formation
const formatEmailBodyToHtml = (body: string): string => {
  if (!body) return '';
  if (/<(p|br|div|html|body|span|table|tr|td)\b[^>]*>/i.test(body)) {
    return body;
  }
  const formatted = body.replace(/\r?\n/g, '<br />');
  return `<div style="font-family: Arial, sans-serif; font-size: 14px; line-height: 1.6; color: #1e293b;">${formatted}</div>`;
};

// Timezone-based delay scheduling calculator
const calculateNextSendTime = (campaign: Campaign, currentStepIdx: number, baseDate: Date): Date => {
  const step = campaign.steps[currentStepIdx];
  const delayDays = step ? step.delayDays : 0;
  
  // If first step has 0 delay days and no preferred time is set, schedule it to run immediately (5 seconds in future)
  if (currentStepIdx === 0 && delayDays === 0 && !campaign.preferredTime) {
    return new Date(Date.now() + 5000);
  }
  
  // Calculate next day by adding delay days
  const nextDate = new Date(baseDate.getTime() + delayDays * 24 * 60 * 60 * 1000);
  
  // Set preferred hour of day (e.g. preferredTime is "09:00")
  let preferredHour = 9;
  let preferredMinute = 0;
  if (campaign.preferredTime) {
    const parts = campaign.preferredTime.split(':');
    if (parts.length === 2) {
      preferredHour = parseInt(parts[0], 10);
      preferredMinute = parseInt(parts[1], 10);
    }
  }
  
  // Shift relative to selected timezone (offset in minutes relative to UTC)
  let tzOffsetMinutes = 0;
  const tz = campaign.timezone || 'UTC';
  if (tz === 'America/New_York') tzOffsetMinutes = -300;
  else if (tz === 'America/Chicago') tzOffsetMinutes = -360;
  else if (tz === 'America/Denver') tzOffsetMinutes = -420;
  else if (tz === 'America/Los_Angeles') tzOffsetMinutes = -480;
  else if (tz === 'Europe/London') tzOffsetMinutes = 0;
  else if (tz === 'Europe/Paris') tzOffsetMinutes = 60;
  else if (tz === 'Europe/Athens') tzOffsetMinutes = 120;
  else if (tz === 'Asia/Dubai') tzOffsetMinutes = 240;
  else if (tz === 'Asia/Kolkata') tzOffsetMinutes = 330;
  else if (tz === 'Asia/Dhaka') tzOffsetMinutes = 360; // UTC+6 Bangladesh Time
  else if (tz === 'Asia/Singapore') tzOffsetMinutes = 480;
  else if (tz === 'Asia/Tokyo') tzOffsetMinutes = 540;
  else if (tz === 'Australia/Sydney') tzOffsetMinutes = 600;
  else if (tz === 'Pacific/Auckland') tzOffsetMinutes = 720;
  else tzOffsetMinutes = 0; // Default to UTC

  // Safely translate target time to UTC time
  // UTC Hours = Target Hours - (tzOffset / 60)
  // UTC Minutes = Target Minutes - (tzOffset % 60)
  let utcHours = preferredHour - Math.floor(tzOffsetMinutes / 60);
  let utcMinutes = preferredMinute - (tzOffsetMinutes % 60);
  
  if (utcMinutes < 0) {
    utcMinutes += 60;
    utcHours -= 1;
  } else if (utcMinutes >= 60) {
    utcMinutes -= 60;
    utcHours += 1;
  }
  
  nextDate.setUTCHours(utcHours, utcMinutes, 0, 0);

  // If the calculated time has already passed, push to tomorrow
  if (nextDate.getTime() <= Date.now()) {
    nextDate.setTime(nextDate.getTime() + 24 * 60 * 60 * 1000);
  }

  // Ensure day-of-week constraints are respected in the target timezone
  let attempts = 0;
  while (attempts < 14) {
    attempts++;
    // Get the local day of week in the target timezone
    const localTimeForTz = new Date(nextDate.getTime() + tzOffsetMinutes * 60 * 1000);
    const dayOfWeek = localTimeForTz.getUTCDay(); // 0 = Sunday, 1 = Monday, ...

    let dayAllowed = true;
    if (campaign.sendDays === 'weekdays') {
      dayAllowed = dayOfWeek >= 1 && dayOfWeek <= 5;
    } else if (Array.isArray(campaign.sendDays) && campaign.sendDays.length > 0) {
      dayAllowed = campaign.sendDays.includes(String(dayOfWeek));
    }

    if (dayAllowed) {
      break;
    } else {
      nextDate.setTime(nextDate.getTime() + 24 * 60 * 60 * 1000);
    }
  }
  
  return nextDate;
};

// Background Automated Outreach Engine with multi-account support, automatic token refresh, and robust retries
const runCampaignEngine = async (specificCampaignId?: string) => {
  try {
    let userIds: string[] = [];
    if (specificCampaignId) {
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('documents')
            .select('user_id')
            .eq('id', specificCampaignId)
            .maybeSingle();
          if (data && data.user_id) {
            userIds = [data.user_id];
          }
        } catch (err) {
          console.error(`Error loading campaign ${specificCampaignId} from Supabase:`, err);
        }
      }
      if (userIds.length === 0) {
        try {
          const list = readMockCollection<Campaign>('campaigns');
          const campaign = list.find(c => c.id === specificCampaignId);
          if (campaign && campaign.userId) {
            userIds = [campaign.userId];
          }
        } catch (err) {
          console.error(`Error loading campaign ${specificCampaignId} from mock:`, err);
        }
      }
    } else {
      // Scan all active campaign userIds
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('documents')
            .select('user_id')
            .eq('collection', 'campaigns');
          if (data) {
            const ids = new Set<string>();
            data.forEach((row: any) => {
              if (row.user_id) ids.add(row.user_id);
            });
            userIds = Array.from(ids);
          }
        } catch (err) {
          console.error('Error scanning global campaign userIds from Supabase:', err);
        }
      } else {
        try {
          const list = readMockCollection<Campaign>('campaigns');
          const active = list.filter(c => c.status === 'active');
          userIds = Array.from(new Set(active.map(c => c.userId)));
        } catch (err) {
          userIds = [];
        }
      }
    }

    if (userIds.length === 0) return;

    for (const userId of userIds) {
      const campaigns = await getDocuments<Campaign>('campaigns', userId);
      const activeCampaigns = campaigns.filter(c => {
        if (specificCampaignId) {
          return c.id === specificCampaignId;
        }
        return c.status === 'active';
      });
      const leads = await getDocuments<Lead>('leads', userId);
      const outreachStates = await getDocuments<OutreachState>('outreach_states', userId);
      const connectedAccounts = await getDocuments<any>('connected_accounts', userId);

      for (const campaign of activeCampaigns) {
        const { id: campaignId, steps, leadIds, excludedLeadIds } = campaign;
        if (!steps || steps.length === 0) continue;

        // Resolve targeted leads via segments or individual list
        let targetedLeads: Lead[] = [];
        if (campaign.targetSegments) {
          const { tags, niches, roles } = campaign.targetSegments;
          targetedLeads = leads.filter(l => {
            // Respect manual exclusions even in segment mode
            if (excludedLeadIds && excludedLeadIds.includes(l.id)) {
              return false;
            }

            const roleMatch = !roles || roles.length === 0 || (
              l.role && roles.some(r => r.toLowerCase() === l.role?.toLowerCase())
            );
            const nicheMatch = !niches || niches.length === 0 || (
              l.niche && niches.some(n => n.toLowerCase() === l.niche?.toLowerCase())
            );
            
            let leadTags: string[] = [];
            const rawTags = (l as any).tags;
            if (Array.isArray(rawTags)) {
              leadTags = rawTags;
            } else if (typeof rawTags === 'string' && rawTags) {
              leadTags = rawTags.split(',').map((t: string) => t.trim()).filter(Boolean);
            }

            const tagMatch = !tags || tags.length === 0 || (
              leadTags.length > 0 && leadTags.some(t => tags.some(sel => sel.toLowerCase() === t.toLowerCase()))
            );

            return roleMatch && nicheMatch && tagMatch;
          });
        } else {
          targetedLeads = leads.filter(l => leadIds.includes(l.id));
        }

        for (const lead of targetedLeads) {
          if (lead.status === 'booked' || lead.status === 'declined') continue;

          const stateId = `${lead.id}_${campaignId}`;
          let state = outreachStates.find(s => s.id === stateId);

          if (!state) {
            const nextSend = calculateNextSendTime(campaign, 0, new Date());
            state = {
              id: stateId,
              leadId: lead.id,
              campaignId,
              userId,
              currentStepIndex: 0,
              status: 'scheduled',
              approvedByUser: true,
              nextSendTime: nextSend.toISOString(),
              history: [],
              retryCount: 0
            };
            await saveDocument('outreach_states', state);
            await createAuditLog(userId, 'Outreach Initialized', `Scheduled Step 1 of campaign "${campaign.title}" for ${lead.name} at ${nextSend.toISOString()}`, 'campaign', 'info');
            continue;
          }

          if ((state.status === 'scheduled' || state.status === 'retry') && state.nextSendTime) {
            const nextSendTime = new Date(state.nextSendTime);
            if (nextSendTime.getTime() <= Date.now()) {
              const stepIdx = state.currentStepIndex;
              const currentStep = steps[stepIdx];
              if (!currentStep) {
                state.status = 'completed';
                await saveDocument('outreach_states', state);
                continue;
              }

              const recipient = lead.contactEmails[0];
              if (!recipient) {
                state.status = 'paused';
                await saveDocument('outreach_states', state);
                await createAuditLog(userId, 'Outreach Failed', `Lead ${lead.name} has no contact email. Paused campaign.`, 'gmail', 'error');
                continue;
              }

              let clientObj: Client | undefined;
              if (campaign.clientId) {
                try {
                  const clients = await getDocuments<Client>('clients', userId);
                  clientObj = clients.find(c => c.id === campaign.clientId);
                } catch (err) {
                  console.error('Failed to load campaign client details for placeholder replacement:', err);
                }
              }

              const replacePlaceholders = (text: string) => {
                let guestName = lead.name;
                let hostName = "Host";

                if (lead.role === 'host') {
                  hostName = lead.name;
                  guestName = clientObj ? clientObj.name : "Guest";
                } else if (lead.role === 'guest') {
                  guestName = lead.name;
                  hostName = clientObj ? clientObj.name : "Host";
                }

                return text
                  .replace(/\{\{guest_name\}\}/g, guestName)
                  .replace(/\{\{name\}\}/g, lead.name)
                  .replace(/\{\{guest\}\}/g, guestName)
                  .replace(/\{\{host\}\}/g, hostName)
                  .replace(/\{\{host_name\}\}/g, hostName)
                  .replace(/\{\{bio\}\}/g, lead.bio || '')
                  .replace(/\{\{niche\}\}/g, lead.niche || '')
                  .replace(/\{\{category\}\}/g, lead.niche || '')
                  .replace(/\{\{categories\}\}/g, lead.niche || '')
                  .replace(/\{\{topics\}\}/g, (lead.topics || []).join(', '))
                  .replace(/\{\{website\}\}/g, lead.website || '')
                  .replace(/\{\{tags\}\}/g, (lead.tags || []).join(', '))
                  .replace(/\{\{role\}\}/g, lead.role || '')
                  .replace(/\{\{label\}\}/g, lead.priority || '')
                  .replace(/\{\{podcast_name\}\}/g, lead.organization || lead.sourceName || '')
                  .replace(/\{\{podcast name\}\}/g, lead.organization || lead.sourceName || '')
                  .replace(/\{\{podcast\}\}/g, lead.organization || lead.sourceName || '')
                  .replace(/\{\{client_name\}\}/g, clientObj ? clientObj.name : '')
                  .replace(/\{\{client_podcast\}\}/g, clientObj ? (clientObj.podcastName || clientObj.name) : '')
                  .replace(/\{\{client_niche\}\}/g, clientObj ? clientObj.niche : '')
                  .replace(/\{\{client_description\}\}/g, clientObj ? clientObj.description : '');
              };

              const subject = replacePlaceholders(currentStep.subject);
              const body = formatEmailBodyToHtml(replacePlaceholders(currentStep.bodyTemplate));

              let messageId = `sim_${Date.now()}`;
              let threadId = `sim_thread_${Date.now()}`;
              let sendSuccess = false;
              let errorMessage = '';

              // Resolve sender account details
              let senderAccount = campaign.senderEmail
                ? connectedAccounts.find(acc => acc.email === campaign.senderEmail)
                : connectedAccounts[0];

              if (senderAccount && !senderAccount.isSimulated) {
                try {
                  let accessToken = decryptToken(senderAccount.accessToken);
                  if (Date.now() >= (senderAccount.expiryDate || 0)) {
                    accessToken = await refreshAccessToken(senderAccount);
                  }

                  const client = new google.auth.OAuth2();
                  client.setCredentials({ access_token: accessToken });
                  const gmail = google.gmail({ version: 'v1', auth: client });

                  const rawMessage = [
                    `To: ${recipient}`,
                    `Subject: ${subject}`,
                    'Content-Type: text/html; charset=utf-8',
                    'MIME-Version: 1.0',
                    '',
                    body
                  ].join('\r\n');

                  const base64EncodedEmail = Buffer.from(rawMessage)
                    .toString('base64')
                    .replace(/\+/g, '-')
                    .replace(/\//g, '_')
                    .replace(/=+$/, '');

                  const gmailRes = await gmail.users.messages.send({
                    userId: 'me',
                    requestBody: {
                      raw: base64EncodedEmail
                    }
                  });

                  messageId = gmailRes.data.id || messageId;
                  threadId = gmailRes.data.threadId || threadId;
                  sendSuccess = true;
                } catch (err: any) {
                  errorMessage = err.message;
                  console.error(`Real Gmail send failed for ${userId} using ${senderAccount.email}:`, errorMessage);
                }
              } else {
                // Simulated sending OR fallback user_tokens lookup
                let userTokenHeader = activeUserTokens.get(userId);
                if (!userTokenHeader) {
                  try {
                    const dbTokens = await getDocuments<{ id: string; email: string; authHeader: string }>('user_tokens', userId);
                    const tokenDoc = dbTokens.find(t => t.email === userId);
                    if (tokenDoc) {
                      userTokenHeader = tokenDoc.authHeader;
                      activeUserTokens.set(userId, userTokenHeader);
                    }
                  } catch (dbErr) {
                    console.error(`Could not restore token from DB for background sending of ${userId}:`, dbErr);
                  }
                }

                if (userTokenHeader) {
                  try {
                    const client = getOAuth2Client(userTokenHeader);
                    const gmail = google.gmail({ version: 'v1', auth: client });

                    const rawMessage = [
                      `To: ${recipient}`,
                      `Subject: ${subject}`,
                      'Content-Type: text/html; charset=utf-8',
                      'MIME-Version: 1.0',
                      '',
                      body
                    ].join('\r\n');

                    const base64EncodedEmail = Buffer.from(rawMessage)
                      .toString('base64')
                      .replace(/\+/g, '-')
                      .replace(/\//g, '_')
                      .replace(/=+$/, '');

                    const gmailRes = await gmail.users.messages.send({
                      userId: 'me',
                      requestBody: {
                        raw: base64EncodedEmail
                      }
                    });

                    messageId = gmailRes.data.id || messageId;
                    threadId = gmailRes.data.threadId || threadId;
                    sendSuccess = true;
                  } catch (err: any) {
                    errorMessage = err.message;
                    console.error(`Fallback send failed for ${userId}:`, errorMessage);
                  }
                } else {
                  // Pure simulation mode
                  sendSuccess = true;
                  await new Promise(r => setTimeout(r, 1000)); // Rate limiting / batch delay
                }
              }

              if (sendSuccess) {
                const newHistoryItem = {
                  stepIndex: stepIdx,
                  messageId,
                  threadId,
                  sentAt: new Date().toISOString(),
                  subject,
                  body,
                  status: 'delivered' as const,
                  deliveryTime: new Date().toISOString()
                };

                state.history.push(newHistoryItem);
                state.retryCount = 0; // reset retry counter

                const nextStepIdx = stepIdx + 1;
                if (nextStepIdx < steps.length) {
                  const nextSend = calculateNextSendTime(campaign, nextStepIdx, new Date());
                  state.currentStepIndex = nextStepIdx;
                  state.status = 'scheduled';
                  state.nextSendTime = nextSend.toISOString();
                  await createAuditLog(userId, 'Outreach Sent', `Sent Campaign step ${stepIdx + 1} to ${lead.name} using ${senderAccount ? senderAccount.email : 'system'}. Next scheduled for ${nextSend.toISOString()}`, 'campaign', 'info');
                } else {
                  state.status = 'completed';
                  state.nextSendTime = undefined;
                  await createAuditLog(userId, 'Outreach Completed', `Completed all campaign sequence steps for ${lead.name}`, 'campaign', 'info');
                }

                await saveDocument('outreach_states', state);

                if (lead.status === 'new') {
                  lead.status = 'outreached';
                  await saveDocument('leads', lead);
                }
              } else {
                // Implement exponential backoff retry logic
                const retries = (state.retryCount || 0) + 1;
                state.retryCount = retries;
                
                if (retries > 3) {
                  state.status = 'paused';
                  await createAuditLog(userId, 'Campaign Paused due to Errors', `Failed sending to ${lead.name} after 3 attempts. Error: ${errorMessage}`, 'gmail', 'error');
                } else {
                  state.status = 'retry';
                  // retry in 1 minute, 2 minutes, 4 minutes
                  const retryDelayMinutes = Math.pow(2, retries - 1);
                  const retryTime = new Date(Date.now() + retryDelayMinutes * 60 * 1000);
                  state.nextSendTime = retryTime.toISOString();
                  await createAuditLog(userId, 'Outreach Delivery Retry', `Retrying outreach send to ${lead.name} in ${retryDelayMinutes} mins (attempt ${retries}/3). Error: ${errorMessage}`, 'gmail', 'warn');
                }
                await saveDocument('outreach_states', state);
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Error running campaign engine:', err);
  }
};

// Campaign execution & manually tick trigger API endpoints
app.post('/api/campaign/execute/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    console.log(`[CLOUD TASK SIMULATOR] Received execution request for campaign: ${campaignId}`);
    await runCampaignEngine(campaignId);
    res.json({ success: true, message: `Campaign execution triggered for ${campaignId}` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/campaigns/tick', async (req, res) => {
  try {
    console.log('[MANUAL ENGINE TICK] Triggering campaign engine run...');
    await runCampaignEngine();
    res.json({ success: true, message: 'Campaign engine loop ticked successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// START EXPRESS SERVER WITH VITE MIDDLEWARE OR STATIC FILES
const startServer = async () => {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express server running on http://localhost:${PORT}`);
  });

  // Run the Campaign Engine production-grade background worker every minute using node-cron
  cron.schedule('* * * * *', async () => {
    console.log('[SYSTEM ENGINE] cron tick: checking for due campaigns...');
    try {
      await runCampaignEngine();
    } catch (err) {
      console.error('[SYSTEM ENGINE] Error in scheduled campaign engine task:', err);
    }
  });
  console.log('[SYSTEM ENGINE] Production-grade persistent Campaign Scheduler started (node-cron running * * * * *)');

  // Run once immediately on startup to process any campaigns pending right away
  try {
    await seedSupabaseIfEmpty();
  } catch (seedErr) {
    console.error('[SYSTEM ENGINE] Error during initial database seed on startup:', seedErr);
  }

  runCampaignEngine().catch(err => {
    console.error('[SYSTEM ENGINE] Error during initial campaign engine run on startup:', err);
  });
};

startServer();
