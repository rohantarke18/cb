import { db, auth, cleanFirestoreData } from '../lib/firebase';
import {
  collection,
  doc,
  setDoc,
  getDocs,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';

export interface AuditLogEntry {
  id: string;
  action:
    | 'OFFICER_ASSIGNED'
    | 'STATUS_CHANGED'
    | 'ROLE_PROVISIONED'
    | 'RESOLUTION_SUBMITTED'
    | 'CASE_REOPENED'
    | 'CASE_RESOLVED'
    | 'INNOVATION_EVALUATED'
    | 'CONSULTATION_CREATED'
    | 'ADMIN_CONFIG_UPDATED';
  entityType: 'problem' | 'user' | 'innovation' | 'consultation' | 'system';
  entityId: string;
  performedBy: {
    uid: string;
    name: string;
    role: string;
  };
  details: string;
  timestamp: string;
}

const AUDIT_LOGS_COLLECTION = 'audit_logs';

export const auditLogService = {
  /**
   * Log an administrative or state-change event.
   * Never logs secrets, tokens, or private citizen PII.
   */
  async logAction(
    action: AuditLogEntry['action'],
    entityType: AuditLogEntry['entityType'],
    entityId: string,
    details: string,
    actorOverride?: { uid: string; name: string; role: string }
  ): Promise<void> {
    const currentUser = auth.currentUser;
    const actor = actorOverride || {
      uid: currentUser?.uid || 'system',
      name: currentUser?.displayName || 'Authorized Official',
      role: 'official',
    };

    const id = `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const logEntry: AuditLogEntry = {
      id,
      action,
      entityType,
      entityId,
      performedBy: actor,
      details,
      timestamp: new Date().toISOString(),
    };

    try {
      const docRef = doc(db, AUDIT_LOGS_COLLECTION, id);
      await setDoc(docRef, cleanFirestoreData(logEntry));
    } catch (err) {
      console.warn('Audit log write notice:', err);
    }
  },

  /**
   * Retrieve recent audit records for authorized administrators
   */
  async getRecentLogs(maxCount = 50): Promise<AuditLogEntry[]> {
    try {
      const colRef = collection(db, AUDIT_LOGS_COLLECTION);
      const q = query(colRef, orderBy('timestamp', 'desc'), limit(maxCount));
      const snap = await getDocs(q);

      if (!snap.empty) {
        return snap.docs.map((d) => d.data() as AuditLogEntry);
      }
    } catch (err) {
      console.warn('Audit logs query notice:', err);
    }
    return [];
  },
};
