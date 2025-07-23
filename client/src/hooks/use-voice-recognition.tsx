import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAudioPlayer } from "./use-audio-player";
import type { TriggerWord, SoundClip } from "@shared/schema";

interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: (event: SpeechRecognitionEvent) => void;
  onerror: (event: any) => void;
  onend: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

export function useVoiceRecognition() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [audioLevel, setAudioLevel] = useState(-42);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const triggerCooldownRef = useRef<Set<string>>(new Set());
  const { playSound } = useAudioPlayer();

  const { data: triggerWords = [] } = useQuery<TriggerWord[]>({
    queryKey: ["/api/trigger-words"],
  });

  const { data: soundClips = [] } = useQuery<SoundClip[]>({
    queryKey: ["/api/sound-clips"],
  });

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
  }, []);

  const initializeAudioAnalyzer = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const updateAudioLevel = () => {
        if (!analyser) return;

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);

        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        const db = 20 * Math.log10(average / 255) || -60;
        setAudioLevel(Math.max(db, -60));

        if (isListening) {
          requestAnimationFrame(updateAudioLevel);
        }
      };

      updateAudioLevel();
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  }, [isListening]);

  const checkForTriggerWords = useCallback((text: string) => {
    const lowerText = text.toLowerCase();
    
    triggerWords.forEach((trigger) => {
      if (!trigger.enabled) return;
      
      const phrase = trigger.caseSensitive ? trigger.phrase : trigger.phrase.toLowerCase();
      const searchText = trigger.caseSensitive ? text : lowerText;
      
      if (searchText.includes(phrase)) {
        // Implement cooldown to prevent rapid repeated triggers
        const cooldownKey = `${trigger.id}-${phrase}`;
        if (triggerCooldownRef.current.has(cooldownKey)) return;
        
        triggerCooldownRef.current.add(cooldownKey);
        setTimeout(() => {
          triggerCooldownRef.current.delete(cooldownKey);
        }, 2000); // 2 second cooldown
        
        // Find and play the associated sound
        const soundClip = soundClips.find(clip => clip.id === trigger.soundClipId);
        if (soundClip) {
          playSound(soundClip.url, soundClip.id, 0.75); // Play at 75% volume
        }
      }
    });
  }, [triggerWords, soundClips, playSound]);

  const startListening = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;

    try {
      await initializeAudioAnalyzer();

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalTranscript = "";
        let interimTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        const fullTranscript = finalTranscript || interimTranscript;
        setTranscript(fullTranscript);

        if (finalTranscript) {
          checkForTriggerWords(finalTranscript);
        }
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        if (isListening) {
          // Restart recognition if it stops unexpectedly
          recognition.start();
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
      return true;
    } catch (error) {
      console.error("Failed to start voice recognition:", error);
      return false;
    }
  }, [isSupported, initializeAudioAnalyzer, checkForTriggerWords, isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsListening(false);
    setAudioLevel(-42);
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript("");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, [stopListening]);

  return {
    isListening,
    transcript,
    audioLevel,
    isSupported,
    startListening,
    stopListening,
    clearTranscript,
  };
}
