import { type SoundClip, type TriggerWord, type Settings } from "@shared/schema";

// Browser storage interface - mirrors the server storage interface
export interface IBrowserStorage {
  // Sound clips
  getSoundClips(): Promise<SoundClip[]>;
  getSoundClip(id: number): Promise<SoundClip | undefined>;
  createSoundClip(file: File): Promise<SoundClip>;
  deleteSoundClip(id: number): Promise<void>;
  
  // Trigger words
  getTriggerWords(): Promise<TriggerWord[]>;
  getTriggerWord(id: number): Promise<TriggerWord | undefined>;
  createTriggerWord(triggerWord: Omit<TriggerWord, 'id'>): Promise<TriggerWord>;
  updateTriggerWord(id: number, triggerWord: Partial<Omit<TriggerWord, 'id'>>): Promise<TriggerWord | undefined>;
  deleteTriggerWord(id: number): Promise<void>;
  getNextSoundClipForTrigger(triggerId: number): Promise<number | null>;
  
  // Settings
  getSettings(): Promise<Settings>;
  updateSettings(settings: Partial<Omit<Settings, 'id'>>): Promise<Settings>;
  getNextDefaultResponse(): Promise<number | null>;

  // Profile export/import
  exportProfile(): Promise<any>;
  importProfile(profileData: any): Promise<void>;
  clearAllData(): Promise<void>;
}

// IndexedDB database setup
const DB_NAME = 'CallSoundPro';
const DB_VERSION = 1;
const STORES = {
  SOUND_CLIPS: 'soundClips',
  TRIGGER_WORDS: 'triggerWords',
  SETTINGS: 'settings',
  AUDIO_FILES: 'audioFiles'
};

class BrowserStorage implements IBrowserStorage {
  private db: IDBDatabase | null = null;
  private dbPromise: Promise<IDBDatabase>;

  constructor() {
    this.dbPromise = this.initDB();
  }

  private async initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Sound clips store
        if (!db.objectStoreNames.contains(STORES.SOUND_CLIPS)) {
          const soundClipsStore = db.createObjectStore(STORES.SOUND_CLIPS, { keyPath: 'id', autoIncrement: true });
          soundClipsStore.createIndex('name', 'name', { unique: false });
        }
        
        // Trigger words store
        if (!db.objectStoreNames.contains(STORES.TRIGGER_WORDS)) {
          const triggerWordsStore = db.createObjectStore(STORES.TRIGGER_WORDS, { keyPath: 'id', autoIncrement: true });
          triggerWordsStore.createIndex('phrase', 'phrase', { unique: false });
        }
        
        // Settings store
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'id' });
        }
        
        // Audio files store (for storing actual audio blobs)
        if (!db.objectStoreNames.contains(STORES.AUDIO_FILES)) {
          db.createObjectStore(STORES.AUDIO_FILES, { keyPath: 'filename' });
        }
      };
    });
  }

  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    return this.dbPromise;
  }

  private async getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
    const db = await this.getDB();
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  // Sound clips methods
  async getSoundClips(): Promise<SoundClip[]> {
    const store = await this.getStore(STORES.SOUND_CLIPS);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getSoundClip(id: number): Promise<SoundClip | undefined> {
    const store = await this.getStore(STORES.SOUND_CLIPS);
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async createSoundClip(file: File): Promise<SoundClip> {
    const db = await this.getDB();
    
    return new Promise(async (resolve, reject) => {
      try {
        // Get audio duration
        const duration = await this.getAudioDuration(file);
        
        // Generate unique filename
        const filename = `${Date.now()}_${file.name}`;
        
        // Create a single transaction for both stores
        const transaction = db.transaction([STORES.AUDIO_FILES, STORES.SOUND_CLIPS], 'readwrite');
        const audioStore = transaction.objectStore(STORES.AUDIO_FILES);
        const clipStore = transaction.objectStore(STORES.SOUND_CLIPS);
        
        // Store audio file first
        const audioRequest = audioStore.put({
          filename,
          data: file,
          originalName: file.name
        });
        
        audioRequest.onsuccess = () => {
          // Create sound clip record
          const soundClip = {
            name: file.name.replace(/\.[^/.]+$/, ""), // Remove extension
            filename,
            format: file.type || 'audio/mpeg',
            duration,
            size: file.size,
            url: `blob://${filename}`, // Custom URL scheme for browser storage
            isDefault: true
          };
          
          const clipRequest = clipStore.add(soundClip);
          clipRequest.onsuccess = () => {
            const createdClip = { ...soundClip, id: clipRequest.result as number };
            resolve(createdClip);
            
            // Update default responses
            this.addToDefaultResponses(createdClip.id);
          };
          clipRequest.onerror = () => reject(clipRequest.error);
        };
        
        audioRequest.onerror = () => reject(audioRequest.error);
        transaction.onerror = () => reject(transaction.error);
        
      } catch (error) {
        reject(error);
      }
    });
  }

  private async getAudioDuration(file: File): Promise<number> {
    return new Promise((resolve) => {
      const audio = new Audio();
      const url = URL.createObjectURL(file);
      
      audio.addEventListener('loadedmetadata', () => {
        URL.revokeObjectURL(url);
        resolve(audio.duration || 0);
      });
      
      audio.addEventListener('error', () => {
        URL.revokeObjectURL(url);
        resolve(0);
      });
      
      audio.src = url;
    });
  }

  private async addToDefaultResponses(soundClipId: number): Promise<void> {
    const settings = await this.getSettings();
    const updatedIds = [...(settings.defaultResponseSoundClipIds || []), soundClipId];
    await this.updateSettings({ defaultResponseSoundClipIds: updatedIds });
  }

  async deleteSoundClip(id: number): Promise<void> {
    const soundClip = await this.getSoundClip(id);
    if (!soundClip) return;

    const audioStore = await this.getStore(STORES.AUDIO_FILES, 'readwrite');
    const clipStore = await this.getStore(STORES.SOUND_CLIPS, 'readwrite');
    
    return new Promise((resolve, reject) => {
      // Remove from audio files
      const audioRequest = audioStore.delete(soundClip.filename);
      audioRequest.onerror = () => reject(audioRequest.error);
      audioRequest.onsuccess = () => {
        // Remove sound clip record
        const clipRequest = clipStore.delete(id);
        clipRequest.onerror = () => reject(clipRequest.error);
        clipRequest.onsuccess = () => {
          resolve();
          
          // Clean up references
          this.removeFromDefaultResponses(id);
          this.removeFromTriggerWords(id);
        };
      };
    });
  }

  private async removeFromDefaultResponses(soundClipId: number): Promise<void> {
    const settings = await this.getSettings();
    const updatedIds = (settings.defaultResponseSoundClipIds || []).filter(id => id !== soundClipId);
    await this.updateSettings({ defaultResponseSoundClipIds: updatedIds });
  }

  private async removeFromTriggerWords(soundClipId: number): Promise<void> {
    const triggerWords = await this.getTriggerWords();
    for (const trigger of triggerWords) {
      if (trigger.soundClipIds.includes(soundClipId)) {
        const updatedIds = trigger.soundClipIds.filter(id => id !== soundClipId);
        if (updatedIds.length === 0) {
          await this.deleteTriggerWord(trigger.id);
        } else {
          await this.updateTriggerWord(trigger.id, { soundClipIds: updatedIds });
        }
      }
    }
  }

  // Get audio blob for playback
  async getAudioBlob(filename: string): Promise<Blob | null> {
    const store = await this.getStore(STORES.AUDIO_FILES);
    return new Promise((resolve, reject) => {
      const request = store.get(filename);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.data : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Trigger words methods
  async getTriggerWords(): Promise<TriggerWord[]> {
    const store = await this.getStore(STORES.TRIGGER_WORDS);
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getTriggerWord(id: number): Promise<TriggerWord | undefined> {
    const store = await this.getStore(STORES.TRIGGER_WORDS);
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async createTriggerWord(triggerWord: Omit<TriggerWord, 'id'>): Promise<TriggerWord> {
    const store = await this.getStore(STORES.TRIGGER_WORDS, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.add(triggerWord);
      request.onsuccess = () => {
        const createdTrigger = { ...triggerWord, id: request.result as number };
        resolve(createdTrigger);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async updateTriggerWord(id: number, triggerWord: Partial<Omit<TriggerWord, 'id'>>): Promise<TriggerWord | undefined> {
    const store = await this.getStore(STORES.TRIGGER_WORDS, 'readwrite');
    const existing = await this.getTriggerWord(id);
    if (!existing) return undefined;

    const updated = { ...existing, ...triggerWord };
    return new Promise((resolve, reject) => {
      const request = store.put(updated);
      request.onsuccess = () => resolve(updated);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteTriggerWord(id: number): Promise<void> {
    const store = await this.getStore(STORES.TRIGGER_WORDS, 'readwrite');
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getNextSoundClipForTrigger(triggerId: number): Promise<number | null> {
    const trigger = await this.getTriggerWord(triggerId);
    if (!trigger || trigger.soundClipIds.length === 0) return null;

    const currentIndex = trigger.currentIndex || 0;
    const soundClipId = trigger.soundClipIds[currentIndex];
    
    // Update index for next time
    const nextIndex = (currentIndex + 1) % trigger.soundClipIds.length;
    await this.updateTriggerWord(triggerId, { currentIndex: nextIndex });
    
    return soundClipId;
  }

  // Settings methods
  async getSettings(): Promise<Settings> {
    const store = await this.getStore(STORES.SETTINGS);
    return new Promise((resolve, reject) => {
      const request = store.get(1);
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          resolve(result);
        } else {
          // Create default settings
          const defaultSettings: Settings = {
            id: 1,
            defaultResponseEnabled: true,
            defaultResponseSoundClipIds: [],
            defaultResponseDelay: 0,
            defaultResponseIndex: 0,
          };
          resolve(defaultSettings);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  async updateSettings(settings: Partial<Omit<Settings, 'id'>>): Promise<Settings> {
    const db = await this.getDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SETTINGS], 'readwrite');
      const store = transaction.objectStore(STORES.SETTINGS);
      
      // First get existing settings
      const getRequest = store.get(1);
      getRequest.onsuccess = () => {
        const existing = getRequest.result || {
          id: 1,
          defaultResponseEnabled: true,
          defaultResponseSoundClipIds: [],
          defaultResponseDelay: 0,
          defaultResponseIndex: 0,
        };
        
        const updated = { ...existing, ...settings };
        
        // Now update with the same transaction
        const putRequest = store.put(updated);
        putRequest.onsuccess = () => resolve(updated);
        putRequest.onerror = () => reject(putRequest.error);
      };
      
      getRequest.onerror = () => reject(getRequest.error);
      transaction.onerror = () => reject(transaction.error);
    });
  }

  async getNextDefaultResponse(): Promise<number | null> {
    const settings = await this.getSettings();
    const soundClipIds = settings.defaultResponseSoundClipIds || [];
    
    if (soundClipIds.length === 0) return null;
    
    const currentIndex = settings.defaultResponseIndex || 0;
    const soundClipId = soundClipIds[currentIndex];
    
    // Update index for next time
    const nextIndex = (currentIndex + 1) % soundClipIds.length;
    await this.updateSettings({ defaultResponseIndex: nextIndex });
    
    return soundClipId;
  }

  // Profile methods
  async exportProfile(): Promise<any> {
    const soundClips = await this.getSoundClips();
    const triggerWords = await this.getTriggerWords();
    const settings = await this.getSettings();

    // Convert sound clips to include base64 audio data
    const profileSoundClips = [];
    for (const clip of soundClips) {
      try {
        const audioBlob = await this.getAudioBlob(clip.filename);
        if (audioBlob) {
          const arrayBuffer = await audioBlob.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          profileSoundClips.push({
            name: clip.name,
            filename: clip.filename,
            format: clip.format,
            duration: clip.duration,
            size: clip.size,
            audioData: base64,
          });
        }
      } catch (error) {
        console.warn(`Could not export audio file ${clip.filename}:`, error);
      }
    }

    // Convert trigger words to use sound clip names instead of IDs
    const profileTriggerWords = [];
    for (const trigger of triggerWords) {
      const soundClipNames = [];
      for (const clipId of trigger.soundClipIds) {
        const soundClip = soundClips.find(clip => clip.id === clipId);
        if (soundClip) {
          soundClipNames.push(soundClip.name);
        }
      }
      if (soundClipNames.length > 0) {
        profileTriggerWords.push({
          phrase: trigger.phrase,
          soundClipNames,
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
        // Convert base64 to blob
        const binaryString = atob(profileClip.audioData);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: profileClip.format });
        const file = new File([blob], profileClip.filename, { type: profileClip.format });

        const createdClip = await this.createSoundClip(file);
        soundClipNameToId.set(profileClip.name, createdClip.id);
      } catch (error) {
        console.error(`Error importing sound clip ${profileClip.name}:`, error);
      }
    }

    // Import trigger words
    for (const profileTrigger of profileData.triggerWords || []) {
      const soundClipIds = [];
      for (const name of profileTrigger.soundClipNames || []) {
        const id = soundClipNameToId.get(name);
        if (id) {
          soundClipIds.push(id);
        }
      }
      
      if (soundClipIds.length > 0) {
        try {
          await this.createTriggerWord({
            phrase: profileTrigger.phrase,
            soundClipIds,
            currentIndex: 0,
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
    const stores = [STORES.SOUND_CLIPS, STORES.TRIGGER_WORDS, STORES.SETTINGS, STORES.AUDIO_FILES];
    
    for (const storeName of stores) {
      const store = await this.getStore(storeName, 'readwrite');
      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }
}

// Create singleton instance
export const browserStorage = new BrowserStorage();