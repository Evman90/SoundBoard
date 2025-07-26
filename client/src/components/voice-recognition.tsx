import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mic, MicOff, Trash2 } from "lucide-react";
import { useVoiceRecognition } from "@/hooks/use-voice-recognition";
import AudioVisualizer from "@/components/audio-visualizer";

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

  const toggleListening = async () => {
    if (isListening) {
      stopListening();
      setStatus("Ready to Listen");
    } else {
      const success = await startListening();
      if (success) {
        setStatus("Listening for trigger words...");
      } else {
        setStatus("Failed to start listening");
      }
    }
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
            className={`w-24 h-24 rounded-full text-white transition-all duration-200 ${
              isListening 
                ? "bg-green-500 hover:bg-green-600 shadow-lg animate-pulse" 
                : "bg-green-500 hover:bg-green-600"
            }`}
          >
            {isListening ? <MicOff className="h-8 w-8" /> : <Mic className="h-8 w-8" />}
          </Button>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-3">
            {isListening ? "Click to stop listening" : "Click to start listening"}
          </p>
          {!isListening && (
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
              Voice recognition is working! Upload sounds and create trigger words to test.
            </p>
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
