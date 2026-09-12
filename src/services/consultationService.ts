import { Consultation, ConsultationQuestion, ConsultationStatus } from '../types';
import { db, cleanFirestoreData } from '../lib/firebase';
import { INITIAL_SEED_CONSULTATIONS } from '../data/seedConsultations';
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

const CONSULTATIONS_COLLECTION = 'consultations';

export const consultationService = {
  /**
   * Fetch all policy consultations
   */
  async getConsultations(): Promise<Consultation[]> {
    try {
      const colRef = collection(db, CONSULTATIONS_COLLECTION);
      const q = query(colRef, orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);

      if (!snap.empty) {
        return snap.docs.map((d) => d.data() as Consultation);
      }

      // Seed initial consultations if empty
      Promise.all(
        INITIAL_SEED_CONSULTATIONS.map((c) =>
          setDoc(doc(db, CONSULTATIONS_COLLECTION, c.id), cleanFirestoreData(c)).catch(() => {})
        )
      ).catch(() => {});
      return INITIAL_SEED_CONSULTATIONS;
    } catch (err) {
      console.warn('Falling back to local consultations list:', err);
      return INITIAL_SEED_CONSULTATIONS;
    }
  },

  /**
   * Fetch single consultation by ID
   */
  async getConsultationById(id: string): Promise<Consultation | null> {
    try {
      const docRef = doc(db, CONSULTATIONS_COLLECTION, id.trim());
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return snap.data() as Consultation;
      }
      const all = await this.getConsultations();
      return all.find((c) => c.id.toLowerCase() === id.trim().toLowerCase()) || null;
    } catch (err) {
      console.error(`Error getting consultation ${id}:`, err);
      return null;
    }
  },

  /**
   * Create a new policy consultation (Admin / Government)
   */
  async createConsultation(data: {
    title: string;
    department: string;
    topic: string;
    summary: string;
    deadline: string;
    questions: ConsultationQuestion[];
    createdByUid?: string;
  }): Promise<Consultation> {
    const year = new Date().getFullYear();
    const rand = Math.floor(10 + Math.random() * 90);
    const generatedId = `pol-${year}-${rand}`;

    const newConsultation: Consultation = {
      id: generatedId,
      title: data.title,
      department: data.department,
      topic: data.topic,
      status: 'Active',
      summary: data.summary,
      deadline: data.deadline,
      totalResponses: 0,
      voters: [],
      questions: data.questions,
      createdByUid: data.createdByUid,
      createdAt: new Date().toISOString(),
    };

    const docRef = doc(db, CONSULTATIONS_COLLECTION, generatedId);
    await setDoc(docRef, cleanFirestoreData(newConsultation));

    return newConsultation;
  },

  /**
   * Update consultation
   */
  async updateConsultation(id: string, updates: Partial<Consultation>): Promise<Consultation> {
    const docRef = doc(db, CONSULTATIONS_COLLECTION, id);
    const existing = await this.getConsultationById(id);
    if (!existing) throw new Error('Consultation not found');

    const merged = { ...existing, ...updates };
    await updateDoc(docRef, cleanFirestoreData(updates));
    return merged;
  },

  /**
   * Delete consultation (Editable & Deletable)
   */
  async deleteConsultation(id: string): Promise<void> {
    const docRef = doc(db, CONSULTATIONS_COLLECTION, id);
    await deleteDoc(docRef);
  },

  /**
   * Submit citizen responses for multiple questions in a consultation
   */
  async submitResponse(
    consultationId: string,
    payload: {
      userName?: string;
      userRole?: string;
      ward?: string;
      answers: Record<string, any>;
      voterId?: string;
    }
  ): Promise<{ id: string }> {
    const consultation = await this.getConsultationById(consultationId);
    if (!consultation) throw new Error('Consultation not found');

    const voter = payload.voterId || payload.userName || 'citizen-contributor';
    const voters = consultation.voters || [];
    const isNew = !voters.includes(voter);

    const updatedQuestions = consultation.questions.map((q) => {
      const selected = payload.answers[q.id];
      if (selected !== undefined && selected !== null) {
        const live = { ...(q.liveDistribution || {}) };
        const key = String(selected);
        live[key] = (live[key] || 0) + 1;
        return {
          ...q,
          liveDistribution: live,
        };
      }
      return q;
    });

    const updatedVoters = isNew ? [...voters, voter] : voters;
    const totalResponses = isNew ? consultation.totalResponses + 1 : consultation.totalResponses;

    await this.updateConsultation(consultationId, {
      questions: updatedQuestions,
      voters: updatedVoters,
      totalResponses,
    });

    return { id: `RESP-${Date.now().toString().slice(-6)}` };
  },

  /**
   * Submit single citizen vote / answer on a consultation question
   */
  async submitAnswer(
    consultationId: string,
    questionId: string,
    selectedOption: string,
    voterId?: string
  ): Promise<Consultation> {
    return (
      (await this.submitResponse(consultationId, {
        answers: { [questionId]: selectedOption },
        voterId,
      })) as any
    );
  },
};
