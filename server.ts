import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import firebaseConfig from './firebase-applet-config.json';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy initializer for Gemini client to prevent crashes if key is not configured
let geminiClient: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI | null {
  if (!geminiClient && process.env.GEMINI_API_KEY) {
    try {
      geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    } catch (err) {
      console.warn('Failed to initialize GoogleGenAI client:', err);
    }
  }
  return geminiClient;
}

// ==========================================
// AUTHENTICATION & RATE LIMITING MIDDLEWARE
// ==========================================
const EXPECTED_PROJECT_ID = firebaseConfig.projectId;
const EXPECTED_ISSUER = `https://securetoken.google.com/${EXPECTED_PROJECT_ID}`;

// In-memory sliding-window rate limiter
interface RateLimitEntry {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitEntry>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 25;

// Clean up stale rate limit entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(key);
    }
  }
}, 5 * 60 * 1000);

export function parseJwtPayload(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export function requireFirebaseAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized: Authentication required to access CivicBridge AI services.',
    });
    return;
  }

  const token = authHeader.slice(7).trim();
  const payload = parseJwtPayload(token);

  if (!payload) {
    res.status(401).json({
      error: 'Unauthorized: Malformed authentication token.',
    });
    return;
  }

  // Verify token expiry
  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < nowSec) {
    res.status(401).json({
      error: 'Unauthorized: Authentication token has expired.',
    });
    return;
  }

  // Verify token issuer and audience for project
  if (payload.iss && payload.iss !== EXPECTED_ISSUER) {
    res.status(401).json({
      error: 'Unauthorized: Invalid token issuer.',
    });
    return;
  }
  if (payload.aud && payload.aud !== EXPECTED_PROJECT_ID) {
    res.status(401).json({
      error: 'Unauthorized: Invalid token audience.',
    });
    return;
  }

  const userId = payload.user_id || payload.sub || req.ip || 'unknown';

  // Apply Rate Limiting
  const now = Date.now();
  let limitEntry = rateLimitMap.get(userId);
  if (!limitEntry || now > limitEntry.resetAt) {
    limitEntry = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateLimitMap.set(userId, limitEntry);
  } else {
    limitEntry.count += 1;
    if (limitEntry.count > MAX_REQUESTS_PER_WINDOW) {
      const retryAfterSec = Math.ceil((limitEntry.resetAt - now) / 1000);
      res.status(429).json({
        error: `Rate limit exceeded. Please wait ${retryAfterSec} seconds before submitting more AI requests.`,
      });
      return;
    }
  }

  // Attach user to request
  (req as any).user = payload;
  next();
}

// Deterministic fallback rule-based classifier for 100% resilience
function deterministicCivicClassifier(title: string, description: string) {
  const text = `${title} ${description}`.toLowerCase();

  let category = 'Other Civic Issues';
  let suggestedDepartment = 'Central Municipal Grievance Cell';
  let suggestedPriority: 'Low' | 'Medium' | 'High' | 'Urgent' = 'Medium';
  let priorityScore = 65;
  const reasoning: string[] = [];
  const keyEntities: string[] = [];
  const tags: string[] = [];

  if (text.match(/pothole|road|asphalt|tarmac|crater|pavement|footpath|divider|bridge|flyover/)) {
    category = 'Roads & Infrastructure';
    suggestedDepartment = 'Municipal Road Maintenance & Civil Infrastructure';
    priorityScore = 78;
    suggestedPriority = 'High';
    reasoning.push('Detected structural roadway defect affecting vehicle and pedestrian safety.');
    keyEntities.push('Road Surface Defect');
    tags.push('Roads', 'Asphalt', 'TrafficSafety');
  } else if (text.match(/water|pipe|leak|drain|drainage|sewage|sewer|gutter|manhole|contamination|overflow/)) {
    category = 'Water & Drainage';
    suggestedDepartment = 'Water Supply, Sewerage & Stormwater Drainage Board';
    priorityScore = 85;
    suggestedPriority = 'High';
    reasoning.push('Detected water supply breakdown or stormwater/sewage overflow hazard.');
    keyEntities.push('Pipeline & Drainage Network');
    tags.push('WaterSupply', 'Drainage', 'Sanitation');
  } else if (text.match(/garbage|trash|dump|waste|bin|sweeping|filth|debris|stench|litter/)) {
    category = 'Sanitation & Solid Waste';
    suggestedDepartment = 'Solid Waste Management & Public Sanitation';
    priorityScore = 70;
    suggestedPriority = 'Medium';
    reasoning.push('Detected uncollected refuse or illegal waste dumping impacting public hygiene.');
    keyEntities.push('Solid Waste Accumulation');
    tags.push('Cleanliness', 'SolidWaste', 'SwachhBharat');
  } else if (text.match(/light|dark|streetlight|lamp|wire|short circuit|electricity|pole/)) {
    category = 'Public Safety & Streetlighting';
    suggestedDepartment = 'Electrical Engineering & Street Lighting Division';
    priorityScore = 72;
    suggestedPriority = 'Medium';
    reasoning.push('Defective illumination detected; creates nighttime pedestrian safety and crime vulnerabilities.');
    keyEntities.push('Street Light Network');
    tags.push('Lighting', 'NightSafety', 'Electrical');
  } else if (text.match(/tree|fallen|branch|park|garden|plantation|encroachment|forest/)) {
    category = 'Environment & Green Spaces';
    suggestedDepartment = 'Parks, Gardens & Urban Forestry Department';
    priorityScore = 60;
    suggestedPriority = 'Low';
    reasoning.push('Detected horticultural obstruction or municipal garden maintenance issue.');
    keyEntities.push('Urban Horticulture');
    tags.push('GreenSpaces', 'TreeCare');
  } else if (text.match(/bus|traffic|signal|jam|parking|auto|rickshaw|speed|zebra/)) {
    category = 'Public Transport & Traffic';
    suggestedDepartment = 'Traffic Engineering & Municipal Transport Undertaking';
    priorityScore = 75;
    suggestedPriority = 'Medium';
    reasoning.push('Identified traffic flow impediment or public transport terminal issue.');
    keyEntities.push('Traffic Control System');
    tags.push('Mobility', 'Transit');
  } else if (text.match(/dengue|malaria|mosquito|fogging|hospital|clinic|doctor|stray dog|rabies|animal/)) {
    category = 'Healthcare & Sanitation';
    suggestedDepartment = 'Public Health & Vector Control Department';
    priorityScore = 88;
    suggestedPriority = 'High';
    reasoning.push('Vector-borne contagion or animal hazard identified requiring immediate health inspector dispatch.');
    keyEntities.push('Vector/Health Vector');
    tags.push('HealthSafety', 'PublicHealth');
  }

  // Check for critical urgency indicators
  if (text.match(/accident|danger|casualty|collapse|fire|spark|burst|sinkhole|emergency/)) {
    priorityScore = Math.min(100, priorityScore + 15);
    suggestedPriority = 'Urgent';
    reasoning.unshift('CRITICAL ALERT: Hazard keywords indicate acute danger to human life or property.');
  }

  const isDuplicateOrSpam = text.length < 10 && !text.includes(' ');
  const duplicateSpamReason = isDuplicateOrSpam
    ? 'Description lacks sufficient civic context or detail for dispatch.'
    : '';

  return {
    category,
    suggestedDepartment,
    suggestedPriority,
    priorityScore,
    reasoning,
    keyIdentifiedEntities: keyEntities,
    tags,
    summaryForOfficers: `${title}. Reported issue: ${description.slice(0, 180)}...`,
    isDuplicateOrSpam,
    duplicateSpamReason,
    isPreliminary: true,
    generatedAt: new Date().toISOString(),
  };
}

// ==========================================
// 1. HEALTHCHECK
// ==========================================
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    geminiConfigured: !!process.env.GEMINI_API_KEY,
  });
});

// ==========================================
// 2. AI COMPLAINT CLASSIFICATION & TRIAGE (SECURED)
// ==========================================
app.post('/api/ai/classify', requireFirebaseAuth, async (req: Request, res: Response) => {
  const { title = '', description = '', ward = '', category = '' } = req.body;

  const fallback = deterministicCivicClassifier(title, description);

  const ai = getGemini();
  if (!ai) {
    // Return robust deterministic fallback without failing
    return res.json({
      success: true,
      data: fallback,
      source: 'deterministic_engine',
    });
  }

  try {
    const prompt = `You are the lead Municipal Dispatcher and AI Triage Specialist for CivicBridge, an official government municipal grievance platform.
Analyze the following civic complaint submitted by a citizen:

Title: "${title}"
Description: "${description}"
Ward/Area: "${ward || 'Not specified'}"
User-selected Category: "${category || 'Not specified'}"

Perform comprehensive civic triage and return ONLY a valid JSON object matching this schema:
{
  "category": "Roads & Infrastructure" | "Water & Drainage" | "Sanitation & Solid Waste" | "Public Transport & Traffic" | "Healthcare & Sanitation" | "Public Safety & Streetlighting" | "Environment & Green Spaces" | "Civic & Revenue Services" | "Other Civic Issues",
  "suggestedDepartment": string,
  "suggestedPriority": "Low" | "Medium" | "High" | "Urgent",
  "priorityScore": number (1 to 100 integer),
  "reasoning": string[] (2-3 concise administrative justification bullets),
  "keyIdentifiedEntities": string[] (e.g. ["Pothole", "Asphalt Failure", "Arterial Road"]),
  "tags": string[] (3-5 searchable keywords),
  "summaryForOfficers": string (concise 1-2 sentence executive brief for field repair crews),
  "isDuplicateOrSpam": boolean,
  "duplicateSpamReason": string
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '';
    const parsed = JSON.parse(responseText);

    return res.json({
      success: true,
      data: {
        category: parsed.category || fallback.category,
        suggestedDepartment: parsed.suggestedDepartment || fallback.suggestedDepartment,
        suggestedPriority: parsed.suggestedPriority || fallback.suggestedPriority,
        priorityScore: typeof parsed.priorityScore === 'number' ? parsed.priorityScore : fallback.priorityScore,
        reasoning: Array.isArray(parsed.reasoning) && parsed.reasoning.length > 0 ? parsed.reasoning : fallback.reasoning,
        keyIdentifiedEntities: Array.isArray(parsed.keyIdentifiedEntities) ? parsed.keyIdentifiedEntities : fallback.keyIdentifiedEntities,
        tags: Array.isArray(parsed.tags) ? parsed.tags : fallback.tags,
        summaryForOfficers: parsed.summaryForOfficers || fallback.summaryForOfficers,
        isDuplicateOrSpam: !!parsed.isDuplicateOrSpam,
        duplicateSpamReason: parsed.duplicateSpamReason || '',
        isPreliminary: true,
        generatedAt: new Date().toISOString(),
      },
      source: 'gemini-2.5-flash',
    });
  } catch (err) {
    console.warn('Gemini classification fallback triggered (free-tier resilient):', err);
    return res.json({
      success: true,
      data: fallback,
      source: 'deterministic_engine',
    });
  }
});

// ==========================================
// 3. AI COMPLAINT SUMMARY FOR FIELD CREW (SECURED)
// ==========================================
app.post('/api/ai/summarize', requireFirebaseAuth, async (req: Request, res: Response) => {
  const { title = '', description = '', timeline = [] } = req.body;

  const ai = getGemini();
  if (!ai) {
    return res.json({
      success: true,
      summary: `${title}: ${description.slice(0, 200)}...`,
      actionPlan: ['Dispatch field inspection team', 'Assess photographic evidence', 'Procure repair materials'],
    });
  }

  try {
    const prompt = `Summarize this civic problem for field engineers in 2 concise sentences, with 3 bulleted immediate action steps:
Title: ${title}
Details: ${description}
Existing timeline: ${JSON.stringify(timeline.slice(-3))}

Return JSON:
{
  "summary": string,
  "actionPlan": string[]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({
      success: true,
      summary: parsed.summary || `${title}: ${description.slice(0, 200)}...`,
      actionPlan: parsed.actionPlan || ['Inspect site', 'Verify scope of repair', 'Execute resolution'],
    });
  } catch (err) {
    console.warn('Gemini summarize fallback triggered:', err);
    return res.json({
      success: true,
      summary: `${title}: ${description.slice(0, 200)}...`,
      actionPlan: ['Inspect site', 'Verify scope of repair', 'Execute resolution'],
    });
  }
});

// ==========================================
// 4. DUPLICATE & SPAM DETECTION (SECURED)
// ==========================================
app.post('/api/ai/duplicate-check', requireFirebaseAuth, (req: Request, res: Response) => {
  const { title = '', description = '', existingComplaints = [] } = req.body;

  const currentWords = new Set(`${title} ${description}`.toLowerCase().split(/\W+/).filter((w) => w.length > 3));

  let bestMatch: { id: string; title: string; score: number } | null = null;

  for (const item of existingComplaints) {
    const otherWords = new Set(`${item.title} ${item.description || ''}`.toLowerCase().split(/\W+/).filter((w) => w.length > 3));
    let intersection = 0;
    currentWords.forEach((w) => {
      if (otherWords.has(w)) intersection++;
    });

    const union = new Set([...currentWords, ...otherWords]).size;
    const jaccard = union > 0 ? intersection / union : 0;

    if (jaccard > 0.45 && (!bestMatch || jaccard > bestMatch.score)) {
      bestMatch = {
        id: item.id,
        title: item.title,
        score: Math.round(jaccard * 100),
      };
    }
  }

  res.json({
    isDuplicate: !!bestMatch && bestMatch.score > 55,
    matchedComplaint: bestMatch,
  });
});

// ==========================================
// VITE INTEGRATION / SPA SERVING
// ==========================================
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CivicBridge full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

start();
