import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Mic, MicOff, Trash2, Smartphone, Video, Square, RotateCcw } from "lucide-react";
import { useVoiceRecognition } from "@/hooks/use-voice-recognition";
import { useConversationRecorder } from "@/hooks/use-conversation-recorder";
import AudioVisualizer from "@/components/audio-visualizer";
import type { Settings } from "@shared/schema";

export default function VoiceRecognition() {
  const {
    isListening,
    transcript,
    startListening,
    stopListening,
    clearTranscript,
    isSupported,
    audioLevel,
    errorMessage
  } = useVoiceRecognition();

  const [status, setStatus] = useState("Ready to Listen");
  const [isMobile, setIsMobile] = useState(false);
  const [recordingName, setRecordingName] = useState("");
  const [showRecordDialog, setShowRecordDialog] = useState(false);

  // Get settings to check if conversation recording is enabled
  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
  });

  const {
    isRecording,
    recordingTime,
    audioBlob,
    audioUrl,
    currentSize,
    startRecording,
    stopRecording,
    clearRecording,
    saveRecording,
    formatSize,
    getSizePercentage,
    maxSizeBytes,
    isUploading,
  } = useConversationRecorder({
    onRecordingSaved: () => {
      clearRecording();
      setRecordingName("");
      setShowRecordDialog(false);
    },
  });

  // Detect mobile device
  useEffect(() => {
    const mobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    setIsMobile(mobile);
  }, []);

  const toggleListening = async () => {
    // Haptic feedback for mobile devices
    if (isMobile && navigator.vibrate) {
      navigator.vibrate(50); // Short vibration
    }
    
    if (isListening) {
      stopListening();
      setStatus("Ready to Listen");
    } else {
      const success = await startListening();
      if (success) {
        setStatus(isMobile ? "Listening... (Tap to stop)" : "Listening for trigger words...");
        // Success haptic feedback
        if (isMobile && navigator.vibrate) {
          navigator.vibrate([50, 100, 50]); // Success pattern
        }
      } else {
        setStatus("Failed to start listening");
        // Error haptic feedback
        if (isMobile && navigator.vibrate) {
          navigator.vibrate([100, 50, 100, 50, 100]); // Error pattern
        }
      }
    }
  };

  const handleSaveRecording = () => {
    if (!recordingName.trim()) {
      return;
    }
    saveRecording(recordingName);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isSupported) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <p className="text-red-500 mb-4">Speech recognition is not supported in this browser.</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Please use Chrome or Edge for the best experience.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Voice Recognition
          <div className="flex items-center space-x-3">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">{status}</span>
            <div className={`w-3 h-3 rounded-full ${
              isListening ? "bg-green-500 animate-pulse" : "bg-gray-400"
            }`} />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Main Control Button */}
        <div className="text-center mb-6">
          <Button
            onClick={toggleListening}
            className={`${isMobile ? 'w-32 h-32' : 'w-24 h-24'} rounded-full text-white transition-all duration-200 touch-manipulation ${
              isListening 
                ? "bg-green-500 hover:bg-green-600 shadow-lg animate-pulse" 
                : "bg-green-500 hover:bg-green-600"
            }`}
          >
            {isListening ? <MicOff className={isMobile ? "h-10 w-10" : "h-8 w-8"} /> : <Mic className={isMobile ? "h-10 w-10" : "h-8 w-8"} />}
          </Button>
          
          {/* Mobile-optimized status */}
          <p className={`${isMobile ? 'text-base' : 'text-sm'} text-gray-600 dark:text-gray-400 mt-3 font-medium`}>
            {isListening 
              ? (isMobile ? "Tap to stop listening" : "Click to stop listening")
              : (isMobile ? "Tap to start listening" : "Click to start listening")
            }
          </p>
          
          {!isListening && (
            <div className="mt-2">
              <p className={`${isMobile ? 'text-sm' : 'text-xs'} text-gray-500 dark:text-gray-500`}>
                {isMobile ? "Voice recognition optimized for mobile!" : "Voice recognition is working! Upload sounds and create trigger words to test."}
              </p>
              {isMobile && (
                <div className="flex items-center justify-center mt-1 text-xs text-blue-600 dark:text-blue-400">
                  <Smartphone className="h-3 w-3 mr-1" />
                  Mobile mode active
                </div>
              )}
            </div>
          )}
        </div>

        {/* Audio Level Visualization */}
        <AudioVisualizer audioLevel={audioLevel} isListening={isListening} />

        {/* Error Message */}
        {errorMessage && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3 mb-4">
            <p className="text-yellow-700 dark:text-yellow-300 text-sm font-medium">{errorMessage}</p>
            {errorMessage.includes("Android") && (
              <div className="mt-3 text-xs text-yellow-600 dark:text-yellow-400 space-y-1">
                <p className="font-medium">💡 Android alternatives:</p>
                <p>• Use the recording feature to create sounds directly</p>
                <p>• Upload audio files from your device</p>
                <p>• Voice recognition works perfectly on desktop Chrome/Edge</p>
                <p>• All other features work normally on mobile</p>
              </div>
            )}
          </div>
        )}

        {/* Conversation Recording Controls */}
        {settings?.conversationRecordingEnabled && (
          <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <Video className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  Conversation Recording
                </span>
                {isRecording && (
                  <Badge variant="destructive" className="text-xs">
                    REC {formatTime(recordingTime)}
                  </Badge>
                )}
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400">
                {formatSize(currentSize)} / {formatSize(maxSizeBytes)}
              </div>
            </div>
            
            {!isRecording && !audioBlob && (
              <Dialog open={showRecordDialog} onOpenChange={setShowRecordDialog}>
                <DialogTrigger asChild>
                  <Button 
                    size="sm" 
                    className="bg-red-500 hover:bg-red-600 text-white w-full"
                  >
                    <Video className="h-4 w-4 mr-2" />
                    Start Conversation Recording
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Record Conversation</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="recordingName">Recording Name</Label>
                      <Input
                        id="recordingName"
                        value={recordingName}
                        onChange={(e) => setRecordingName(e.target.value)}
                        placeholder="Enter a name for your recording..."
                        className="mt-1"
                      />
                    </div>
                    <Button
                      onClick={() => {
                        startRecording();
                        setShowRecordDialog(false);
                      }}
                      className="bg-red-500 hover:bg-red-600 text-white w-full"
                      disabled={!recordingName.trim()}
                    >
                      <Video className="h-4 w-4 mr-2" />
                      Start Recording
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {isRecording && (
              <div className="space-y-2">
                <Progress value={getSizePercentage()} className="h-2" />
                <Button
                  onClick={stopRecording}
                  size="sm"
                  className="bg-gray-500 hover:bg-gray-600 text-white w-full"
                >
                  <Square className="h-4 w-4 mr-2" />
                  Stop Recording
                </Button>
              </div>
            )}

            {audioBlob && audioUrl && (
              <div className="space-y-3">
                <audio controls src={audioUrl} className="w-full" />
                <div className="text-xs text-gray-500 text-center">
                  Duration: {formatTime(recordingTime)} • Size: {formatSize(currentSize)}
                </div>
                <div className="flex space-x-2">
                  <Button
                    onClick={clearRecording}
                    variant="outline"
                    size="sm"
                    className="flex-1"
                  >
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Re-record
                  </Button>
                  <Button
                    onClick={handleSaveRecording}
                    disabled={!recordingName.trim() || isUploading}
                    className="bg-green-500 hover:bg-green-600 text-white flex-1"
                    size="sm"
                  >
                    Save Recording
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Live Transcript */}
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Live Transcript</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearTranscript}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear
            </Button>
          </div>
          <div className="min-h-16 max-h-32 overflow-y-auto">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {transcript || (isListening ? "Listening..." : "No speech detected")}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
