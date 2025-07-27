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

  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
  });

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const supported = !!SpeechRecognition;
    
    // Detect mobile devices
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isAndroid = /Android/i.test(navigator.userAgent);
    
    setIsSupported(supported);
    
    if (!supported) {
      if (isMobile) {
        setErrorMessage("Voice recognition has limited support on mobile devices. Works best on desktop Chrome or Edge.");
      } else {
        setErrorMessage("Speech recognition not supported in this browser. Use Chrome or Edge for best results.");
      }
    } else if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMessage("Microphone access not available. Please check browser permissions.");
    } else if (isAndroid) {
      setErrorMessage("Voice recognition may have limited functionality on Android. For best results, use desktop Chrome or Edge.");
    } else {
      setErrorMessage("");
    }
    
    console.log("Voice recognition support:", supported);
    console.log("Is mobile device:", isMobile);
    console.log("Is Android:", isAndroid);
    console.log("User agent:", navigator.userAgent);
  }, []);

  const initializeAudioAnalyzer = useCallback(async () => {
    try {
      console.log("Requesting microphone access...");
      
      // Detect mobile for optimized audio settings
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      const audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        // Mobile optimizations
        ...(isMobile && {
          sampleRate: 16000, // Lower sample rate for mobile
          channelCount: 1, // Mono audio for better mobile performance
          latency: 0.2 // Higher latency tolerance for mobile
        })
      };
      
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: audioConstraints
      });
      streamRef.current = stream;
      console.log("Microphone access granted with mobile optimizations:", isMobile);

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
    let triggerMatched = false;
    
    triggerWords.forEach((trigger) => {
      if (!trigger.enabled) return;
      
      const phrase = trigger.caseSensitive ? trigger.phrase : trigger.phrase.toLowerCase();
      const searchText = trigger.caseSensitive ? text : lowerText;
      
      if (searchText.includes(phrase)) {
        triggerMatched = true;
        
        // Implement cooldown to prevent rapid repeated triggers
        const cooldownKey = `${trigger.id}-${phrase}`;
        if (triggerCooldownRef.current.has(cooldownKey)) return;
        
        triggerCooldownRef.current.add(cooldownKey);
        setTimeout(() => {
          triggerCooldownRef.current.delete(cooldownKey);
        }, 2000); // 2 second cooldown
        
        // Get the next sound clip for this trigger (handles cycling through multiple clips)
        fetch(`/api/trigger-words/${trigger.id}/next-sound-clip`)
          .then(response => response.json())
          .then(data => {
            if (data.soundClipId) {
              const soundClip = soundClips.find(clip => clip.id === data.soundClipId);
              if (soundClip) {
                console.log("🎯 Trigger matched:", phrase, "-> Playing cycling sound:", soundClip.name);
                playSound(soundClip.url, soundClip.id, 0.75);
              }
            }
          })
          .catch(error => {
            console.error("Error getting next sound clip:", error);
            // Fallback: use first sound clip from soundClipIds array if API fails
            if (trigger.soundClipIds && trigger.soundClipIds.length > 0) {
              const soundClip = soundClips.find(clip => clip.id === trigger.soundClipIds[0]);
              if (soundClip) {
                console.log("🎯 Trigger matched:", phrase, "-> Playing fallback sound:", soundClip.name);
                playSound(soundClip.url, soundClip.id, 0.75);
              }
            }
          });
      }
    });

    // Check for default response if no triggers matched and speech was detected
    if (!triggerMatched && text.trim().length > 0 && settings?.defaultResponseEnabled && settings.defaultResponseSoundClipIds && settings.defaultResponseSoundClipIds.length > 0) {
      const cooldownKey = "default-response";
      if (!triggerCooldownRef.current.has(cooldownKey)) {
        triggerCooldownRef.current.add(cooldownKey);
        setTimeout(() => {
          triggerCooldownRef.current.delete(cooldownKey);
        }, settings.defaultResponseDelay || 2000);

        // Play next default response after a delay
        setTimeout(async () => {
          try {
            const response = await fetch("/api/settings/next-default-response");
            const data = await response.json();
            if (data.soundClipId) {
              const defaultSoundClip = soundClips.find(clip => clip.id === data.soundClipId);
              if (defaultSoundClip) {
                console.log("🔄 No trigger matched, playing next default response:", defaultSoundClip.name);
                playSound(defaultSoundClip.url, defaultSoundClip.id, 0.75);
              }
            }
          } catch (error) {
            console.error("Error getting next default response:", error);
          }
        }, settings.defaultResponseDelay || 2000);
      }
    }
  }, [triggerWords, soundClips, playSound, settings]);

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
      
      // Detect mobile for optimized speech recognition settings
      const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      const isAndroid = /Android/i.test(navigator.userAgent);
      
      // Mobile-optimized settings
      recognition.continuous = !isMobile; // Use non-continuous on mobile for better stability
      recognition.interimResults = true;
      recognition.lang = "en-US";
      
      // Android-specific optimizations
      if (isAndroid) {
        recognition.maxAlternatives = 1; // Reduce alternatives for better performance
        console.log("Applied Android-specific optimizations");
      }
      
      console.log("Speech recognition settings - Mobile:", isMobile, "Continuous:", recognition.continuous);

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
          
          // Mobile optimization: provide haptic feedback when trigger words are detected
          if (isMobile && navigator.vibrate) {
            // Check if any trigger word was matched (simplified check)
            const lowerText = finalTranscript.toLowerCase();
            const hasMatch = triggerWords.some(trigger => 
              trigger.enabled && lowerText.includes(trigger.caseSensitive ? trigger.phrase : trigger.phrase.toLowerCase())
            );
            if (hasMatch) {
              navigator.vibrate(200); // Trigger detected vibration
            }
          }
        }
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error, event);
        switch (event.error) {
          case "not-allowed":
            setErrorMessage("Microphone permission denied. Please allow microphone access.");
            setIsListening(false);
            break;
          case "no-speech":
            console.log("No speech detected, continuing to listen...");
            // Don't stop listening for no-speech, it's normal
            break;
          case "audio-capture":
            setErrorMessage("Audio capture failed. Check your microphone.");
            setIsListening(false);
            break;
          case "network":
            setErrorMessage("Network error. Check your internet connection.");
            setIsListening(false);
            break;
          case "aborted":
            console.log("Speech recognition was aborted, attempting to restart...");
            // Try to restart after a brief delay
            setTimeout(() => {
              if (isListening) {
                try {
                  recognition.start();
                } catch (e) {
                  console.error("Failed to restart after abort:", e);
                  setErrorMessage("Speech recognition stopped. Click Start to try again.");
                  setIsListening(false);
                }
              }
            }, 500);
            break;
          default:
            console.log(`Speech recognition error: ${event.error}, attempting to continue...`);
            // For other errors, try to continue unless critical
            if (event.error === "service-not-allowed" || event.error === "language-not-supported") {
              setErrorMessage(`Speech recognition error: ${event.error}`);
              setIsListening(false);
            }
        }
      };

      recognition.onend = () => {
        console.log("Speech recognition ended");
        if (isListening) {
          console.log("Restarting speech recognition...");
          
          // Different restart strategies for mobile vs desktop
          const restartDelay = isMobile ? 1000 : 500; // Longer delay on mobile
          
          setTimeout(() => {
            try {
              if (isListening && recognitionRef.current) {
                recognition.start();
              }
            } catch (e) {
              console.error("Failed to restart recognition:", e);
              
              // Mobile fallback: longer wait and simplified retry
              const fallbackDelay = isMobile ? 2000 : 1000;
              setTimeout(() => {
                if (isListening) {
                  try {
                    recognition.start();
                  } catch (e2) {
                    console.error("Failed to restart recognition after retry:", e2);
                    setErrorMessage(isMobile 
                      ? "Speech recognition stopped. Tap Stop and Start again if needed." 
                      : "Speech recognition stopped unexpectedly. Click Stop and Start again."
                    );
                    setIsListening(false);
                  }
                }
              }, fallbackDelay);
            }
          }, restartDelay);
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
    console.log("Stopping voice recognition...");
    
    // Stop speech recognition first
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.log("Recognition already stopped");
      }
      recognitionRef.current = null;
    }

    // Clean up audio resources
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          console.log("Track already stopped");
        }
      });
      streamRef.current = null;
    }

    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (e) {
        console.log("Audio context already closed");
      }
      audioContextRef.current = null;
    }

    setIsListening(false);
    setAudioLevel(-42);
    setErrorMessage("");
    console.log("Voice recognition stopped and cleaned up");
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
