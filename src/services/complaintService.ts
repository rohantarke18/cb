import {
  Problem,
  ProblemStatus,
  PriorityLevel,
  ProblemCategory,
  ImpactScope,
  ResolutionEvidence,
  CitizenVerification,
  EvidenceItem,
  AiAssessment,
  TimelineEvent,
} from '../types';
import { db, auth, cleanFirestoreData } from '../lib/firebase';
import { INITIAL_SEED_PROBLEMS } from '../data/seedProblems';
import { MUNICIPAL_OFFICERS } from '../data/officers';
import { auditLogService } from './auditLogService';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  where,
} from 'firebase/firestore';

const PROBLEMS_COLLECTION = 'problems';
const PUBLIC_PROBLEMS_COLLECTION = 'public_problems';
const LOCAL_STORAGE_KEY = 'civicbridge_problems_cache_v2';

function getLocalStoredProblems(): Problem[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(normalizeProblem);
      }
    }
  } catch (e) {
    console.warn('Local problems parse error:', e);
  }
  return INITIAL_SEED_PROBLEMS.map(normalizeProblem);
}

function saveLocalProblems(list: Problem[]) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('Local storage save error:', e);
  }
}

export interface ComplaintFilter {
  category?: ProblemCategory | 'All';
  status?: ProblemStatus | 'All';
  priority?: PriorityLevel | 'All';
  ward?: string | 'All';
  searchTerm?: string;
  department?: string | 'All';
  reporterUid?: string;
  assignedOfficerId?: string;
}

export function normalizeProblem(raw: any): Problem {
  if (!raw) return raw;
  return {
    ...raw,
    location: {
      address: raw.location?.address || 'Chhatrapati Sambhajinagar',
      landmark: raw.location?.landmark || '',
      ward: raw.location?.ward || 'Ward 8 (CIDCO / Kranti Chowk)',
      city: raw.location?.city || 'Chhatrapati Sambhajinagar',
      district: raw.location?.district || 'Chhatrapati Sambhajinagar',
      state: raw.location?.state || 'Maharashtra',
      pincode: raw.location?.pincode || '431001',
      coordinates: raw.location?.coordinates || { lat: 19.8753, lng: 75.3433 },
    },
    evidence: Array.isArray(raw.evidence) ? raw.evidence : [],
    timeline: Array.isArray(raw.timeline) ? raw.timeline : [],
    internalNotes: Array.isArray(raw.internalNotes) ? raw.internalNotes : [],
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    resolutionEvidence: raw.resolutionEvidence
      ? {
          ...raw.resolutionEvidence,
          media: Array.isArray(raw.resolutionEvidence.media) ? raw.resolutionEvidence.media : [],
        }
      : undefined,
    aiAssessment: raw.aiAssessment || {
      category: raw.category || 'Roads & Infrastructure',
      suggestedDepartment: raw.department || 'Municipal Road Maintenance & Civil Infrastructure',
      suggestedPriority: raw.priority || 'Medium',
      priorityScore: 70,
      reasoning: [],
      keyIdentifiedEntities: [],
      isPreliminary: true,
      generatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Sanitizes a private problem into a safe public transparency record.
 * Strips out citizen phone, email, private documents, and internal notes.
 */
export function sanitizeForPublic(p: Problem): any {
  return {
    id: p.id,
    title: p.title,
    description: p.description,
    category: p.category,
    department: p.department,
    location: {
      address: p.location.address,
      ward: p.location.ward,
      city: p.location.city,
      district: p.location.district,
      coordinates: p.location.coordinates,
    },
    priority: p.priority,
    status: p.status,
    deadline: p.deadline,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    resolutionEvidence: p.resolutionEvidence
      ? {
          id: p.resolutionEvidence.id,
          submittedAt: p.resolutionEvidence.submittedAt,
          submittedBy: p.resolutionEvidence.submittedBy,
          officerDesignation: p.resolutionEvidence.officerDesignation,
          notes: p.resolutionEvidence.notes,
          completionDate: p.resolutionEvidence.completionDate,
          media: p.resolutionEvidence.media || [],
        }
      : undefined,
    timeline: (p.timeline || []).map((t) => ({
      id: t.id,
      step: t.step || '1',
      title: t.title || t.status,
      timestamp: t.timestamp,
      status: t.status,
      actorRole: t.actorRole,
      department: t.department,
      notes: t.notes,
    })),
  };
}

export const complaintService = {
  /**
   * Fetch complaints from Cloud Firestore with role-aware query and local fallback
   */
  async getComplaints(filter?: ComplaintFilter): Promise<Problem[]> {
    let list: Problem[] = [];

    try {
      const colRef = collection(db, PROBLEMS_COLLECTION);
      let q = query(colRef, orderBy('createdAt', 'desc'));

      if (filter?.reporterUid) {
        q = query(colRef, where('reporterUid', '==', filter.reporterUid), orderBy('createdAt', 'desc'));
      }

      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        list = snapshot.docs.map((docSnap) => normalizeProblem(docSnap.data()));
        saveLocalProblems(list);
      } else {
        list = getLocalStoredProblems();
      }
    } catch (err) {
      console.warn('Using local problems repository fallback:', err);
      list = getLocalStoredProblems();
    }

    if (filter) {
      if (filter.reporterUid) {
        list = list.filter((p) => p.reporterUid === filter.reporterUid);
      }
      if (filter.category && filter.category !== 'All') {
        list = list.filter((p) => p.category === filter.category);
      }
      if (filter.status && filter.status !== 'All') {
        list = list.filter((p) => p.status === filter.status);
      }
      if (filter.priority && filter.priority !== 'All') {
        list = list.filter((p) => p.priority === filter.priority);
      }
      if (filter.ward && filter.ward !== 'All') {
        list = list.filter((p) => p.location?.ward === filter.ward);
      }
      if (filter.department && filter.department !== 'All') {
        list = list.filter((p) => p.department === filter.department);
      }
      if (filter.assignedOfficerId) {
        list = list.filter((p) => p.assignedOfficer?.id === filter.assignedOfficerId);
      }
      if (filter.searchTerm && filter.searchTerm.trim()) {
        const s = filter.searchTerm.toLowerCase();
        list = list.filter(
          (p) =>
            (p.title || '').toLowerCase().includes(s) ||
            (p.description || '').toLowerCase().includes(s) ||
            (p.id || '').toLowerCase().includes(s) ||
            (p.assignedOfficer?.name || '').toLowerCase().includes(s) ||
            (p.location?.address || '').toLowerCase().includes(s) ||
            (p.location?.ward || '').toLowerCase().includes(s)
        );
      }
    }

    return list;
  },

  /**
   * Fetch sanitized public complaints for transparency dashboard without revealing citizen PII
   */
  async getPublicComplaints(limitCount = 50): Promise<Problem[]> {
    try {
      const colRef = collection(db, PUBLIC_PROBLEMS_COLLECTION);
      const q = query(colRef, orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs.map((d) => normalizeProblem(d.data()));
      }
    } catch (err) {
      console.warn('Public complaints query notice:', err);
    }
    // Fallback to sanitized local complaints
    const local = getLocalStoredProblems();
    return local.map(sanitizeForPublic).map(normalizeProblem);
  },

  /**
   * Fetch single complaint by ID with public fallback for unauthenticated tracking
   */
  async getComplaintById(id: string): Promise<Problem | null> {
    const cleanId = id.trim();
    try {
      const docRef = doc(db, PROBLEMS_COLLECTION, cleanId);
      const snap = await getDoc(docRef);

      if (snap.exists()) {
        return normalizeProblem(snap.data());
      }
    } catch (err) {
      // If permission denied or not authorized for private complaint, try public transparency record
      try {
        const pubRef = doc(db, PUBLIC_PROBLEMS_COLLECTION, cleanId);
        const pubSnap = await getDoc(pubRef);
        if (pubSnap.exists()) {
          return normalizeProblem(pubSnap.data());
        }
      } catch (pubErr) {
        console.warn('Public record lookup notice:', pubErr);
      }
    }

    const localList = getLocalStoredProblems();
    const match = localList.find((p) => p.id.toLowerCase() === cleanId.toLowerCase());
    return match ? normalizeProblem(match) : null;
  },

  /**
   * Submit/create complaint alias
   */
  async submitComplaint(data: any): Promise<Problem> {
    return this.createComplaint(data);
  },

  /**
   * Create a new complaint in Cloud Firestore.
   * Requires authenticated user. Maintains sanitized public mirror for tracking.
   */
  async createComplaint(data: {
    title: string;
    description: string;
    category: ProblemCategory;
    department?: string;
    location: {
      address: string;
      landmark?: string;
      ward: string;
      city: string;
      district: string;
      state: string;
      pincode: string;
      coordinates?: { lat: number; lng: number };
    };
    impactScope: ImpactScope;
    urgency: PriorityLevel;
    evidence: EvidenceItem[];
    citizenName: string;
    citizenPhone: string;
    reporterUid?: string;
    reporterEmail?: string;
  }): Promise<Problem> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Please sign in to lodge an official grievance with the municipal corporation.');
    }

    const year = new Date().getFullYear();
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    const generatedId = `CIV-${year}-${randomDigits}`;

    // Perform real AI assessment via server-side Gemini route with fallback
    const aiAssessment = await this.fetchAiAssessment(
      data.title,
      data.description,
      data.category,
      data.impactScope,
      data.urgency,
      data.location?.ward
    );

    const now = new Date().toISOString();
    const deadlineHours =
      aiAssessment.suggestedPriority === 'Critical'
        ? 24
        : aiAssessment.suggestedPriority === 'High'
        ? 48
        : aiAssessment.suggestedPriority === 'Medium'
        ? 96
        : 168;

    const deadlineDate = new Date(Date.now() + deadlineHours * 60 * 60 * 1000);

    const initialTimeline: TimelineEvent[] = [
      {
        id: `tl-${Date.now()}-1`,
        step: '1',
        title: 'Grievance Lodged',
        timestamp: now,
        status: 'Submitted',
        actorName: data.citizenName || currentUser.displayName || 'Citizen Submitter',
        actorRole: 'Citizen',
        notes: `Grievance lodged via CivicBridge citizen portal. Target SLA deadline: ${deadlineHours} hours.`,
      },
      {
        id: `tl-${Date.now()}-2`,
        step: '2',
        title: 'AI Classification & Triage',
        timestamp: new Date(Date.now() + 2000).toISOString(),
        status: 'Under Review',
        department: aiAssessment.suggestedDepartment,
        actorName: 'CivicBridge Automated Dispatcher',
        actorRole: 'AI Triage Engine',
        notes: `Assigned Priority Score: ${aiAssessment.priorityScore}/100 (${aiAssessment.suggestedPriority}). Routed to ${aiAssessment.suggestedDepartment}.`,
      },
    ];

    const maskedPhone =
      data.citizenPhone && data.citizenPhone.length > 5
        ? data.citizenPhone.slice(0, 3) + ' **** ' + data.citizenPhone.slice(-2)
        : '+91 98200 ****0';

    const newProblem: Problem = {
      id: generatedId,
      title: data.title,
      description: data.description,
      category: data.category,
      department: data.department || aiAssessment.suggestedDepartment,
      location: data.location,
      impactScope: data.impactScope,
      urgency: data.urgency,
      priority: aiAssessment.suggestedPriority,
      status: 'Under Review',
      evidence: data.evidence || [],
      internalNotes: [],
      tags: [],
      aiAssessment,
      timeline: initialTimeline,
      deadline: deadlineDate.toISOString(),
      createdAt: now,
      updatedAt: now,
      citizenName: data.citizenName || currentUser.displayName || 'Citizen',
      citizenPhone: data.citizenPhone,
      citizenPhoneMasked: maskedPhone,
      reporterUid: currentUser.uid,
      reporterEmail: data.reporterEmail || currentUser.email || '',
    };

    // Save full record to private collection
    const docRef = doc(db, PROBLEMS_COLLECTION, generatedId);
    await setDoc(docRef, cleanFirestoreData(newProblem));

    // Save sanitized record to public collection for unauthenticated tracking
    try {
      const pubDocRef = doc(db, PUBLIC_PROBLEMS_COLLECTION, generatedId);
      await setDoc(pubDocRef, cleanFirestoreData(sanitizeForPublic(newProblem)));
    } catch (pubErr) {
      console.warn('Public record sync note:', pubErr);
    }

    const currentList = getLocalStoredProblems();
    saveLocalProblems([newProblem, ...currentList.filter((p) => p.id !== generatedId)]);

    return normalizeProblem(newProblem);
  },

  /**
   * Update problem details in Firestore
   */
  async updateComplaint(id: string, updates: Partial<Problem>): Promise<Problem> {
    const docRef = doc(db, PROBLEMS_COLLECTION, id);
    const existing = await this.getComplaintById(id);
    if (!existing) {
      throw new Error(`Complaint ${id} not found`);
    }

    const merged: Problem = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await updateDoc(docRef, cleanFirestoreData({
      ...updates,
      updatedAt: merged.updatedAt,
    }));

    // Keep public mirror updated
    try {
      const pubDocRef = doc(db, PUBLIC_PROBLEMS_COLLECTION, id);
      await setDoc(pubDocRef, cleanFirestoreData(sanitizeForPublic(merged)), { merge: true });
    } catch (pubErr) {
      console.warn('Public mirror update note:', pubErr);
    }

    const currentList = getLocalStoredProblems();
    saveLocalProblems(currentList.map((p) => (p.id === id ? merged : p)));

    return merged;
  },

  /**
   * Update administrative or workflow status
   */
  async updateStatus(
    id: string,
    newStatus: ProblemStatus,
    notes?: string,
    actorName?: string,
    actorRole?: string
  ): Promise<Problem> {
    const existing = await this.getComplaintById(id);
    if (!existing) throw new Error(`Complaint ${id} not found`);

    const timelineEvent: TimelineEvent = {
      id: `tl-${Date.now()}`,
      step: `${existing.timeline.length + 1}`,
      title: `Status: ${newStatus}`,
      timestamp: new Date().toISOString(),
      status: newStatus,
      actorName: actorName || auth.currentUser?.displayName || 'Municipal Authority',
      actorRole: actorRole || 'Official',
      notes: notes || `Case status updated to ${newStatus}.`,
    };

    const updated = await this.updateComplaint(id, {
      status: newStatus,
      timeline: [...existing.timeline, timelineEvent],
    });

    auditLogService.logAction(
      'STATUS_CHANGED',
      'problem',
      id,
      `Status changed to "${newStatus}". Notes: ${notes || 'Status updated.'}`,
      {
        uid: auth.currentUser?.uid || 'official',
        name: actorName || auth.currentUser?.displayName || 'Municipal Authority',
        role: actorRole || 'Official',
      }
    ).catch(() => {});

    return updated;
  },

  /**
   * Assign complaint to municipal officer
   */
  async assignOfficer(
    problemId: string,
    officer: string | { id: string; name: string; designation: string; department: string },
    deadline?: string,
    assignedBy?: string,
    notes?: string
  ): Promise<Problem> {
    let officerObj: { id: string; name: string; designation: string; department: string };

    if (typeof officer === 'string') {
      const found = MUNICIPAL_OFFICERS.find((o) => o.id === officer || o.name === officer);
      officerObj = found
        ? {
            id: found.id,
            name: found.name,
            designation: found.designation,
            department: found.department,
          }
        : {
            id: officer,
            name: 'Municipal Field Engineer',
            designation: 'Junior Engineer',
            department: 'Engineering Services',
          };
    } else {
      officerObj = officer;
    }

    const problem = await this.getComplaintById(problemId);
    if (!problem) throw new Error('Problem not found');

    const timelineEvent: TimelineEvent = {
      id: `tl-${Date.now()}`,
      step: `${problem.timeline.length + 1}`,
      title: 'Field Officer Assigned',
      timestamp: new Date().toISOString(),
      status: 'In Progress',
      actorName: assignedBy || auth.currentUser?.displayName || 'Department Supervisor',
      actorRole: 'Supervisor',
      notes: notes || `Case assigned to ${officerObj.name} (${officerObj.designation}) for ground remediation.`,
    };

    const updates: Partial<Problem> = {
      assignedOfficer: officerObj,
      status: 'In Progress',
      timeline: [...problem.timeline, timelineEvent],
    };
    if (deadline) {
      updates.deadline = deadline;
    }

    const updated = await this.updateComplaint(problemId, updates);

    auditLogService.logAction(
      'OFFICER_ASSIGNED',
      'problem',
      problemId,
      `Case assigned to ${officerObj.name} (${officerObj.designation}). Deadline: ${deadline || 'Default SLA'}`,
      {
        uid: auth.currentUser?.uid || 'supervisor',
        name: assignedBy || auth.currentUser?.displayName || 'Department Supervisor',
        role: 'supervisor',
      }
    ).catch(() => {});

    return updated;
  },

  /**
   * Submit Resolution Proof by Field Officer
   */
  async submitResolution(
    problemId: string,
    resolution: ResolutionEvidence | any,
    officerName?: string
  ): Promise<Problem> {
    const problem = await this.getComplaintById(problemId);
    if (!problem) throw new Error('Problem not found');

    const resolutionEvidence: ResolutionEvidence = {
      id: resolution.id || `res-${Date.now()}`,
      submittedAt: resolution.submittedAt || new Date().toISOString(),
      submittedBy: resolution.submittedBy || officerName || auth.currentUser?.displayName || 'Field Officer',
      officerDesignation: resolution.officerDesignation || 'Field Executive Engineer',
      notes: resolution.notes || resolution.summaryOfWorkDone || 'Remediation completed.',
      media: resolution.media || [],
      workOrderRef: resolution.workOrderRef,
      completionDate: resolution.completionDate || new Date().toISOString().slice(0, 10),
    };

    const timelineEvent: TimelineEvent = {
      id: `tl-${Date.now()}`,
      step: `${problem.timeline.length + 1}`,
      title: 'Resolution Evidence Submitted',
      timestamp: new Date().toISOString(),
      status: 'Citizen Verification',
      actorName: resolutionEvidence.submittedBy,
      actorRole: 'Field Executive Engineer',
      notes: `Resolution work completed. Photographic ground proof submitted: ${resolutionEvidence.notes}`,
    };

    const updated = await this.updateComplaint(problemId, {
      status: 'Citizen Verification',
      resolutionEvidence,
      timeline: [...problem.timeline, timelineEvent],
    });

    auditLogService.logAction(
      'RESOLUTION_SUBMITTED',
      'problem',
      problemId,
      `Remediation proof submitted by ${resolutionEvidence.submittedBy}. Work order: ${resolutionEvidence.workOrderRef || 'N/A'}`
    ).catch(() => {});

    return updated;
  },

  /**
   * Alias for submitResolution
   */
  async submitResolutionProof(
    problemId: string,
    resolution: any,
    officerName?: string
  ): Promise<Problem> {
    return this.submitResolution(problemId, resolution, officerName);
  },

  /**
   * Citizen Resolution Verification or Dispute
   */
  async verifyResolution(
    problemId: string,
    verification: {
      status: 'verified' | 'disputed';
      feedbackNotes?: string;
      disputeReason?: string;
      satisfactionRating?: number;
    },
    citizenName?: string
  ): Promise<Problem> {
    const problem = await this.getComplaintById(problemId);
    if (!problem) throw new Error('Problem not found');

    const isAccepted = verification.status === 'verified';
    const citizenVerification: CitizenVerification = {
      status: verification.status,
      verifiedAt: new Date().toISOString(),
      feedbackNotes: verification.feedbackNotes,
      disputeReason: verification.disputeReason,
      satisfactionRating: verification.satisfactionRating || (isAccepted ? 5 : 2),
    };

    const newStatus: ProblemStatus = isAccepted ? 'Resolved' : 'Reopened';

    const timelineEvent: TimelineEvent = {
      id: `tl-${Date.now()}`,
      step: `${problem.timeline.length + 1}`,
      title: isAccepted ? 'Citizen Verified Resolution' : 'Resolution Disputed by Citizen',
      timestamp: new Date().toISOString(),
      status: newStatus,
      actorName: citizenName || auth.currentUser?.displayName || 'Citizen Submitter',
      actorRole: 'Citizen Submitter',
      notes: isAccepted
        ? `Citizen confirmed satisfactory remediation. Rating: ${citizenVerification.satisfactionRating}/5.`
        : `Citizen disputed the resolution. Reason: ${verification.disputeReason || 'Unsatisfactory work'}. Case reopened.`,
    };

    const updated = await this.updateComplaint(problemId, {
      status: newStatus,
      citizenVerification,
      timeline: [...problem.timeline, timelineEvent],
    });

    auditLogService.logAction(
      isAccepted ? 'CASE_RESOLVED' : 'CASE_REOPENED',
      'problem',
      problemId,
      isAccepted
        ? `Resolution verified by citizen. Rating: ${citizenVerification.satisfactionRating}/5.`
        : `Resolution disputed: "${verification.disputeReason || 'Unsatisfactory work'}". Case reopened.`
    ).catch(() => {});

    return updated;
  },

  /**
   * Alias for verifyResolution
   */
  async submitCitizenVerification(
    problemId: string,
    verification: any,
    citizenName?: string
  ): Promise<Problem> {
    const isAccepted = verification.isAccepted ?? verification.status === 'verified';
    return this.verifyResolution(
      problemId,
      {
        status: isAccepted ? 'verified' : 'disputed',
        feedbackNotes: verification.feedback || verification.feedbackNotes,
        disputeReason: verification.disputeReason,
        satisfactionRating: verification.rating || verification.satisfactionRating,
      },
      citizenName
    );
  },

  /**
   * Add internal municipal supervisory note
   */
  async addInternalNote(
    problemId: string,
    authorOrNote: string,
    designationOrRole?: string,
    noteText?: string
  ): Promise<Problem> {
    const problem = await this.getComplaintById(problemId);
    if (!problem) throw new Error('Problem not found');

    const author = noteText !== undefined ? authorOrNote : auth.currentUser?.displayName || 'Authorized Officer';
    const note = noteText !== undefined ? noteText : authorOrNote;

    const newNote = {
      id: `note-${Date.now()}`,
      author,
      note,
      timestamp: new Date().toISOString(),
    };

    return this.updateComplaint(problemId, {
      internalNotes: [...(problem.internalNotes || []), newNote],
    });
  },

  /**
   * Add milestone timeline event
   */
  async addTimelineEvent(
    problemId: string,
    event: {
      status: ProblemStatus;
      actorName?: string;
      actorRole?: string;
      notes?: string;
      department?: string;
      step?: string;
      title?: string;
    }
  ): Promise<Problem> {
    const problem = await this.getComplaintById(problemId);
    if (!problem) throw new Error('Problem not found');

    const timelineEvent: TimelineEvent = {
      id: `tl-${Date.now()}`,
      step: event.step || `${problem.timeline.length + 1}`,
      title: event.title || event.status,
      timestamp: new Date().toISOString(),
      status: event.status,
      actorName: event.actorName || auth.currentUser?.displayName || 'Authority',
      actorRole: event.actorRole || 'Official',
      department: event.department || problem.department,
      notes: event.notes,
    };

    return this.updateComplaint(problemId, {
      timeline: [...problem.timeline, timelineEvent],
    });
  },

  /**
   * Delete a complaint
   */
  async deleteComplaint(id: string): Promise<void> {
    const docRef = doc(db, PROBLEMS_COLLECTION, id);
    await deleteDoc(docRef);

    try {
      const pubDocRef = doc(db, PUBLIC_PROBLEMS_COLLECTION, id);
      await deleteDoc(pubDocRef);
    } catch (pubErr) {
      console.warn('Public mirror delete note:', pubErr);
    }

    const currentList = getLocalStoredProblems();
    saveLocalProblems(currentList.filter((p) => p.id !== id));
  },

  /**
   * Asynchronous AI assessment calling the full-stack Gemini API route with deterministic fallback
   */
  async fetchAiAssessment(
    title: string,
    description: string,
    category: ProblemCategory,
    impactScope: ImpactScope,
    urgency: PriorityLevel,
    ward?: string
  ): Promise<AiAssessment> {
    const fallback = this.generateAiAssessment(title, description, category, impactScope, urgency);
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      const token = await auth.currentUser?.getIdToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch('/api/ai/classify', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title,
          description,
          category,
          ward,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          return {
            ...fallback,
            category: (json.data.category as ProblemCategory) || fallback.category,
            suggestedDepartment: json.data.suggestedDepartment || fallback.suggestedDepartment,
            suggestedPriority: json.data.suggestedPriority || fallback.suggestedPriority,
            priorityScore: json.data.priorityScore ?? fallback.priorityScore,
            reasoning: json.data.reasoning?.length ? json.data.reasoning : fallback.reasoning,
            keyIdentifiedEntities: json.data.keyIdentifiedEntities?.length ? json.data.keyIdentifiedEntities : fallback.keyIdentifiedEntities,
          };
        }
      }
    } catch (e) {
      console.warn('AI API classify endpoint notice, using deterministic engine:', e);
    }
    return fallback;
  },

  /**
   * Automatic priority score & department routing AI logic
   */
  generateAiAssessment(
    title: string,
    description: string,
    category: ProblemCategory,
    impactScope: ImpactScope,
    urgency: PriorityLevel
  ): AiAssessment {
    const text = (title + ' ' + description).toLowerCase();

    let score = 50;

    // Urgency weight
    if (urgency === 'Critical') score += 28;
    else if (urgency === 'High') score += 18;
    else if (urgency === 'Medium') score += 8;
    else score -= 10;

    // Impact scope weight
    if (impactScope === 'Multiple areas') score += 18;
    else if (impactScope === 'Large community') score += 12;
    else if (impactScope === 'My neighbourhood') score += 6;

    // Keyword severity bonuses
    if (text.includes('danger') || text.includes('hazard') || text.includes('fire') || text.includes('electric') || text.includes('flood') || text.includes('accident') || text.includes('leakage')) {
      score += 15;
    }
    if (text.includes('school') || text.includes('hospital') || text.includes('clinic') || text.includes('pedestrian')) {
      score += 10;
    }

    score = Math.min(Math.max(score, 15), 98);

    let priority: PriorityLevel = 'Medium';
    if (score >= 80) priority = 'Critical';
    else if (score >= 65) priority = 'High';
    else if (score >= 40) priority = 'Medium';
    else priority = 'Low';

    const departmentMap: Record<ProblemCategory, string> = {
      'Roads & Infrastructure': 'Municipal Road Maintenance & Civil Infrastructure',
      'Water & Drainage': 'Water Supply & Sewerage Management Board',
      'Sanitation & Solid Waste': 'Sanitation & Solid Waste Management Department',
      'Public Transport & Traffic': 'City Transport & Traffic Governance Cell',
      'Education & Facilities': 'Municipal Education & Public Schools Cell',
      'Healthcare & Sanitation': 'Public Health & Sanitation Directorate',
      'Public Safety & Streetlighting': 'Electrical Infrastructure & Streetlighting Wing',
      'Environment & Green Spaces': 'Urban Forestry & Gardens Directorate',
      'Civic & Revenue Services': 'Revenue, Property Tax & Licensing Department',
      'Other Civic Issues': 'Central Municipal Grievance Redressal Cell',
    };

    return {
      category,
      suggestedDepartment: departmentMap[category] || 'Central Municipal Grievance Redressal Cell',
      suggestedPriority: priority,
      priorityScore: score,
      reasoning: [
        `Base urgency level evaluated as ${urgency} with ${impactScope} impact range.`,
        `Automated municipal routing dispatched to ${departmentMap[category] || 'Central Redressal Cell'}.`,
      ],
      keyIdentifiedEntities: [category, urgency],
      isPreliminary: true,
      generatedAt: new Date().toISOString(),
    };
  },
};
