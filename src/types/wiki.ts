export interface WikiPage {
  id: string;
  title: string;
  content: string;
  tags: string[];
  isPinned: boolean;
  authorId: string;
  authorName: string;
  currentEditors: string[];
  backlinks: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface WikiRevision {
  id: string;
  pageId: string;
  content: string;
  editedBy: string;
  editedByName: string;
  createdAt: Date;
}
