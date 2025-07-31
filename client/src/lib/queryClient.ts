import { QueryClient } from "@tanstack/react-query";
import { browserStorage } from "@/lib/browser-storage";

// Browser storage query function  
async function queryFn(context: { queryKey: readonly unknown[] }): Promise<any> {
  const { queryKey } = context;
  const [endpoint, ...params] = queryKey as string[];
  
  switch (endpoint) {
    case '/api/sound-clips':
      return browserStorage.getSoundClips();
    
    case '/api/trigger-words':
      return browserStorage.getTriggerWords();
    
    case '/api/settings':
      return browserStorage.getSettings();
    
    case '/api/sound-clip':
      if (params.length > 0) {
        const id = parseInt(params[0]);
        return browserStorage.getSoundClip(id);
      }
      throw new Error('Sound clip ID required');
    
    case '/api/trigger-word':
      if (params.length > 0) {
        const id = parseInt(params[0]);
        return browserStorage.getTriggerWord(id);
      }
      throw new Error('Trigger word ID required');
    
    default:
      throw new Error(`Unknown endpoint: ${endpoint}`);
  }
}

// Browser storage mutation function
export async function apiRequest(
  url: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: BodyInit;
  } = {},
): Promise<any> {
  const method = options.method || 'GET';
  let body = undefined;
  
  // Parse JSON body if it's a string
  if (options.body && typeof options.body === 'string') {
    try {
      body = JSON.parse(options.body);
    } catch {
      body = options.body;
    }
  } else if (options.body) {
    body = options.body;
  }
  
  // Handle different API endpoints
  if (url === '/api/trigger-words' && method === 'POST') {
    return browserStorage.createTriggerWord(body);
  }
  
  if (url.startsWith('/api/trigger-words/') && method === 'PUT') {
    const id = parseInt(url.split('/').pop()!);
    return browserStorage.updateTriggerWord(id, body);
  }
  
  if (url.startsWith('/api/trigger-words/') && method === 'DELETE') {
    const id = parseInt(url.split('/').pop()!);
    return browserStorage.deleteTriggerWord(id);
  }
  
  if (url.startsWith('/api/sound-clips/') && method === 'DELETE') {
    const id = parseInt(url.split('/').pop()!);
    return browserStorage.deleteSoundClip(id);
  }
  
  if (url === '/api/settings' && method === 'PUT') {
    return browserStorage.updateSettings(body);
  }
  
  if (url === '/api/profile/export') {
    return browserStorage.exportProfile();
  }
  
  if (url === '/api/profile/import' && method === 'POST') {
    return browserStorage.importProfile(body);
  }
  
  if (url === '/api/profile/clear' && method === 'POST') {
    return browserStorage.clearAllData();
  }
  
  throw new Error(`Unsupported API endpoint: ${method} ${url}`);
}

// Helper function for file uploads
export async function uploadSoundClip(file: File): Promise<any> {
  return browserStorage.createSoundClip(file);
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn,
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
    mutations: {
      retry: 1,
    },
  },
});