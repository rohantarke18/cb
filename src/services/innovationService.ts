import {
  Innovation,
  InnovationReview,
  InnovationComment,
  InnovationStage,
  InnovationCategory,
  EvidenceItem,
} from '../types';
import { db, cleanFirestoreData } from '../lib/firebase';
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

const INNOVATIONS_COLLECTION = 'innovations';

export function normalizeInnovation(raw: any): Innovation {
  if (!raw) return raw;
  return {
    ...raw,
    reviews: Array.isArray(raw.reviews) ? raw.reviews : [],
    comments: Array.isArray(raw.comments) ? raw.comments : [],
    voters: Array.isArray(raw.voters) ? raw.voters : [],
    attachments: Array.isArray(raw.attachments) ? raw.attachments : [],
    votes: typeof raw.votes === 'number' ? raw.votes : 0,
    feasibilityScore: typeof raw.feasibilityScore === 'number' ? raw.feasibilityScore : 70,
  };
}

export const innovationService = {
  /**
   * Get all innovations from Firestore
   */
  async getInnovations(): Promise<Innovation[]> {
    try {
      const colRef = collection(db, INNOVATIONS_COLLECTION);
      const q = query(colRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);

      return snapshot.docs.map((d) => normalizeInnovation(d.data()));
    } catch (err) {
      console.error('Error fetching innovations from Firestore:', err);
      return [];
    }
  },

  /**
   * Get single innovation by ID
   */
  async getInnovationById(id: string): Promise<Innovation | null> {
    try {
      const docRef = doc(db, INNOVATIONS_COLLECTION, id.trim());
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return normalizeInnovation(snap.data());
      }
      const all = await this.getInnovations();
      return all.find((item) => item.id.toLowerCase() === id.trim().toLowerCase()) || null;
    } catch (err) {
      console.error(`Error fetching innovation ${id}:`, err);
      return null;
    }
  },

  /**
   * Submit innovation alias
   */
  async submitInnovation(data: any): Promise<Innovation> {
    return this.createInnovation({
      ...data,
      targetWard: data.targetWard || 'Ward 14 (Shivajinagar)',
    });
  },

  /**
   * Create a new citizen innovation submission
   */
  async createInnovation(data: {
    title: string;
    description: string;
    problemAddressed?: string;
    expectedImpact?: string;
    category: InnovationCategory;
    targetWard?: string;
    costEstimate?: string;
    timelineEstimate?: string;
    submitterName: string;
    submitterType: string;
    submitterUid?: string;
    submitterEmail?: string;
    attachments?: EvidenceItem[];
  }): Promise<Innovation> {
    const year = new Date().getFullYear();
    const randomDigits = Math.floor(100 + Math.random() * 900);
    const generatedId = `INV-${year}-${randomDigits}`;

    // Calculate initial feasibility score dynamically
    const descLen = (data.description + ' ' + (data.problemAddressed || '')).length;
    const baseScore = Math.min(Math.max(Math.floor(descLen / 15) + 60, 65), 94);

    const now = new Date().toISOString();

    const newInnovation: Innovation = {
      id: generatedId,
      title: data.title,
      description: data.description,
      problemAddressed: data.problemAddressed,
      expectedImpact: data.expectedImpact,
      category: data.category,
      stage: 'Proposed',
      submitterName: data.submitterName || 'Citizen Innovator',
      submitterType: data.submitterType || 'Citizen',
      submitterUid: data.submitterUid,
      submitterEmail: data.submitterEmail,
      targetWard: data.targetWard || 'Ward 14 (Shivajinagar)',
      costEstimate: data.costEstimate || 'To be assessed',
      timelineEstimate: data.timelineEstimate || '3-6 months',
      feasibilityScore: baseScore,
      votes: 1, // Submitter initial vote
      voters: data.submitterUid ? [data.submitterUid] : [],
      reviews: [],
      comments: [],
      attachments: data.attachments || [],
      createdAt: now,
    };

    const docRef = doc(db, INNOVATIONS_COLLECTION, generatedId);
    await setDoc(docRef, cleanFirestoreData(newInnovation));

    return newInnovation;
  },

  /**
   * Update innovation details
   */
  async updateInnovation(id: string, updates: Partial<Innovation>): Promise<Innovation> {
    const docRef = doc(db, INNOVATIONS_COLLECTION, id);
    const existing = await this.getInnovationById(id);
    if (!existing) throw new Error('Innovation not found');

    const merged: Innovation = {
      ...existing,
      ...updates,
    };

    await updateDoc(docRef, cleanFirestoreData(updates));
    return merged;
  },

  /**
   * Delete innovation (Editable & Deletable)
   */
  async deleteInnovation(id: string): Promise<void> {
    const docRef = doc(db, INNOVATIONS_COLLECTION, id);
    await deleteDoc(docRef);
  },

  /**
   * Upvote innovation (returns updated Innovation)
   */
  async upvoteInnovation(id: string, voterId?: string): Promise<Innovation> {
    const existing = await this.getInnovationById(id);
    if (!existing) throw new Error('Innovation not found');

    const voter = voterId || 'anon-voter';
    const voters = existing.voters || [];
    const alreadyVoted = voters.includes(voter);

    const updatedVoters = alreadyVoted
      ? voters.filter((v) => v !== voter)
      : [...voters, voter];

    const updatedVotes = Math.max(0, existing.votes + (alreadyVoted ? -1 : 1));

    return this.updateInnovation(id, {
      votes: updatedVotes,
      voters: updatedVoters,
      hasVoted: !alreadyVoted,
    });
  },

  /**
   * Upvote / toggle vote
   */
  async voteInnovation(id: string, voterId?: string): Promise<{ votes: number; hasVoted: boolean }> {
    const updated = await this.upvoteInnovation(id, voterId);
    return {
      votes: updated.votes,
      hasVoted: updated.hasVoted ?? false,
    };
  },

  /**
   * Add community or expert comment
   */
  async addComment(id: string, comment: any): Promise<Innovation> {
    const existing = await this.getInnovationById(id);
    if (!existing) throw new Error('Innovation not found');

    const newComment: InnovationComment = {
      id: `c-${Date.now()}`,
      authorName: comment.authorName || comment.userName || 'Citizen Contributor',
      authorRole: comment.authorRole || comment.userRole || 'Citizen',
      content: comment.content || comment.comment || '',
      createdAt: new Date().toISOString().slice(0, 10),
    };

    const updatedComments = [...(existing.comments || []), newComment];
    return this.updateInnovation(id, { comments: updatedComments });
  },

  /**
   * Expert Evaluation Module: Record professional committee review
   */
  async addReview(id: string, review: any): Promise<Innovation> {
    const existing = await this.getInnovationById(id);
    if (!existing) throw new Error('Innovation not found');

    const fScore = review.feasibilityScore ?? review.scores?.feasibility ?? 80;
    const cScore = review.costEffectivenessScore ?? review.scores?.costEffectiveness ?? 80;
    const iScore = review.communityImpactScore ?? review.scores?.communityImpact ?? 85;
    const sScore = review.scalability ?? review.scores?.scalability ?? 80;

    const avgScore = review.overallScore ?? Math.round((fScore + cScore + iScore + sScore) / 4);
    const recommendation = review.recommendation || review.verdict || 'Recommended for Ward Pilot';

    const newReview: InnovationReview = {
      id: `rev-${Date.now()}`,
      reviewerName: review.reviewerName || 'Expert Evaluator',
      reviewerTitle: review.reviewerTitle || 'Advisory Committee Member',
      scores: {
        feasibility: fScore,
        costEffectiveness: cScore,
        communityImpact: iScore,
        scalability: sScore,
      },
      verdict: recommendation,
      comments: review.comments || '',
      reviewedAt: new Date().toISOString().slice(0, 10),
    };

    const updatedReviews = [...(existing.reviews || []), newReview];

    // Transition stage if recommended
    let nextStage: InnovationStage = existing.stage;
    if (recommendation.toLowerCase().includes('pilot') || avgScore >= 80) {
      nextStage = 'Pilot Approved';
    } else if (existing.stage === 'Proposed') {
      nextStage = 'Under Review';
    }

    return this.updateInnovation(id, {
      reviews: updatedReviews,
      feasibilityScore: avgScore,
      stage: nextStage,
    });
  },

  /**
   * Pilot / Grant / Recognition Module
   */
  async updateStageAndAwards(
    id: string,
    data: {
      stage: InnovationStage;
      pilotDetails?: string;
      grantAmount?: string;
      recognitionBadge?: string;
    }
  ): Promise<Innovation> {
    return this.updateInnovation(id, {
      stage: data.stage,
      pilotDetails: data.pilotDetails,
      grantAmount: data.grantAmount,
      recognitionBadge: data.recognitionBadge,
    });
  },

  /**
   * Quick update stage
   */
  async updateStage(id: string, nextStage: InnovationStage): Promise<Innovation> {
    return this.updateStageAndAwards(id, { stage: nextStage });
  },
};
