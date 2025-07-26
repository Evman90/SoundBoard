import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { Download, Upload, Trash2, FileJson } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';

export function ProfileManager() {
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const { toast } = useToast();

  const handleExportProfile = async () => {
    try {
      setIsExporting(true);
      
      const response = await fetch('/api/profile/export');
      if (!response.ok) {
        throw new Error('Failed to export profile');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Get filename from response headers or use default
      const contentDisposition = response.headers.get('content-disposition');
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `callsound-profile-${new Date().toISOString().split('T')[0]}.json`;
      
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Profile exported successfully",
        description: "Your soundboard profile has been downloaded to your computer.",
      });
    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: "Export failed",
        description: "Could not export your profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportProfile = async () => {
    if (!importFile) {
      toast({
        title: "No file selected",
        description: "Please select a profile file to import.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsImporting(true);

      const formData = new FormData();
      formData.append('profile', importFile);

      const response = await fetch('/api/profile/import', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to import profile');
      }

      // Invalidate all queries to refresh the UI
      await queryClient.invalidateQueries();

      toast({
        title: "Profile imported successfully",
        description: "Your soundboard profile has been restored. The page will refresh to show your imported data.",
      });

      // Refresh the page to show imported data
      setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (error) {
      console.error('Import error:', error);
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Could not import profile. Please check the file format and try again.",
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
      setImportFile(null);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        setImportFile(file);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please select a JSON profile file.",
          variant: "destructive",
        });
        event.target.value = '';
      }
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileJson className="h-5 w-5" />
          Profile Management
        </CardTitle>
        <CardDescription>
          Export your sound clips, trigger words, and settings to take them with you, or import a previously saved profile.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Export Section */}
        <div className="space-y-3">
          <div>
            <h3 className="text-lg font-medium">Export Profile</h3>
            <p className="text-sm text-muted-foreground">
              Download all your sound clips, trigger words, and settings as a portable file.
            </p>
          </div>
          <Button 
            onClick={handleExportProfile} 
            disabled={isExporting}
            className="w-full sm:w-auto"
          >
            <Download className="mr-2 h-4 w-4" />
            {isExporting ? "Exporting..." : "Export Profile"}
          </Button>
        </div>

        <Separator />

        {/* Import Section */}
        <div className="space-y-3">
          <div>
            <h3 className="text-lg font-medium">Import Profile</h3>
            <p className="text-sm text-muted-foreground">
              Upload a previously saved profile file to restore your sound clips and settings.
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-1">
              ⚠️ Warning: This will replace all current data with the imported profile.
            </p>
          </div>
          
          <div className="space-y-3">
            <div>
              <Label htmlFor="profile-file">Select Profile File</Label>
              <Input
                id="profile-file"
                type="file"
                accept=".json,application/json"
                onChange={handleFileChange}
                className="mt-1"
              />
            </div>
            
            {importFile && (
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm">
                  <strong>Selected file:</strong> {importFile.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  Size: {(importFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  disabled={!importFile || isImporting}
                  variant="destructive"
                  className="w-full sm:w-auto"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  {isImporting ? "Importing..." : "Import Profile"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Import Profile</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently replace all your current sound clips, trigger words, and settings with the data from the selected profile file. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleImportProfile}>
                    Import Profile
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <Separator />

        {/* Info Section */}
        <div className="space-y-3">
          <div>
            <h3 className="text-lg font-medium">About Profiles</h3>
            <div className="text-sm text-muted-foreground space-y-2">
              <p>
                • Profile files contain all your sound clips (including audio data), trigger words, and app settings
              </p>
              <p>
                • Files are saved in JSON format and can be shared between different devices or users
              </p>
              <p>
                • Audio files are embedded as base64 data, so profiles can be large depending on your sound library
              </p>
              <p>
                • Always export your profile before making major changes as a backup
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}