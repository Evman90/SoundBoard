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
  const [errorMessage, setErrorMessage] = useState("");
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
    const supported = !!SpeechRecognition;
    setIsSupported(supported);
    
    if (!supported) {
      setErrorMessage("Speech recognition not supported in this browser. Use Chrome or Edge for best results.");
    } else if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMessage("Microphone access not available. Please check browser permissions.");
    } else {
      setErrorMessage("");
    }
    
    console.log("Voice recognition support:", supported);
    console.log("User agent:", navigator.userAgent);
  }, []);

  const initializeAudioAnalyzer = useCallback(async () => {
    try {
      console.log("Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      streamRef.current = stream;
      console.log("Microphone access granted");

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
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
      setErrorMessage("");
    } catch (error: any) {
      console.error("Error accessing microphone:", error);
      if (error.name === 'NotAllowedError') {
        setErrorMessage("Microphone permission denied. Please allow microphone access and try again.");
      } else if (error.name === 'NotFoundError') {
        setErrorMessage("No microphone found. Please connect a microphone and try again.");
      } else {
        setErrorMessage(`Microphone error: ${error.message}`);
      }
      throw error;
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
    if (!isSupported) {
      setErrorMessage("Speech recognition not supported in this browser");
      return false;
    }

    try {
      console.log("Starting voice recognition...");
      await initializeAudioAnalyzer();

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        console.log("Speech recognition started");
        setErrorMessage("");
      };

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
        console.log("🎤 Speech detected:", fullTranscript);
        console.log("📝 Final transcript:", finalTranscript);
        console.log("⏳ Interim transcript:", interimTranscript);

        if (finalTranscript) {
          console.log("🔍 Checking for trigger words in:", finalTranscript);
          checkForTriggerWords(finalTranscript);
        }
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error, event);
        switch (event.error) {
          case "not-allowed":
            setErrorMessage("Microphone permission denied. Please allow microphone access.");
            break;
          case "no-speech":
            setErrorMessage("No speech detected. Try speaking louder.");
            break;
          case "audio-capture":
            setErrorMessage("Audio capture failed. Check your microphone.");
            break;
          case "network":
            setErrorMessage("Network error. Check your internet connection.");
            break;
          default:
            setErrorMessage(`Speech recognition error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        console.log("Speech recognition ended");
        if (isListening) {
          console.log("Restarting speech recognition...");
          setTimeout(() => {
            try {
              if (isListening && recognitionRef.current) {
                recognition.start();
              }
            } catch (e) {
              console.error("Failed to restart recognition:", e);
              setIsListening(false);
            }
          }, 100);
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsListening(true);
      console.log("Voice recognition initialized successfully");
      return true;
    } catch (error: any) {
      console.error("Failed to start voice recognition:", error);
      setErrorMessage(`Failed to start: ${error.message}`);
      setIsListening(false);
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
    errorMessage,
    startListening,
    stopListening,
    clearTranscript,
  };
}
