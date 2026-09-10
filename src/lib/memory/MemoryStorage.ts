export interface Memory {
  id: string;
  content: string;
  category?: string;
  timestamp: number;
}

export interface MemoryStorage {
  save(memory: Memory): Promise<void>;
  update(id: string, memory: Partial<Memory>): Promise<void>;
  delete(id: string): Promise<void>;
  getAll(): Promise<Memory[]>;
  search(query: string): Promise<Memory[]>;
}
