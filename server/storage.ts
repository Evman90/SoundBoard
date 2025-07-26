import { soundClips, triggerWords, settings, type SoundClip, type InsertSoundClip, type TriggerWord, type InsertTriggerWord, type Settings, type InsertSettings } from "@shared/schema";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";

export interface IStorage {
  // Sound clips
  getSoundClips(): Promise<SoundClip[]>;
  getSoundClip(id: number): Promise<SoundClip | undefined>;
  createSoundClip(soundClip: InsertSoundClip): Promise<SoundClip>;
  deleteSoundClip(id: number): Promise<void>;
  
  // Trigger words
  getTriggerWords(): Promise<TriggerWord[]>;
  getTriggerWord(id: number): Promise<TriggerWord | undefined>;
  createTriggerWord(triggerWord: InsertTriggerWord): Promise<TriggerWord>;
  updateTriggerWord(id: number, triggerWord: Partial<InsertTriggerWord>): Promise<TriggerWord | undefined>;
  deleteTriggerWord(id: number): Promise<void>;
  
  // Settings
  getSettings(): Promise<Settings>;
  updateSettings(settings: Partial<InsertSettings>): Promise<Settings>;
  getNextDefaultResponse(): Promise<number | null>;
}

export class MemStorage implements IStorage {
  private soundClips: Map<number, SoundClip>;
  private triggerWords: Map<number, TriggerWord>;
  private settings: Settings;
  private currentSoundClipId: number;
  private currentTriggerWordId: number;

  constructor() {
    this.soundClips = new Map();
    this.triggerWords = new Map();
    this.settings = {
      id: 1,
      defaultResponseEnabled: false,
      defaultResponseSoundClipIds: [],
      defaultResponseDelay: 2000,
      defaultResponseIndex: 0,
    };
    this.currentSoundClipId = 1;
    this.currentTriggerWordId = 1;
  }

  async getSoundClips(): Promise<SoundClip[]> {
    return Array.from(this.soundClips.values());
  }

  async getSoundClip(id: number): Promise<SoundClip | undefined> {
    return this.soundClips.get(id);
  }

  async createSoundClip(insertSoundClip: InsertSoundClip): Promise<SoundClip> {
    const id = this.currentSoundClipId++;
    const soundClip: SoundClip = { ...insertSoundClip, id };
    this.soundClips.set(id, soundClip);
    return soundClip;
  }

  async deleteSoundClip(id: number): Promise<void> {
    this.soundClips.delete(id);
    // Also delete associated trigger words
    for (const [triggerId, triggerWord] of Array.from(this.triggerWords.entries())) {
      if (triggerWord.soundClipId === id) {
        this.triggerWords.delete(triggerId);
      }
    }
  }

  async getTriggerWords(): Promise<TriggerWord[]> {
    return Array.from(this.triggerWords.values());
  }

  async getTriggerWord(id: number): Promise<TriggerWord | undefined> {
    return this.triggerWords.get(id);
  }

  async createTriggerWord(insertTriggerWord: InsertTriggerWord): Promise<TriggerWord> {
    const id = this.currentTriggerWordId++;
    const triggerWord: TriggerWord = { ...insertTriggerWord, id };
    this.triggerWords.set(id, triggerWord);
    return triggerWord;
  }

  async updateTriggerWord(id: number, updates: Partial<InsertTriggerWord>): Promise<TriggerWord | undefined> {
    const existing = this.triggerWords.get(id);
    if (!existing) return undefined;
    
    const updated: TriggerWord = { 
      ...existing, 
      ...updates,
      enabled: updates.enabled ?? existing.enabled,
      caseSensitive: updates.caseSensitive ?? existing.caseSensitive
    };
    this.triggerWords.set(id, updated);
    return updated;
  }

  async deleteTriggerWord(id: number): Promise<void> {
    this.triggerWords.delete(id);
  }

  async getSettings(): Promise<Settings> {
    return this.settings;
  }

  async updateSettings(updates: Partial<InsertSettings>): Promise<Settings> {
    this.settings = { 
      ...this.settings, 
      ...updates 
    };
    return this.settings;
  }

  async getNextDefaultResponse(): Promise<number | null> {
    if (!this.settings.defaultResponseEnabled || !this.settings.defaultResponseSoundClipIds || this.settings.defaultResponseSoundClipIds.length === 0) {
      return null;
    }

    const soundClipIds = this.settings.defaultResponseSoundClipIds;
    const currentIndex = this.settings.defaultResponseIndex || 0;
    const soundClipId = soundClipIds[currentIndex];

    // Update index for next time (cycle back to 0 if at end)
    const nextIndex = (currentIndex + 1) % soundClipIds.length;
    this.settings.defaultResponseIndex = nextIndex;

    return soundClipId;
  }
}

// Database storage implementation
export class DatabaseStorage implements IStorage {
  private db;

  constructor() {
    const sql = neon(process.env.DATABASE_URL!);
    this.db = drizzle(sql);
  }

  async getSoundClips(): Promise<SoundClip[]> {
    return await this.db.select().from(soundClips);
  }

  async getSoundClip(id: number): Promise<SoundClip | undefined> {
    const result = await this.db.select().from(soundClips).where(eq(soundClips.id, id));
    return result[0];
  }

  async createSoundClip(insertSoundClip: InsertSoundClip): Promise<SoundClip> {
    const result = await this.db.insert(soundClips).values(insertSoundClip).returning();
    return result[0];
  }

  async deleteSoundClip(id: number): Promise<void> {
    await this.db.delete(soundClips).where(eq(soundClips.id, id));
  }

  async getTriggerWords(): Promise<TriggerWord[]> {
    return await this.db.select().from(triggerWords);
  }

  async getTriggerWord(id: number): Promise<TriggerWord | undefined> {
    const result = await this.db.select().from(triggerWords).where(eq(triggerWords.id, id));
    return result[0];  
  }

  async createTriggerWord(insertTriggerWord: InsertTriggerWord): Promise<TriggerWord> {
    const result = await this.db.insert(triggerWords).values(insertTriggerWord).returning();
    return result[0];
  }

  async updateTriggerWord(id: number, updateData: Partial<InsertTriggerWord>): Promise<TriggerWord | undefined> {
    const result = await this.db.update(triggerWords).set(updateData).where(eq(triggerWords.id, id)).returning();
    return result[0];
  }

  async deleteTriggerWord(id: number): Promise<void> {
    await this.db.delete(triggerWords).where(eq(triggerWords.id, id));
  }

  async getSettings(): Promise<Settings> {
    const result = await this.db.select().from(settings);
    if (result.length === 0) {
      // Create default settings if none exist
      const defaultSettings = {
        defaultResponseEnabled: false,
        defaultResponseSoundClipIds: [],
        defaultResponseDelay: 2000,
        defaultResponseIndex: 0,
      };
      const created = await this.db.insert(settings).values(defaultSettings).returning();
      return created[0];
    }
    return result[0];
  }

  async updateSettings(updateData: Partial<InsertSettings>): Promise<Settings> {
    const currentSettings = await this.getSettings();
    const result = await this.db.update(settings).set(updateData).where(eq(settings.id, currentSettings.id)).returning();
    return result[0];
  }

  async getNextDefaultResponse(): Promise<number | null> {
    const currentSettings = await this.getSettings();
    if (!currentSettings.defaultResponseEnabled || !currentSettings.defaultResponseSoundClipIds || currentSettings.defaultResponseSoundClipIds.length === 0) {
      return null;
    }

    const currentIndex = currentSettings.defaultResponseIndex || 0;
    const nextIndex = (currentIndex + 1) % currentSettings.defaultResponseSoundClipIds.length;
    
    // Update the index for next time
    await this.updateSettings({ defaultResponseIndex: nextIndex });
    
    return currentSettings.defaultResponseSoundClipIds[currentIndex];
  }
}

// Use database storage instead of memory storage
export const storage = new DatabaseStorage();
