import { useState, useRef, useCallback } from 'react';
import { browserStorage } from '@/lib/browser-storage';

export function useAudioPlayerBrowser() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const currentAudio = useRef<HTMLAudioElement | null>(null);

  const playSound = useCallback(async (filename: string) => {
    try {
      // Stop any currently playing audio
      if (currentAudio.current) {
        currentAudio.current.pause();
        currentAudio.current.currentTime = 0;
      }

      // Get audio blob from browser storage
      const audioBlob = await browserStorage.getAudioBlob(filename);
      if (!audioBlob) {
        console.error('Audio file not found:', filename);
        return;
      }

      // Create audio element
      const audio = new Audio();
      audio.volume = volume;
      
      // Create object URL for the blob
      const audioUrl = URL.createObjectURL(audioBlob);
      audio.src = audioUrl;
      
      // Set up event listeners
      audio.addEventListener('loadeddata', () => {
        setIsPlaying(true);
        audio.play().catch(console.error);
      });

      audio.addEventListener('ended', () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
        currentAudio.current = null;
      });

      audio.addEventListener('error', (e) => {
        console.error('Audio playback error:', e);
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
        currentAudio.current = null;
      });

      currentAudio.current = audio;
    } catch (error) {
      console.error('Error playing sound:', error);
      setIsPlaying(false);
    }
  }, [volume]);

  const stopSound = useCallback(() => {
    if (currentAudio.current) {
      currentAudio.current.pause();
      currentAudio.current.currentTime = 0;
      setIsPlaying(false);
    }
  }, []);

  const changeVolume = useCallback((newVolume: number) => {
    setVolume(newVolume);
    if (currentAudio.current) {
      currentAudio.current.volume = newVolume;
    }
  }, []);

  return {
    isPlaying,
    volume,
    playSound,
    stopSound,
    changeVolume,
  };
}