export type PollType = "single" | "multiple" | "ranked";

export interface PollOption {
  id: string;
  text: string;
  votes: string[];
}

export interface Poll {
  id: string;
  title: string;
  description: string;
  pollType: PollType;
  options: PollOption[];
  isAnonymous: boolean;
  deadline: Date | null;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
  updatedAt: Date;
}
