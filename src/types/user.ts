export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  role: "admin" | "user" | "graduate";
  customRoles: string[];
  is_approved: boolean;
  is_banned: boolean;
  is_muted: boolean;
  approvalMethod: "domain" | "invite" | "manual" | null;
  inviteCodeUsed: string | null;
  approvalRequestNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemberProfile {
  uid: string;
  displayName: string;
  email: string;
  role: "admin" | "user" | "graduate";
  customRoles: string[];
  is_approved: boolean;
  is_banned: boolean;
  is_muted: boolean;
  createdAt: Date;
}

export interface InviteCode {
  id: string;
  code: string;
  createdBy: string;
  usedBy: string | null;
  usedAt: Date | null;
  expiresAt: Date;
  isUsed: boolean;
  createdAt: Date;
}

export interface ApprovalRequest {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  requestNumber: string;
  message: string;
  status: "pending" | "approved" | "rejected";
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}
