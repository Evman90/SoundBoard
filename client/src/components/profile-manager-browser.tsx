import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Download, Upload, FileJson } from 'lucide-react';
import { browserStorage } from '@/lib/browser-storage';
import { useQueryClient } from '@tanstack/react-query';

export function ProfileManagerBrowser() {
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const profileData = await browserStorage.exportProfile();
      
      const blob = new Blob([JSON.stringify(profileData, null, 2)], {
        type: 'application/json',
      });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `callsound-profile-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Profile exported",
        description: "Your profile has been downloaded successfully.",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: "Failed to export profile",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async () => {
    if (!importFile) return;
    
    setIsImporting(true);
    try {
      const text = await importFile.text();
      const profileData = JSON.parse(text);
      
      await browserStorage.importProfile(profileData);
      
      // Invalidate all queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['/api/sound-clips'] });
      queryClient.invalidateQueries({ queryKey: ['/api/trigger-words'] });
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      
      setImportFile(null);
      toast({
        title: "Profile imported",
        description: "Your profile has been loaded successfully.",
      });
    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Import failed",
        description: "Failed to import profile. Please check the file format.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const handleClearData = async () => {
    try {
      await browserStorage.clearAllData();
      
      // Invalidate all queries to refresh the UI
      queryClient.invalidateQueries({ queryKey: ['/api/sound-clips'] });
      queryClient.invalidateQueries({ queryKey: ['/api/trigger-words'] });
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      
      toast({
        title: "Data cleared",
        description: "All sound clips and settings have been cleared.",
      });
    } catch (error) {
      console.error('Clear data error:', error);
      toast({
        title: "Clear failed",
        description: "Failed to clear data",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileJson className="h-5 w-5" />
            Profile Management
          </CardTitle>
          <CardDescription>
            Export your current soundboard or import a previously saved profile.
            All data is stored locally in your browser.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Export Section */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Export Profile</Label>
            <p className="text-sm text-muted-foreground">
              Download all your sound clips, trigger words, and settings as a JSON file.
            </p>
            <Button 
              onClick={handleExport} 
              disabled={isExporting}
              className="w-full"
            >
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? "Exporting..." : "Export Profile"}
            </Button>
          </div>

          <Separator />

          {/* Import Section */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Import Profile</Label>
            <p className="text-sm text-muted-foreground">
              Upload a previously exported profile file to restore your soundboard.
            </p>
            <Input
              type="file"
              accept=".json"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              className="w-full"
            />
            <Button 
              onClick={handleImport} 
              disabled={!importFile || isImporting}
              variant="outline"
              className="w-full"
            >
              <Upload className="mr-2 h-4 w-4" />
              {isImporting ? "Importing..." : "Import Profile"}
            </Button>
          </div>

          <Separator />

          {/* Clear Data Section */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-destructive">Clear All Data</Label>
            <p className="text-sm text-muted-foreground">
              Remove all sound clips, trigger words, and settings. This action cannot be undone.
            </p>
            <Button 
              onClick={handleClearData}
              variant="destructive"
              className="w-full"
            >
              Clear All Data
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}