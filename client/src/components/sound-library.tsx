import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Upload, Play, Pause, Edit, Trash2, Search } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAudioPlayer } from "@/hooks/use-audio-player";
import type { SoundClip } from "@shared/schema";

export default function SoundLibrary() {
  const [searchTerm, setSearchTerm] = useState("");
  const [masterVolume, setMasterVolume] = useState(75);
  const [micSensitivity, setMicSensitivity] = useState(50);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { playSound, stopSound, currentlyPlaying, stopAllSounds } = useAudioPlayer();

  const { data: soundClips = [], isLoading } = useQuery<SoundClip[]>({
    queryKey: ["/api/sound-clips"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await apiRequest("POST", "/api/sound-clips", formData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sound-clips"] });
      toast({
        title: "Success",
        description: "Sound clip uploaded successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to upload sound clip",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/sound-clips/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sound-clips"] });
      toast({
        title: "Success",
        description: "Sound clip deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete sound clip",
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("audio", file);
    formData.append("name", file.name.replace(/\.[^/.]+$/, ""));
    
    // Get audio duration
    const audio = new Audio();
    audio.src = URL.createObjectURL(file);
    
    audio.addEventListener('loadedmetadata', () => {
      formData.append("duration", audio.duration.toString());
      uploadMutation.mutate(formData);
      URL.revokeObjectURL(audio.src);
    });
  };

  const filteredSoundClips = soundClips.filter(clip =>
    clip.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    return `${seconds.toFixed(1)}s`;
  };

  return (
    <div className="space-y-6">
      {/* Quick Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Controls</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Master Volume */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Master Volume</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">{masterVolume}%</span>
            </div>
            <Input
              type="range"
              min="0"
              max="100"
              value={masterVolume}
              onChange={(e) => setMasterVolume(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Microphone Sensitivity */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Mic Sensitivity</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {micSensitivity < 33 ? "Low" : micSensitivity < 67 ? "Medium" : "High"}
              </span>
            </div>
            <Input
              type="range"
              min="0"
              max="100"
              value={micSensitivity}
              onChange={(e) => setMicSensitivity(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Quick Actions */}
          <div className="flex space-x-2">
            <Button
              onClick={stopAllSounds}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white"
              size="sm"
            >
              <Pause className="h-4 w-4 mr-1" />
              Stop All
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              size="sm"
              onClick={() => {
                if (soundClips.length > 0) {
                  const randomClip = soundClips[Math.floor(Math.random() * soundClips.length)];
                  playSound(randomClip.url, randomClip.id, masterVolume / 100);
                }
              }}
            >
              Test
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Sound Library */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Sound Library
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="bg-primary hover:bg-primary-dark text-white"
              size="sm"
              disabled={uploadMutation.isPending}
            >
              <Upload className="h-4 w-4 mr-1" />
              Upload
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,.wav,.ogg"
            onChange={handleFileUpload}
            className="hidden"
          />

          {/* Search/Filter */}
          <div className="mb-4">
            <div className="relative">
              <Input
                type="text"
                placeholder="Search sounds..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            </div>
          </div>

          {/* Sound Cards */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="text-center py-4">
                <p className="text-gray-500">Loading sounds...</p>
              </div>
            ) : filteredSoundClips.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-2">No sound clips found</p>
                <p className="text-sm text-gray-400">
                  {searchTerm ? "Try a different search term" : "Upload your first sound clip to get started"}
                </p>
              </div>
            ) : (
              filteredSoundClips.map((clip) => (
                <div
                  key={clip.id}
                  className={`bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border transition-all ${
                    currentlyPlaying === clip.id
                      ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20"
                      : "border-gray-200 dark:border-gray-600 hover:shadow-md"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                      {clip.name}
                    </h4>
                    <div className="flex items-center space-x-1">
                      {currentlyPlaying === clip.id ? (
                        <span className="text-xs bg-orange-500 text-white px-2 py-1 rounded-full">
                          PLAYING
                        </span>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => 
                          currentlyPlaying === clip.id 
                            ? stopSound() 
                            : playSound(clip.url, clip.id, masterVolume / 100)
                        }
                        className="text-primary hover:text-primary-dark"
                      >
                        {currentlyPlaying === clip.id ? (
                          <Pause className="h-4 w-4" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteMutation.mutate(clip.id)}
                        className="text-gray-500 hover:text-red-500"
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>{formatDuration(clip.duration)}</span>
                    <span>{formatFileSize(clip.size)}</span>
                    <span className="bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded uppercase">
                      {clip.format}
                    </span>
                  </div>
                  {currentlyPlaying === clip.id && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1">
                        <div className="bg-orange-500 h-1 rounded-full animate-pulse" style={{ width: "45%" }} />
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Browser Compatibility Status */}
      <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700">
        <CardContent className="pt-4">
          <div className="flex items-start space-x-3">
            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h4 className="font-medium text-blue-900 dark:text-blue-100 text-sm mb-1">Browser Support</h4>
              <p className="text-xs text-blue-700 dark:text-blue-200 mb-2">
                Web Speech API works best in Chrome/Edge. Safari and Firefox have limited support.
              </p>
              <div className="flex items-center space-x-4 text-xs">
                <span className="flex items-center text-green-600 dark:text-green-400">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span>Chrome ✓
                </span>
                <span className="flex items-center text-yellow-600 dark:text-yellow-400">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></span>Safari ~
                </span>
                <span className="flex items-center text-red-600 dark:text-red-400">
                  <span className="w-2 h-2 bg-red-500 rounded-full mr-1"></span>Firefox ✗
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
