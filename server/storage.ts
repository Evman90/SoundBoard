import { soundClips, triggerWords, settings, type SoundClip, type InsertSoundClip, type TriggerWord, type InsertTriggerWord, type Settings, type InsertSettings } from "@shared/schema";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";

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

  // Profile export/import methods
  exportProfile(): Promise<any>;
  importProfile(profileData: any): Promise<void>;
  clearAllData(): Promise<void>;
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

  async exportProfile(): Promise<any> {
    const soundClips = Array.from(this.soundClips.values());
    const triggerWords = Array.from(this.triggerWords.values());

    // Convert sound clips to include base64 audio data
    const profileSoundClips = [];
    for (const clip of soundClips) {
      try {
        const filePath = path.join(process.cwd(), "uploads", clip.filename);
        const audioData = fs.readFileSync(filePath, { encoding: 'base64' });
        profileSoundClips.push({
          name: clip.name,
          filename: clip.filename,
          format: clip.format,
          duration: clip.duration,
          size: clip.size,
          audioData,
        });
      } catch (error) {
        console.warn(`Could not read audio file ${clip.filename}:`, error);
      }
    }

    // Convert trigger words to use sound clip names instead of IDs
    const profileTriggerWords = [];
    for (const trigger of triggerWords) {
      const soundClip = soundClips.find(clip => clip.id === trigger.soundClipId);
      if (soundClip) {
        profileTriggerWords.push({
          phrase: trigger.phrase,
          soundClipName: soundClip.name,
          caseSensitive: trigger.caseSensitive || false,
          enabled: trigger.enabled !== false,
        });
      }
    }

    // Convert settings to use sound clip names instead of IDs
    const defaultResponseSoundClipNames = [];
    if (this.settings.defaultResponseSoundClipIds) {
      for (const id of this.settings.defaultResponseSoundClipIds) {
        const soundClip = soundClips.find(clip => clip.id === id);
        if (soundClip) {
          defaultResponseSoundClipNames.push(soundClip.name);
        }
      }
    }

    return {
      version: "1.0",
      exportDate: new Date().toISOString(),
      soundClips: profileSoundClips,
      triggerWords: profileTriggerWords,
      settings: {
        defaultResponseEnabled: this.settings.defaultResponseEnabled || false,
        defaultResponseSoundClipNames,
        defaultResponseDelay: this.settings.defaultResponseDelay || 2000,
      },
    };
  }

  async importProfile(profileData: any): Promise<void> {
    // Clear existing data first
    await this.clearAllData();

    // Import sound clips
    const soundClipNameToId = new Map<string, number>();
    for (const profileClip of profileData.soundClips || []) {
      try {
        // Write audio file to uploads directory
        const filename = `${Date.now()}_${profileClip.filename}`;
        const filePath = path.join(process.cwd(), "uploads", filename);
        const audioBuffer = Buffer.from(profileClip.audioData, 'base64');
        fs.writeFileSync(filePath, audioBuffer);

        // Create sound clip record
        const soundClipData = {
          name: profileClip.name,
          filename,
          format: profileClip.format,
          duration: profileClip.duration,
          size: profileClip.size,
          url: `/uploads/${filename}`,
        };

        const createdClip = await this.createSoundClip(soundClipData);
        soundClipNameToId.set(profileClip.name, createdClip.id);
      } catch (error) {
        console.error(`Error importing sound clip ${profileClip.name}:`, error);
      }
    }

    // Import trigger words
    for (const profileTrigger of profileData.triggerWords || []) {
      const soundClipId = soundClipNameToId.get(profileTrigger.soundClipName);
      if (soundClipId) {
        try {
          await this.createTriggerWord({
            phrase: profileTrigger.phrase,
            soundClipId,
            caseSensitive: profileTrigger.caseSensitive || false,
            enabled: profileTrigger.enabled !== false,
          });
        } catch (error) {
          console.error(`Error importing trigger word ${profileTrigger.phrase}:`, error);
        }
      }
    }

    // Import settings
    if (profileData.settings) {
      const defaultResponseSoundClipIds = [];
      for (const name of profileData.settings.defaultResponseSoundClipNames || []) {
        const id = soundClipNameToId.get(name);
        if (id) {
          defaultResponseSoundClipIds.push(id);
        }
      }

      await this.updateSettings({
        defaultResponseEnabled: profileData.settings.defaultResponseEnabled || false,
        defaultResponseSoundClipIds,
        defaultResponseDelay: profileData.settings.defaultResponseDelay || 2000,
        defaultResponseIndex: 0,
      });
    }
  }

  async clearAllData(): Promise<void> {
    // Delete all sound clip files
    const existingSoundClips = Array.from(this.soundClips.values());
    for (const clip of existingSoundClips) {
      try {
        const filePath = path.join(process.cwd(), "uploads", clip.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Deleted file: ${filePath}`);
        }
      } catch (error) {
        console.warn(`Could not delete file ${clip.filename}:`, error);
      }
    }

    // Clear all in-memory data
    this.soundClips.clear();
    this.triggerWords.clear();
    this.settings = {
      id: 1,
      defaultResponseEnabled: false,
      defaultResponseSoundClipIds: [],
      defaultResponseDelay: 2000,
      defaultResponseIndex: 0,
    };
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

  async exportProfile(): Promise<any> {
    const soundClips = await this.getSoundClips();
    const triggerWords = await this.getTriggerWords();
    const settings = await this.getSettings();

    // Convert sound clips to include base64 audio data
    const profileSoundClips = [];
    for (const clip of soundClips) {
      try {
        const filePath = path.join(process.cwd(), "uploads", clip.filename);
        const audioData = fs.readFileSync(filePath, { encoding: 'base64' });
        profileSoundClips.push({
          name: clip.name,
          filename: clip.filename,
          format: clip.format,
          duration: clip.duration,
          size: clip.size,
          audioData,
        });
      } catch (error) {
        console.warn(`Could not read audio file ${clip.filename}:`, error);
      }
    }

    // Convert trigger words to use sound clip names instead of IDs
    const profileTriggerWords = [];
    for (const trigger of triggerWords) {
      const soundClip = soundClips.find(clip => clip.id === trigger.soundClipId);
      if (soundClip) {
        profileTriggerWords.push({
          phrase: trigger.phrase,
          soundClipName: soundClip.name,
          caseSensitive: trigger.caseSensitive || false,
          enabled: trigger.enabled !== false,
        });
      }
    }

    // Convert settings to use sound clip names instead of IDs
    const defaultResponseSoundClipNames = [];
    if (settings.defaultResponseSoundClipIds) {
      for (const id of settings.defaultResponseSoundClipIds) {
        const soundClip = soundClips.find(clip => clip.id === id);
        if (soundClip) {
          defaultResponseSoundClipNames.push(soundClip.name);
        }
      }
    }

    return {
      version: "1.0",
      exportDate: new Date().toISOString(),
      soundClips: profileSoundClips,
      triggerWords: profileTriggerWords,
      settings: {
        defaultResponseEnabled: settings.defaultResponseEnabled || false,
        defaultResponseSoundClipNames,
        defaultResponseDelay: settings.defaultResponseDelay || 2000,
      },
    };
  }

  async importProfile(profileData: any): Promise<void> {
    // Clear existing data first
    await this.clearAllData();

    // Import sound clips
    const soundClipNameToId = new Map<string, number>();
    for (const profileClip of profileData.soundClips || []) {
      try {
        // Write audio file to uploads directory
        const filename = `${Date.now()}_${profileClip.filename}`;
        const filePath = path.join(process.cwd(), "uploads", filename);
        const audioBuffer = Buffer.from(profileClip.audioData, 'base64');
        fs.writeFileSync(filePath, audioBuffer);

        // Create sound clip record
        const soundClipData = {
          name: profileClip.name,
          filename,
          format: profileClip.format,
          duration: profileClip.duration,
          size: profileClip.size,
          url: `/uploads/${filename}`,
        };

        const createdClip = await this.createSoundClip(soundClipData);
        soundClipNameToId.set(profileClip.name, createdClip.id);
      } catch (error) {
        console.error(`Error importing sound clip ${profileClip.name}:`, error);
      }
    }

    // Import trigger words
    for (const profileTrigger of profileData.triggerWords || []) {
      const soundClipId = soundClipNameToId.get(profileTrigger.soundClipName);
      if (soundClipId) {
        try {
          await this.createTriggerWord({
            phrase: profileTrigger.phrase,
            soundClipId,
            caseSensitive: profileTrigger.caseSensitive || false,
            enabled: profileTrigger.enabled !== false,
          });
        } catch (error) {
          console.error(`Error importing trigger word ${profileTrigger.phrase}:`, error);
        }
      }
    }

    // Import settings
    if (profileData.settings) {
      const defaultResponseSoundClipIds = [];
      for (const name of profileData.settings.defaultResponseSoundClipNames || []) {
        const id = soundClipNameToId.get(name);
        if (id) {
          defaultResponseSoundClipIds.push(id);
        }
      }

      await this.updateSettings({
        defaultResponseEnabled: profileData.settings.defaultResponseEnabled || false,
        defaultResponseSoundClipIds,
        defaultResponseDelay: profileData.settings.defaultResponseDelay || 2000,
        defaultResponseIndex: 0,
      });
    }
  }

  async clearAllData(): Promise<void> {
    // Delete all sound clips and their files
    const existingSoundClips = await this.getSoundClips();
    for (const clip of existingSoundClips) {
      try {
        const filePath = path.join(process.cwd(), "uploads", clip.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.warn(`Could not delete file ${clip.filename}:`, error);
      }
    }

    // Clear database tables
    await this.db.delete(triggerWords);
    await this.db.delete(soundClips);
    
    // Reset settings to defaults
    const currentSettings = await this.getSettings();
    await this.updateSettings({
      defaultResponseEnabled: false,
      defaultResponseSoundClipIds: [],
      defaultResponseDelay: 2000,
      defaultResponseIndex: 0,
    });
  }
}

// Use memory storage for session-based data, profiles handle persistence
export const storage = new MemStorage();
