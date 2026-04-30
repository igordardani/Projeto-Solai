export interface UserEntry {
  id: string;
  month: number;
  year: number;
  discountValue: number;
  injectedkWh?: number;
  totalBill?: number;
  pdfBase64?: string;
  pdfName?: string;
  driveFileId?: string;
  driveLink?: string;
  createdAt: any;
  userId: string;
}

export interface UserSettings {
  investmentValue: number;
  userId: string;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}
