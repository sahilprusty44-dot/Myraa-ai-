import { Memory, MemoryStorage } from './MemoryStorage';
import { JsonMemoryStorage } from './JsonMemoryStorage';

export class MemoryManager {
  private storage: MemoryStorage;

  constructor(storage?: MemoryStorage) {
    this.storage = storage || new JsonMemoryStorage();
  }

  /**
   * Save a new memory
   */
  async saveMemory(content: string, category?: string): Promise<Memory> {
    const memory: Memory = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      content,
      category,
      timestamp: Date.now(),
    };
    await this.storage.save(memory);
    return memory;
  }

  /**
   * Update an existing memory
   */
  async updateMemory(id: string, content?: string, category?: string): Promise<void> {
    const updatePayload: Partial<Memory> = {};
    if (content !== undefined) updatePayload.content = content;
    if (category !== undefined) updatePayload.category = category;

    if (Object.keys(updatePayload).length > 0) {
      await this.storage.update(id, updatePayload);
    }
  }

  /**
   * Delete a memory by ID
   */
  async deleteMemory(id: string): Promise<void> {
    await this.storage.delete(id);
  }

  /**
   * Retrieve all memories
   */
  async getAllMemories(): Promise<Memory[]> {
    return await this.storage.getAll();
  }

  /**
   * Search memories by query
   */
  async searchMemories(query: string): Promise<Memory[]> {
    return await this.storage.search(query);
  }

  /**
   * Retrieve a formatted string of memories for injecting into the context
   */
  async getContextString(): Promise<string> {
    const memories = await this.getAllMemories();
    if (memories.length === 0) return "";

    let context = "\\n\\n--- LONG-TERM MEMORY ---\\n";
    context += "The following are facts you have learned and remembered about the user:\\n";

    memories.forEach(m => {
      context += `- [ID: ${m.id}] ${m.category ? `(${m.category}) ` : ""}${m.content}\\n`;
    });

    return context;
  }
}

// Export a singleton instance for easy use across the server
export const memoryManager = new MemoryManager();
