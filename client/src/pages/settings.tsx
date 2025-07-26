import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DefaultResponseSettings } from '@/components/default-response-settings';
import { ProfileManager } from '@/components/profile-manager';
import { Settings as SettingsIcon, FileJson, Volume2 } from 'lucide-react';

export function SettingsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          <SettingsIcon className="h-8 w-8" />
          Settings
        </h1>
        <p className="text-muted-foreground">
          Configure your soundboard settings and manage your profiles.
        </p>
      </div>

      <Tabs defaultValue="audio" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="audio" className="flex items-center gap-2">
            <Volume2 className="h-4 w-4" />
            Audio Settings
          </TabsTrigger>
          <TabsTrigger value="profiles" className="flex items-center gap-2">
            <FileJson className="h-4 w-4" />
            Profiles
          </TabsTrigger>
        </TabsList>

        <TabsContent value="audio" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Default Response Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <DefaultResponseSettings />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profiles" className="mt-6">
          <ProfileManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}