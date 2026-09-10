import fs from 'fs/promises';
import path from 'path';
import { Memory, MemoryStorage } from './MemoryStorage';

export class JsonMemoryStorage implements MemoryStorage {
  private filePath: string;

  constructor(filePath?: string) {
    // Default to a file in the root of the project
    this.filePath = filePath || path.join(process.cwd(), 'myraa_memory.json');
  }

  private async ensureFileExists(): Promise<void> {
    try {
      await fs.access(this.filePath);
    } catch {
      await fs.writeFile(this.filePath, JSON.stringify([]), 'utf-8');
    }
  }

  private async readData(): Promise<Memory[]> {
    await this.ensureFileExists();
    const data = await fs.readFile(this.filePath, 'utf-8');
    try {
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  private async writeData(data: Memory[]): Promise<void> {
    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async save(memory: Memory): Promise<void> {
    const data = await this.readData();
    data.push(memory);
    await this.writeData(data);
  }

  async update(id: string, partialMemory: Partial<Memory>): Promise<void> {
    const data = await this.readData();
    const index = data.findIndex(m => m.id === id);
    if (index !== -1) {
      data[index] = { ...data[index], ...partialMemory };
      await this.writeData(data);
    }
  }

  async delete(id: string): Promise<void> {
    let data = await this.readData();
    data = data.filter(m => m.id !== id);
    await this.writeData(data);
  }

  async getAll(): Promise<Memory[]> {
    return await this.readData();
  }

  async search(query: string): Promise<Memory[]> {
    const data = await this.readData();
    const q = query.toLowerCase();
    return data.filter(m =>
      m.content.toLowerCase().includes(q) ||
      (m.category && m.category.toLowerCase().includes(q))
    );
  }
}
