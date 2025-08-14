// Tauri API 客户端
export interface Profile {
  id?: string; // UUID string from backend
  name: string;
  phone: string;
  email: string;
  idCardNumber: string;
  idCardFiles?: string[] | string; // Can be array (frontend) or JSON string (backend)
  createdAt?: string;
  updatedAt?: string;
}

export interface IpAsset {
  id?: string; // UUID string from backend
  workName: string;
  workType: string;
  owner: string;
  region: string;
  workStartDate: string;
  workEndDate: string;
  equityType: string;
  isAgent: boolean;
  authStartDate?: string;
  authEndDate?: string;
  authFiles?: string[] | string; // Can be array (frontend) or JSON string (backend)
  workProofFiles?: string[] | string; // Can be array (frontend) or JSON string (backend)
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Case {
  id?: string; // UUID string from backend
  infringingUrl: string;
  originalUrl?: string;
  associatedIpId?: string; // UUID string from backend
  status: string;
  submissionDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AutomationStatus {
  isRunning: boolean;
  currentStep?: string;
  progress?: number;
  error?: string;
  startedAt?: string;
}

export interface FileSelection {
  paths: string[];
}

class TauriAPI {
  private isTauri: boolean;

  constructor() {
    // 在服务器端渲染时，默认为false
    const inBrowser = typeof window !== 'undefined';
    const hasTauriInternals = inBrowser && '__TAURI_INTERNALS__' in window;
    
    console.log('[TauriAPI] Environment check:');
    console.log('  - inBrowser:', inBrowser);
    console.log('  - hasTauriInternals:', hasTauriInternals);
    console.log('  - window.navigator.userAgent:', inBrowser ? window.navigator.userAgent : 'N/A');
    console.log('  - window object keys with TAURI:', inBrowser ? Object.keys(window).filter(k => k.includes('TAURI')).join(', ') : 'N/A');
    
    // Additional debug info
    if (inBrowser) {
      console.log('  - window.__TAURI_INTERNALS__:', window.__TAURI_INTERNALS__ ? 'exists' : 'missing');
      console.log('  - process.env.NODE_ENV:', process.env.NODE_ENV);
    }
    
    this.isTauri = hasTauriInternals;
    console.log('[TauriAPI] Final isTauri decision:', this.isTauri);
  }

  // 检查是否在Tauri环境中
  isInTauri(): boolean {
    return this.isTauri;
  }

  // 个人档案相关API
  async getProfile(): Promise<Profile | null> {
    console.log('[TauriAPI] getProfile called, isTauri:', this.isTauri);
    
    if (!this.isTauri) {
      // Mock data for web environment
      console.log('[TauriAPI] Using mock profile data - not in Tauri environment');
      return {
        name: "张三",
        phone: "13800138000",
        email: "zhangsan@example.com",
        idCardNumber: "110101199001011234",
        idCardFiles: ["身份证正面.jpg", "身份证反面.jpg"]
      };
    }
    
    try {
      console.log('[TauriAPI] Importing Tauri invoke function for getProfile...');
      const { invoke } = await import('@tauri-apps/api/core');
      
      console.log('[TauriAPI] Calling get_profile command...');
      const rawProfile = await invoke<Profile>('get_profile');
      console.log('[TauriAPI] Raw profile from backend:', rawProfile);
      
      if (rawProfile) {
        // Parse idCardFiles JSON string into array if it exists
        let processedProfile = { ...rawProfile };
        if (rawProfile.idCardFiles && typeof rawProfile.idCardFiles === 'string') {
          try {
            processedProfile.idCardFiles = JSON.parse(rawProfile.idCardFiles);
            console.log('[TauriAPI] Parsed idCardFiles:', processedProfile.idCardFiles);
          } catch (parseError) {
            console.warn('[TauriAPI] Failed to parse idCardFiles JSON, using as string:', parseError);
            // Keep as string if JSON parsing fails
          }
        }
        
        console.log('[TauriAPI] Processed profile:', processedProfile);
        return processedProfile;
      }
      
      console.log('[TauriAPI] No profile found in database');
      return null;
    } catch (error) {
      console.error('[TauriAPI] Failed to get profile:', error);
      return null;
    }
  }

  async saveProfile(profile: Omit<Profile, 'createdAt' | 'updatedAt'>): Promise<Profile> {
    console.log('[TauriAPI] saveProfile called, isTauri:', this.isTauri);
    console.log('[TauriAPI] Profile to save:', profile);
    
    if (!this.isTauri) {
      // Mock save for web environment
      console.log('[TauriAPI] Using mock save - not in Tauri environment');
      alert('模拟环境：个人档案已保存！(数据不会真正保存)');
      return { ...profile, id: Date.now().toString() };
    }
    
    try {
      console.log('[TauriAPI] Importing Tauri invoke function...');
      const { invoke } = await import('@tauri-apps/api/core');
      console.log('[TauriAPI] Tauri invoke function imported successfully');
      
      // Prepare profile data for backend
      const profileData = { ...profile };
      
      // Convert idCardFiles array to JSON string if it's an array
      if (profile.idCardFiles) {
        if (Array.isArray(profile.idCardFiles)) {
          profileData.idCardFiles = JSON.stringify(profile.idCardFiles);
          console.log('[TauriAPI] Converted idCardFiles array to JSON string:', profileData.idCardFiles);
        } else {
          console.log('[TauriAPI] idCardFiles is already a string:', profileData.idCardFiles);
        }
      } else {
        profileData.idCardFiles = undefined;
        console.log('[TauriAPI] No idCardFiles to process');
      }
      
      console.log('[TauriAPI] Final profile data for backend:', profileData);
      console.log('[TauriAPI] About to call save_profile command...');
      
      const startTime = Date.now();
      const result = await invoke<Profile>('save_profile', { profile: profileData });
      const endTime = Date.now();
      
      console.log('[TauriAPI] Save command completed in', endTime - startTime, 'ms');
      console.log('[TauriAPI] Save successful, raw result:', result);
      console.log('[TauriAPI] Result type:', typeof result, 'keys:', result ? Object.keys(result) : 'null/undefined');
      
      // Process the returned profile to parse idCardFiles back to array
      if (result && result.idCardFiles && typeof result.idCardFiles === 'string') {
        try {
          result.idCardFiles = JSON.parse(result.idCardFiles);
          console.log('[TauriAPI] Parsed returned idCardFiles:', result.idCardFiles);
        } catch (parseError) {
          console.warn('[TauriAPI] Failed to parse returned idCardFiles JSON:', parseError);
        }
      }
      
      console.log('[TauriAPI] Final processed result:', result);
      return result;
    } catch (error) {
      console.error('[TauriAPI] Failed to save profile - DETAILED ERROR LOG:');
      console.error('[TauriAPI] Error type:', typeof error);
      console.error('[TauriAPI] Error constructor:', error?.constructor?.name);
      console.error('[TauriAPI] Error message:', error instanceof Error ? error.message : String(error));
      console.error('[TauriAPI] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('[TauriAPI] Full error object:', error);
      
      // Try to extract more details from Tauri-specific errors
      if (error && typeof error === 'object') {
        console.error('[TauriAPI] Error properties:', Object.getOwnPropertyNames(error));
        console.error('[TauriAPI] Error details:', {
          name: (error as any).name,
          message: (error as any).message,
          stack: (error as any).stack,
          cause: (error as any).cause,
          code: (error as any).code
        });
      }
      
      throw error;
    }
  }

  // IP资产相关API
  async getIpAssets(): Promise<IpAsset[]> {
    console.log('[TauriAPI] getIpAssets called, isTauri:', this.isTauri);
    
    if (!this.isTauri) {
      // Mock data for web environment
      console.log('[TauriAPI] Using mock IP assets data - not in Tauri environment');
      return [
        {
          id: '1',
          workName: '原创视频作品',
          workType: '视频',
          owner: '张三',
          region: '中国大陆',
          workStartDate: '2024-01-01',
          workEndDate: '2034-01-01',
          equityType: '著作权',
          isAgent: false,
          authStartDate: '2024-01-01',
          authEndDate: '2024-12-31',
          status: '已认证'
        },
        {
          id: '2',
          workName: '音乐作品集',
          workType: '音乐',
          owner: '张三',
          region: '中国大陆',
          workStartDate: '2023-06-01',
          workEndDate: '2033-06-01',
          equityType: '著作权',
          isAgent: false,
          authStartDate: '2023-06-01',
          authEndDate: '2024-06-01',
          status: '已认证'
        }
      ];
    }
    
    try {
      console.log('[TauriAPI] Importing Tauri invoke function for getIpAssets...');
      const { invoke } = await import('@tauri-apps/api/core');
      
      console.log('[TauriAPI] Calling get_ip_assets command...');
      const rawAssets = await invoke<IpAsset[]>('get_ip_assets');
      console.log('[TauriAPI] Raw IP assets from backend:', rawAssets);
      
      // Process each asset to parse JSON file arrays
      const processedAssets = rawAssets.map(asset => {
        const processed = { ...asset };
        
        // Parse authFiles if it's a JSON string
        if (asset.authFiles && typeof asset.authFiles === 'string') {
          try {
            processed.authFiles = JSON.parse(asset.authFiles);
          } catch (parseError) {
            console.warn('[TauriAPI] Failed to parse authFiles JSON for asset', asset.id, parseError);
          }
        }
        
        // Parse workProofFiles if it's a JSON string
        if (asset.workProofFiles && typeof asset.workProofFiles === 'string') {
          try {
            processed.workProofFiles = JSON.parse(asset.workProofFiles);
          } catch (parseError) {
            console.warn('[TauriAPI] Failed to parse workProofFiles JSON for asset', asset.id, parseError);
          }
        }
        
        return processed;
      });
      
      console.log('[TauriAPI] Processed IP assets:', processedAssets);
      return processedAssets;
    } catch (error) {
      console.error('[TauriAPI] Failed to get IP assets:', error);
      return [];
    }
  }

  async getIpAsset(id: string): Promise<IpAsset | null> {
    if (!this.isTauri) {
      // Mock data for web environment
      return null;
    }
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<IpAsset>('get_ip_asset', { id });
    } catch (error) {
      console.error('Failed to get IP asset:', error);
      return null;
    }
  }

  async saveIpAsset(asset: Omit<IpAsset, 'createdAt' | 'updatedAt'>): Promise<IpAsset> {
    console.log('[TauriAPI] saveIpAsset called, isTauri:', this.isTauri);
    console.log('[TauriAPI] IP asset to save:', asset);
    
    if (!this.isTauri) {
      // Mock save for web environment
      console.log('[TauriAPI] Using mock save - not in Tauri environment');
      alert('IP资产已保存！');
      return { ...asset, id: Date.now().toString() };
    }
    
    try {
      console.log('[TauriAPI] Importing Tauri invoke function...');
      const { invoke } = await import('@tauri-apps/api/core');
      
      // Prepare asset data for backend
      const assetData = { ...asset };
      
      // Convert authFiles array to JSON string if it's an array
      if (asset.authFiles) {
        if (Array.isArray(asset.authFiles)) {
          assetData.authFiles = JSON.stringify(asset.authFiles);
          console.log('[TauriAPI] Converted authFiles array to JSON string:', assetData.authFiles);
        } else {
          console.log('[TauriAPI] authFiles is already a string:', assetData.authFiles);
        }
      } else {
        assetData.authFiles = undefined;
      }
      
      // Convert workProofFiles array to JSON string if it's an array
      if (asset.workProofFiles) {
        if (Array.isArray(asset.workProofFiles)) {
          assetData.workProofFiles = JSON.stringify(asset.workProofFiles);
          console.log('[TauriAPI] Converted workProofFiles array to JSON string:', assetData.workProofFiles);
        } else {
          console.log('[TauriAPI] workProofFiles is already a string:', assetData.workProofFiles);
        }
      } else {
        assetData.workProofFiles = undefined;
      }
      
      console.log('[TauriAPI] Final asset data for backend:', assetData);
      console.log('[TauriAPI] Calling save_ip_asset command...');
      
      const result = await invoke<IpAsset>('save_ip_asset', { asset: assetData });
      console.log('[TauriAPI] Save successful, raw result:', result);
      
      // Process the returned asset to parse file arrays back from JSON
      if (result) {
        if (result.authFiles && typeof result.authFiles === 'string') {
          try {
            result.authFiles = JSON.parse(result.authFiles);
            console.log('[TauriAPI] Parsed returned authFiles:', result.authFiles);
          } catch (parseError) {
            console.warn('[TauriAPI] Failed to parse returned authFiles JSON:', parseError);
          }
        }
        
        if (result.workProofFiles && typeof result.workProofFiles === 'string') {
          try {
            result.workProofFiles = JSON.parse(result.workProofFiles);
            console.log('[TauriAPI] Parsed returned workProofFiles:', result.workProofFiles);
          } catch (parseError) {
            console.warn('[TauriAPI] Failed to parse returned workProofFiles JSON:', parseError);
          }
        }
      }
      
      console.log('[TauriAPI] Final processed result:', result);
      return result;
    } catch (error) {
      console.error('[TauriAPI] Failed to save IP asset:', error);
      console.error('[TauriAPI] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        type: typeof error,
        error
      });
      throw error;
    }
  }

  async deleteIpAsset(id: string): Promise<boolean> {
    if (!this.isTauri) {
      // Mock delete for web environment
      if (confirm('确定要删除这个IP资产吗？')) {
        alert('IP资产已删除！');
        return true;
      }
      return false;
    }
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<boolean>('delete_ip_asset', { id });
    } catch (error) {
      console.error('Failed to delete IP asset:', error);
      return false;
    }
  }

  // 案件相关API
  async getCases(): Promise<Case[]> {
    if (!this.isTauri) {
      // Mock data for web environment
      return [
        {
          id: '1',
          infringingUrl: 'https://www.bilibili.com/video/BV1234567890',
          originalUrl: 'https://www.bilibili.com/video/BV0987654321',
          associatedIpId: '1',
          status: '已提交',
          submissionDate: new Date().toISOString()
        }
      ];
    }
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<Case[]>('get_cases');
    } catch (error) {
      console.error('Failed to get cases:', error);
      return [];
    }
  }

  async saveCase(caseData: Omit<Case, 'id' | 'createdAt' | 'updatedAt'>): Promise<Case> {
    if (!this.isTauri) {
      // Mock save for web environment
      alert('案件已保存！');
      return { ...caseData, id: Date.now().toString() };
    }
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<Case>('save_case', { case: caseData });
    } catch (error) {
      console.error('Failed to save case:', error);
      throw error;
    }
  }

  async deleteCase(id: string): Promise<boolean> {
    if (!this.isTauri) {
      // Mock delete for web environment
      if (confirm('确定要删除这个案件吗？')) {
        alert('案件已删除！');
        return true;
      }
      return false;
    }
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<boolean>('delete_case', { id });
    } catch (error) {
      console.error('Failed to delete case:', error);
      return false;
    }
  }

  // 自动化相关API
  async startAutomation(
    infringingUrl: string,
    originalUrl?: string,
    ipAssetId?: string
  ): Promise<void> {
    if (!this.isTauri) {
      // Mock automation for web environment
      alert(`开始自动化申诉流程！\n侵权链接：${infringingUrl}\n原创链接：${originalUrl || '未提供'}`);
      return;
    }
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('start_automation', {
        infringingUrl,
        originalUrl,
        ipAssetId
      });
    } catch (error) {
      console.error('Failed to start automation:', error);
      throw error;
    }
  }

  async stopAutomation(): Promise<void> {
    if (!this.isTauri) {
      // Mock stop for web environment
      alert('自动化流程已停止！');
      return;
    }
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('stop_automation');
    } catch (error) {
      console.error('Failed to stop automation:', error);
      throw error;
    }
  }

  async getAutomationStatus(): Promise<AutomationStatus> {
    if (!this.isTauri) {
      // Mock status for web environment
      return {
        isRunning: false,
        currentStep: '完成',
        progress: 100
      };
    }
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<AutomationStatus>('get_automation_status');
    } catch (error) {
      console.error('Failed to get automation status:', error);
      return {
        isRunning: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // 文件相关API
  async selectFile(): Promise<FileSelection> {
    if (!this.isTauri) {
      // Mock file selection for web environment
      return { paths: ['mock_file_path.jpg'] };
    }
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<FileSelection>('select_file');
    } catch (error) {
      console.error('Failed to select file:', error);
      return { paths: [] };
    }
  }

  async selectFiles(): Promise<FileSelection> {
    if (!this.isTauri) {
      // Mock file selection for web environment
      return { paths: ['mock_file1.jpg', 'mock_file2.jpg'] };
    }
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<FileSelection>('select_files');
    } catch (error) {
      console.error('Failed to select files:', error);
      return { paths: [] };
    }
  }

  // 系统相关API
  async openUrl(url: string): Promise<void> {
    if (!this.isTauri) {
      // Mock open URL for web environment
      if (typeof window !== 'undefined') {
        window.open(url, '_blank');
      }
      return;
    }
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('open_url', { url });
    } catch (error) {
      console.error('Failed to open URL:', error);
      throw error;
    }
  }

  async showMessage(title: string, message: string): Promise<void> {
    if (!this.isTauri) {
      // Mock message for web environment
      alert(`${title}\n\n${message}`);
      return;
    }
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('show_message', { title, message });
    } catch (error) {
      console.error('Failed to show message:', error);
      throw error;
    }
  }

  // Database testing API
  async testDatabase(): Promise<{ success: boolean; message: string }> {
    console.log('[TauriAPI] testDatabase called, isTauri:', this.isTauri);
    
    if (!this.isTauri) {
      // Mock test for web environment
      console.log('[TauriAPI] Using mock database test - not in Tauri environment');
      return { success: true, message: 'Mock database test successful (web environment)' };
    }
    
    try {
      console.log('[TauriAPI] Importing Tauri invoke function for database test...');
      const { invoke } = await import('@tauri-apps/api/core');
      
      console.log('[TauriAPI] Calling test_database command...');
      const result = await invoke<string>('test_database');
      console.log('[TauriAPI] Database test result (string):', result);
      
      // Backend returns string, convert to expected format
      return { success: true, message: result };
    } catch (error) {
      console.error('[TauriAPI] Failed to test database:', error);
      console.error('[TauriAPI] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        type: typeof error,
        error
      });
      return { 
        success: false, 
        message: `Database test failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  // Diagnostic methods for debugging
  async getDiagnosticInfo(): Promise<{
    isTauri: boolean;
    canImportTauri: boolean;
    tauriApiAvailable: boolean;
    windowKeys: string[];
    userAgent: string;
    environment: string;
    timestamp: string;
  }> {
    console.log('[TauriAPI] Running diagnostic check...');
    
    const diagnostics = {
      isTauri: this.isTauri,
      canImportTauri: false,
      tauriApiAvailable: false,
      windowKeys: typeof window !== 'undefined' ? Object.keys(window).filter(k => k.includes('TAURI')) : [],
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'N/A',
      environment: process.env.NODE_ENV || 'unknown',
      timestamp: new Date().toISOString()
    };
    
    // Test if we can import Tauri
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      diagnostics.canImportTauri = true;
      diagnostics.tauriApiAvailable = typeof invoke === 'function';
      console.log('[TauriAPI] Tauri import successful, invoke type:', typeof invoke);
    } catch (error) {
      console.log('[TauriAPI] Tauri import failed:', error);
    }
    
    console.log('[TauriAPI] Diagnostic results:', diagnostics);
    return diagnostics;
  }
  
  // Test basic communication with backend
  async testBackendConnection(): Promise<{
    success: boolean;
    testResults: Array<{ command: string; success: boolean; error?: string; duration: number }>;
  }> {
    console.log('[TauriAPI] Testing backend connection...');
    
    if (!this.isTauri) {
      return {
        success: false,
        testResults: [{ command: 'environment_check', success: false, error: 'Not in Tauri environment', duration: 0 }]
      };
    }
    
    const testResults: Array<{ command: string; success: boolean; error?: string; duration: number }> = [];
    let overallSuccess = true;
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      
      // Test 1: test_database command
      try {
        const start = Date.now();
        await invoke('test_database');
        const duration = Date.now() - start;
        testResults.push({ command: 'test_database', success: true, duration });
      } catch (error) {
        const duration = Date.now() - Date.now();
        testResults.push({ 
          command: 'test_database', 
          success: false, 
          error: error instanceof Error ? error.message : String(error),
          duration 
        });
        overallSuccess = false;
      }
      
      // Test 2: get_profile command
      try {
        const start = Date.now();
        await invoke('get_profile');
        const duration = Date.now() - start;
        testResults.push({ command: 'get_profile', success: true, duration });
      } catch (error) {
        const duration = Date.now() - Date.now();
        testResults.push({ 
          command: 'get_profile', 
          success: false, 
          error: error instanceof Error ? error.message : String(error),
          duration 
        });
        overallSuccess = false;
      }
      
    } catch (importError) {
      testResults.push({
        command: 'tauri_import',
        success: false,
        error: importError instanceof Error ? importError.message : String(importError),
        duration: 0
      });
      overallSuccess = false;
    }
    
    console.log('[TauriAPI] Backend connection test results:', { success: overallSuccess, testResults });
    return { success: overallSuccess, testResults };
  }
}

// 导出单例实例
export const tauriAPI = new TauriAPI();