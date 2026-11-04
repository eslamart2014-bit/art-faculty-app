import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(process.cwd(), '.local_portal_db.json');

interface LocalDB {
  student_accounts: any[];
  student_submissions: any[];
  student_complaints: any[];
  portal_audit_logs: any[];
}

function readDB(): LocalDB {
  try {
    if (fs.existsSync(DB_PATH)) {
      const content = fs.readFileSync(DB_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (e) {}
  return {
    student_accounts: [],
    student_submissions: [],
    student_complaints: [],
    portal_audit_logs: [],
  };
}

function writeDB(data: LocalDB) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to write local DB fallback:', e);
  }
}

export const localStore = {
  getAccount(code: string) {
    const db = readDB();
    return db.student_accounts.find(
      (a) => a.student_code === code || a.student_code === code.padStart(4, '0')
    ) || null;
  },

  getAllAccounts() {
    const db = readDB();
    return db.student_accounts;
  },

  upsertAccount(account: any) {
    const db = readDB();
    const idx = db.student_accounts.findIndex(
      (a) => a.student_code === account.student_code
    );
    if (idx >= 0) {
      db.student_accounts[idx] = { ...db.student_accounts[idx], ...account };
    } else {
      db.student_accounts.push(account);
    }
    writeDB(db);
    return account;
  },

  saveAccount(account: any) {
    return this.upsertAccount(account);
  },

  deleteAccount(code: string) {
    const db = readDB();
    db.student_accounts = db.student_accounts.filter(
      (a) => a.student_code !== code && a.student_code !== code.padStart(4, '0')
    );
    writeDB(db);
  },

  getSubmissions(code: string) {
    const db = readDB();
    return db.student_submissions.filter((s) => s.student_code === code);
  },

  getAllSubmissions() {
    const db = readDB();
    return db.student_submissions;
  },

  saveSubmission(submission: any) {
    const db = readDB();
    db.student_submissions.push(submission);
    writeDB(db);
    return submission;
  },

  deleteSubmissions(code: string) {
    const db = readDB();
    db.student_submissions = db.student_submissions.filter((s) => s.student_code !== code);
    writeDB(db);
  },

  deleteSubmission(code: string, courseId: string, projectName: string) {
    const db = readDB();
    db.student_submissions = db.student_submissions.filter(
      (s) => !(s.student_code === code && s.course_id === courseId && s.project_name === projectName)
    );
    writeDB(db);
  },

  getAuditLogs(code: string) {
    const db = readDB();
    return db.portal_audit_logs.filter((l) => l.student_code === code);
  },

  saveAuditLog(log: any) {
    const db = readDB();
    db.portal_audit_logs.unshift(log);
    writeDB(db);
  },

  addAuditLog(log: any) {
    this.saveAuditLog(log);
  },
};
