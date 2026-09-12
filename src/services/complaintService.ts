import {
  Problem,
  ProblemStatus,
  PriorityLevel,
  ProblemCategory,
  ResolutionEvidence,
  CitizenVerification,
  EvidenceItem,
  AiAssessment,
  TimelineEvent,
} from '../types';
import { db, auth, signInCitizenQuick, cleanFirestoreData } from '../lib/firebase';
import { INITIAL_SEED_PROBLEMS } from '../data/seedProblems';
import { MUNICIPAL_OFFICERS } from '../data/officers';
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
} from 'firebase/firestore';

const PROBLEMS_COLLECTION = 'problems';
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

export const complaintService = {
  /**
   * Fetch all complaints from Cloud Firestore with local cache fallback
   */
  async getComplaints(filter?: ComplaintFilter): Promise<Problem[]> {
    let list: Problem[] = [];

    try {
      const colRef = collection(db, PROBLEMS_COLLECTION);
      const q = query(colRef, orderBy('createdAt', 'desc'));
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
   * Fetch single complaint by ID
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
      console.warn(`Error fetching complaint ${id} from Firestore, checking local cache:`, err);
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
   * Create a new complaint in Cloud Firestore
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
    impactScope: Problem['impactScope'];
    urgency: PriorityLevel;
    evidence: EvidenceItem[];
    citizenName: string;
    citizenPhone: string;
    reporterUid?: string;
    reporterEmail?: string;
  }): Promise<Problem> {
    const year = new Date().getFullYear();
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    const generatedId = `CIV-${year}-${randomDigits}`;

    // Perform real AI assessment
    const aiAssessment = this.generateAiAssessment(
      data.title,
      data.description,
      data.category,
      data.impactScope,
      data.urgency
    );

    // Default SLA deadline (e.g. 3 to 7 days from now depending on priority)
    const daysToAdd =
      aiAssessment.suggestedPriority === 'Critical'
        ? 2
        : aiAssessment.suggestedPriority === 'High'
        ? 4
        : 7;
    const deadlineDate = new Date();
    deadlineDate.setDate(deadlineDate.getDate() + daysToAdd);

    const now = new Date().toISOString();

    const initialTimeline: TimelineEvent[] = [
      {
        id: `t-${Date.now()}-1`,
        step: '01',
        title: 'Problem Reported with Verified Evidence',
        timestamp: now,
        status: 'Submitted',
        actorName: data.citizenName || 'Citizen',
        actorRole: 'Citizen Submitter',
        notes: `Grievance registered under ${data.category}. Digital tracking docket activated with automated priority scoring.`,
      },
      {
        id: `t-${Date.now()}-2`,
        step: '02',
        title: 'AI Preliminary Triage & Priority Scoring',
        timestamp: new Date(Date.now() + 1000).toISOString(),
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

    // Ensure session uid if citizen is reporting anonymously
    let effectiveUid = data.reporterUid || auth.currentUser?.uid;
    if (!effectiveUid) {
      try {
        const anonUser = await signInCitizenQuick(data.citizenName || 'Citizen Submitter');
        effectiveUid = anonUser.uid;
      } catch (authErr) {
        console.warn('Quick citizen auth note:', authErr);
      }
    }

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
      citizenName: data.citizenName || 'Citizen',
      citizenPhoneMasked: maskedPhone,
      reporterUid: effectiveUid || 'citizen_guest',
      reporterEmail: data.reporterEmail || auth.currentUser?.email || '',
    };

    const docRef = doc(db, PROBLEMS_COLLECTION, generatedId);
    try {
      await setDoc(docRef, cleanFirestoreData(newProblem));
    } catch (e) {
      console.warn('Firestore setDoc notice, saved to local cache:', e);
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

    try {
      await updateDoc(docRef, cleanFirestoreData({
        ...updates,
        updatedAt: merged.updatedAt,
      }));
    } catch (e) {
      console.warn('Firestore updateDoc notice, updating local cache:', e);
    }

    const currentList = getLocalStoredProblems();
    const updatedList = currentList.map((p) => (p.id === id ? merged : p));
    saveLocalProblems(updatedList);

    return merged;
  },

  /**
   * Delete complaint from Firestore (User requirement: records must be editable, like deleting)
   */
  async deleteComplaint(id: string): Promise<void> {
    const docRef = doc(db, PROBLEMS_COLLECTION, id);
    try {
      await deleteDoc(docRef);
    } catch (e) {
      console.warn('Firestore deleteDoc notice, removing from local cache:', e);
    }

    const currentList = getLocalStoredProblems();
    saveLocalProblems(currentList.filter((p) => p.id !== id));
  },

  /**
   * Assign an official officer and set target SLA resolution deadline
   */
  async assignOfficer(
    problemId: string,
    officer: { id: string; name: string; designation: string; department: string },
    deadline: string
  ): Promise<Problem> {
    const problem = await this.getComplaintById(problemId);
    if (!problem) throw new Error('Case not found');

    const timelineEvent: TimelineEvent = {
      id: `t-${Date.now()}`,
      step: '03',
      title: 'Field Officer Assigned & SLA Target Fixed',
      timestamp: new Date().toISOString(),
      status: 'In Progress',
      department: officer.department,
      actorName: officer.name,
      actorRole: officer.designation,
      notes: `Assigned to ${officer.name} (${officer.designation}). Resolution committed by ${new Date(
        deadline
      ).toLocaleDateString()}.`,
    };

    return this.updateComplaint(problemId, {
      assignedOfficer: officer,
      deadline,
      status: 'In Progress',
      timeline: [...problem.timeline, timelineEvent],
    });
  },

  /**
   * Upload and submit resolution evidence by Department/Officer
   */
  async submitResolution(
    problemId: string,
    evidence: {
      submittedBy: string;
      officerDesignation: string;
      notes: string;
      media: EvidenceItem[];
      workOrderRef?: string;
      completionDate: string;
    }
  ): Promise<Problem> {
    const problem = await this.getComplaintById(problemId);
    if (!problem) throw new Error('Case not found');

    const resolution: ResolutionEvidence = {
      id: `res-${Date.now()}`,
      submittedAt: new Date().toISOString(),
      submittedBy: evidence.submittedBy,
      officerDesignation: evidence.officerDesignation,
      notes: evidence.notes,
      media: evidence.media,
      workOrderRef: evidence.workOrderRef || `WO-${Date.now().toString().slice(-6)}`,
      completionDate: evidence.completionDate || new Date().toISOString().slice(0, 10),
    };

    const timelineEvent: TimelineEvent = {
      id: `t-${Date.now()}`,
      step: '04',
      title: 'Municipal Resolution Evidence Submitted',
      timestamp: new Date().toISOString(),
      status: 'Citizen Verification',
      department: problem.department,
      actorName: evidence.submittedBy,
      actorRole: evidence.officerDesignation,
      notes: `Field work reported complete with ${evidence.media.length} visual evidence items attached. Locked awaiting citizen verification.`,
    };

    return this.updateComplaint(problemId, {
      resolutionEvidence: resolution,
      status: 'Citizen Verification',
      timeline: [...problem.timeline, timelineEvent],
    });
  },

  /**
   * Citizen verifies or disputes the resolution
   */
  async submitCitizenVerification(
    problemId: string,
    verification: {
      status: 'verified' | 'disputed';
      feedbackNotes?: string;
      disputeReason?: string;
      satisfactionRating?: number;
    }
  ): Promise<Problem> {
    const problem = await this.getComplaintById(problemId);
    if (!problem) throw new Error('Case not found');

    const record: CitizenVerification = {
      status: verification.status,
      verifiedAt: new Date().toISOString(),
      feedbackNotes: verification.feedbackNotes,
      disputeReason: verification.disputeReason,
      satisfactionRating: verification.satisfactionRating,
    };

    const isApproved = verification.status === 'verified';
    const nextStatus: ProblemStatus = isApproved ? 'Resolved' : 'In Progress';

    const timelineEvent: TimelineEvent = {
      id: `t-${Date.now()}`,
      step: '05',
      title: isApproved ? 'Citizen Verified & Docket Closed' : 'Citizen Disputed Resolution',
      timestamp: new Date().toISOString(),
      status: nextStatus,
      actorName: problem.citizenName,
      actorRole: 'Reporting Citizen',
      notes: isApproved
        ? `Citizen audited resolution photos and approved closure (Rating: ${verification.satisfactionRating || 5}/5).`
        : `Citizen raised an objection: "${verification.disputeReason || 'Work unsatisfactory'}". Case reopened for re-inspection.`,
    };

    return this.updateComplaint(problemId, {
      citizenVerification: record,
      status: nextStatus,
      timeline: [...problem.timeline, timelineEvent],
    });
  },

  /**
   * Reopen a problem
   */
  async reopenComplaint(problemId: string, reason: string): Promise<Problem> {
    const problem = await this.getComplaintById(problemId);
    if (!problem) throw new Error('Case not found');

    const timelineEvent: TimelineEvent = {
      id: `t-${Date.now()}`,
      step: 'Reopen',
      title: 'Docket Reopened for Administrative Review',
      timestamp: new Date().toISOString(),
      status: 'Under Review',
      notes: `Reopened reason: ${reason}`,
    };

    return this.updateComplaint(problemId, {
      status: 'Under Review',
      timeline: [...problem.timeline, timelineEvent],
    });
  },

  /**
   * Citizen verification alias for verifyResolution
   */
  async verifyResolution(
    problemId: string,
    verification: {
      status: 'verified' | 'disputed';
      feedbackNotes?: string;
      disputeReason?: string;
      satisfactionRating?: number;
    }
  ): Promise<Problem> {
    return this.submitCitizenVerification(problemId, verification);
  },

  /**
   * Update problem status with administrative audit trail
   */
  async updateStatus(
    problemId: string,
    newStatus: ProblemStatus,
    note?: string,
    actorName?: string
  ): Promise<Problem> {
    const problem = await this.getComplaintById(problemId);
    if (!problem) throw new Error('Complaint not found');

    const timelineEvent: TimelineEvent = {
      id: `t-${Date.now()}`,
      step: '03',
      title: `Status Transitioned to ${newStatus}`,
      timestamp: new Date().toISOString(),
      status: newStatus,
      department: problem.department,
      actorName: actorName || 'Authorized Officer',
      actorRole: 'Administrative Officer',
      notes: note || `Status transitioned to ${newStatus}.`,
    };

    return this.updateComplaint(problemId, {
      status: newStatus,
      timeline: [...problem.timeline, timelineEvent],
    });
  },

  /**
   * Add internal administrative note to case docket
   */
  async addInternalNote(
    problemId: string,
    author: string,
    role: string,
    noteText: string
  ): Promise<Problem> {
    const problem = await this.getComplaintById(problemId);
    if (!problem) throw new Error('Complaint not found');

    const timelineEvent: TimelineEvent = {
      id: `t-${Date.now()}`,
      step: '02',
      title: 'Internal Administrative Note Appended',
      timestamp: new Date().toISOString(),
      status: problem.status,
      department: problem.department,
      actorName: author,
      actorRole: role,
      notes: noteText,
    };

    return this.updateComplaint(problemId, {
      timeline: [...problem.timeline, timelineEvent],
    });
  },

  /**
   * Automatic priority score & department routing AI logic
   */
  generateAiAssessment(
    title: string,
    description: string,
    category: ProblemCategory,
    impactScope: Problem['impactScope'],
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

    const suggestedDepartment = departmentMap[category] || 'Central Municipal Administration';

    const reasoning = [
      `Computed multi-factor priority rating: ${score}/100 based on citizen-reported impact scope (${impactScope}) and urgency level (${urgency}).`,
      `Automated routing algorithm matched category "${category}" directly to ${suggestedDepartment}.`,
      `Estimated response SLA benchmark: ${priority === 'Critical' ? '48 Hours' : priority === 'High' ? '96 Hours' : '7 Working Days'}.`,
    ];

    const entities: string[] = [];
    if (text.includes('road') || text.includes('street') || text.includes('lane')) entities.push('Road Corridor');
    if (text.includes('pothole')) entities.push('Surface Depression');
    if (text.includes('water') || text.includes('pipe') || text.includes('drain')) entities.push('Hydraulic Line');
    if (text.includes('light') || text.includes('pole')) entities.push('Illumination Asset');
    if (text.includes('garbage') || text.includes('waste')) entities.push('Solid Waste');
    if (entities.length === 0) entities.push('Civic Infrastructure', 'Public Amenity');

    return {
      category,
      suggestedDepartment,
      suggestedPriority: priority,
      priorityScore: score,
      reasoning,
      keyIdentifiedEntities: entities,
      isPreliminary: true,
      generatedAt: new Date().toISOString(),
    };
  },
};
