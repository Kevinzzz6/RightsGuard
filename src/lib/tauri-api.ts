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
  private isTauri: boolean = false;
  private isInitialized: boolean = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // SSR安全：构造函数中不检测环境，延迟到运行时
    console.log('[TauriAPI] Constructor called - deferring environment detection to client-side');
  }

  // 运行时环境检测 - 只在浏览器环境中调用
  private async detectEnvironment(): Promise<void> {
    if (this.isInitialized) {
      return; // 已经初始化过
    }

    // 确保在浏览器环境中运行
    const inBrowser = typeof window !== 'undefined';
    if (!inBrowser) {
      console.log('[TauriAPI] Still in SSR environment, skipping detection');
      return;
    }

    console.log('[TauriAPI] Runtime environment check:');
    console.log('  - inBrowser:', inBrowser);
    console.log('  - window.navigator.userAgent:', window.navigator.userAgent);
    console.log('  - process.env.NODE_ENV:', process.env.NODE_ENV);

    // 多重检测策略
    const checks = {
      hasTauriInternals: '__TAURI_INTERNALS__' in window,
      hasTauriGlobal: '__TAURI__' in window,
      canImportTauri: false,
      userAgentTauri: window.navigator.userAgent.includes('Tauri')
    };

    console.log('  - __TAURI_INTERNALS__:', checks.hasTauriInternals ? 'exists' : 'missing');
    console.log('  - __TAURI__ global:', checks.hasTauriGlobal ? 'exists' : 'missing');
    console.log('  - User agent:', window.navigator.userAgent);

    // 尝试动态导入Tauri
    try {
      const tauriModule = await import('@tauri-apps/api/core');
      checks.canImportTauri = !!tauriModule.invoke;
      console.log('  - Tauri import test: SUCCESS');
    } catch (error) {
      console.log('  - Tauri import test: FAILED -', error instanceof Error ? error.message : String(error));
    }

    console.log('  - Window keys with TAURI:', Object.keys(window).filter(k => k.includes('TAURI')).join(', ') || 'none');

    // 综合判断 - 任一条件满足即认为在Tauri环境中
    this.isTauri = checks.hasTauriInternals || checks.hasTauriGlobal || checks.canImportTauri || checks.userAgentTauri;
    this.isInitialized = true;

    console.log('[TauriAPI] Final runtime isTauri decision:', this.isTauri);
    console.log('[TauriAPI] Detection details:', checks);
  }

  // 确保环境已检测
  private async ensureInitialized(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.detectEnvironment();
    await this.initPromise;
  }

  // 检查是否在Tauri环境中 - 现在是异步的
  async isInTauri(): Promise<boolean> {
    await this.ensureInitialized();
    return this.isTauri;
  }

  // 同步版本 - 仅在确定已初始化后使用
  isInTauriSync(): boolean {
    if (!this.isInitialized) {
      console.warn('[TauriAPI] Environment not yet detected, returning false');
      return false;
    }
    return this.isTauri;
  }

  // 个人档案相关API
  async getProfile(): Promise<Profile | null> {
    await this.ensureInitialized();
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
    await this.ensureInitialized();
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
      console.log('[TauriAPI] Attempting to delete IP asset with ID:', id);
      console.log('[TauriAPI] ID type:', typeof id, 'Length:', id?.length);
      
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<boolean>('delete_ip_asset', { id });
      
      console.log('[TauriAPI] Delete operation result:', result);
      return result;
    } catch (error) {
      console.error('[TauriAPI] Failed to delete IP asset:', id);
      console.error('[TauriAPI] Error details:', error);
      
      // 尝试提取更详细的错误信息
      if (error && typeof error === 'object') {
        console.error('[TauriAPI] Error object keys:', Object.keys(error));
        console.error('[TauriAPI] Stringified error:', JSON.stringify(error, null, 2));
      }
      
      // 重新抛出错误而不是静默返回false，让调用者处理
      throw new Error(`删除IP资产失败: ${error instanceof Error ? error.message : JSON.stringify(error)}`);
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
    console.log('[TauriAPI] startAutomation called with:', { infringingUrl, originalUrl, ipAssetId });
    console.log('[TauriAPI] isTauri:', this.isTauri);
    
    if (!this.isTauri) {
      // Mock automation for web environment
      alert(`开始自动化申诉流程！\n侵权链接：${infringingUrl}\n原创链接：${originalUrl || '未提供'}`);
      return;
    }
    
    try {
      console.log('[TauriAPI] Importing Tauri invoke function...');
      const { invoke } = await import('@tauri-apps/api/core');
      console.log('[TauriAPI] Tauri invoke imported successfully');
      
      const params = {
        infringingUrl: infringingUrl,
        originalUrl: originalUrl,
        ipAssetId: ipAssetId
      };
      console.log('[TauriAPI] Calling start_automation with params:', params);
      
      await invoke('start_automation', { params });
      console.log('[TauriAPI] start_automation completed successfully');
    } catch (error) {
      console.error('[TauriAPI] Failed to start automation:', error);
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

  async continueAutomationAfterVerification(): Promise<void> {
    if (!this.isTauri) {
      // Mock for web environment
      alert('验证完成信号已发送！');
      return;
    }
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('continue_automation_after_verification');
    } catch (error) {
      console.error('Failed to continue automation after verification:', error);
      throw error;
    }
  }

  async checkAutomationEnvironment(): Promise<string> {
    if (!this.isTauri) {
      // Mock for web environment
      return `🔍 RightsGuard 自动化环境检查报告 (模拟模式)

✅ Node.js: v18.17.0 (模拟)
✅ npm: 9.6.7 (模拟)
✅ Playwright: Version 1.40.0 (模拟)

🌐 系统浏览器配置:
✅ Chrome浏览器: 配置正常，可以启动 (模拟)

💡 使用说明:
   • 当前为Web模式，实际功能需要桌面应用
   • 自动化将优先使用Chrome浏览器
   • 如果Chrome不可用，将自动切换到Edge
   • 浏览器将以有头模式运行，便于人工验证`;
    }
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<string>('check_automation_environment');
    } catch (error) {
      console.error('Failed to check automation environment:', error);
      throw error;
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

  // SQLite connection strategy testing API
  async testSqliteConnectionStrategies(): Promise<{ success: boolean; message: string }> {
    console.log('[TauriAPI] testSqliteConnectionStrategies called, isTauri:', this.isTauri);
    
    if (!this.isTauri) {
      // Mock test for web environment
      console.log('[TauriAPI] Using mock SQLite connection test - not in Tauri environment');
      return { success: true, message: 'Mock SQLite connection test successful (web environment)' };
    }
    
    try {
      console.log('[TauriAPI] Importing Tauri invoke function for SQLite connection test...');
      const { invoke } = await import('@tauri-apps/api/core');
      
      console.log('[TauriAPI] Calling test_sqlite_connection_strategies command...');
      const result = await invoke<string>('test_sqlite_connection_strategies');
      console.log('[TauriAPI] SQLite connection test result (string):', result);
      
      // Backend returns string, convert to expected format
      return { success: true, message: result };
    } catch (error) {
      console.error('[TauriAPI] Failed to test SQLite connection strategies:', error);
      console.error('[TauriAPI] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        type: typeof error,
        error
      });
      return { 
        success: false, 
        message: `SQLite connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
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

  // Database diagnostics API
  async getDatabaseDiagnostics(): Promise<string> {
    console.log('[TauriAPI] getDatabaseDiagnostics called, isTauri:', this.isTauri);
    
    if (!this.isTauri) {
      console.log('[TauriAPI] Using mock diagnostics - not in Tauri environment');
      return "Mock Diagnostics:\n✓ Mock environment detected\n✓ Web mode active\n✓ No real database connection needed";
    }

    try {
      console.log('[TauriAPI] Importing Tauri invoke function for diagnostics...');
      const { invoke } = await import('@tauri-apps/api/core');
      
      console.log('[TauriAPI] Calling get_database_diagnostics command...');
      const result = await invoke<string>('get_database_diagnostics');
      console.log('[TauriAPI] Database diagnostics result:', result);
      
      return result;
    } catch (error) {
      console.error('[TauriAPI] Failed to get database diagnostics:', error);
      throw new Error(`Database diagnostics failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Clear database cache API
  async clearDatabaseCache(): Promise<string> {
    console.log('[TauriAPI] clearDatabaseCache called, isTauri:', this.isTauri);
    
    if (!this.isTauri) {
      console.log('[TauriAPI] Using mock cache clear - not in Tauri environment');
      return "Mock cache cleared successfully";
    }

    try {
      console.log('[TauriAPI] Importing Tauri invoke function for cache clear...');
      const { invoke } = await import('@tauri-apps/api/core');
      
      console.log('[TauriAPI] Calling clear_database_cache command...');
      const result = await invoke<string>('clear_database_cache');
      console.log('[TauriAPI] Database cache clear result:', result);
      
      return result;
    } catch (error) {
      console.error('[TauriAPI] Failed to clear database cache:', error);
      throw new Error(`Database cache clear failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Browser connection API
  async checkBrowserConnectionStatus(): Promise<string> {
    await this.ensureInitialized();
    console.log('[TauriAPI] checkBrowserConnectionStatus called, isTauri:', this.isTauri);
    
    if (!this.isTauri) {
      console.log('[TauriAPI] Using mock browser status - not in Tauri environment');
      // Mock random status for demonstration
      const statuses = ['connected', 'disconnected', 'running_no_debug'];
      return statuses[Math.floor(Math.random() * statuses.length)];
    }

    try {
      console.log('[TauriAPI] Importing Tauri invoke function for browser connection check...');
      const { invoke } = await import('@tauri-apps/api/core');
      
      console.log('[TauriAPI] Calling check_browser_connection_status command...');
      const result = await invoke<string>('check_browser_connection_status');
      console.log('[TauriAPI] Browser connection status result:', result);
      
      return result;
    } catch (error) {
      console.error('[TauriAPI] Failed to check browser connection status:', error);
      return 'disconnected'; // Return disconnected on error
    }
  }

  async getBrowserLaunchCommand(): Promise<string> {
    await this.ensureInitialized();
    console.log('[TauriAPI] getBrowserLaunchCommand called, isTauri:', this.isTauri);
    
    if (!this.isTauri) {
      console.log('[TauriAPI] Using mock browser command - not in Tauri environment');
      return 'chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\\Users\\User\\AppData\\Local\\Google\\Chrome\\User Data"';
    }

    try {
      console.log('[TauriAPI] Importing Tauri invoke function for browser command...');
      const { invoke } = await import('@tauri-apps/api/core');
      
      console.log('[TauriAPI] Calling get_browser_launch_command command...');
      const result = await invoke<string>('get_browser_launch_command');
      console.log('[TauriAPI] Browser launch command result:', result);
      
      return result;
    } catch (error) {
      console.error('[TauriAPI] Failed to get browser launch command:', error);
      throw new Error(`Failed to get browser launch command: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async forceRestartChrome(): Promise<string> {
    await this.ensureInitialized();
    console.log('[TauriAPI] forceRestartChrome called, isTauri:', this.isTauri);
    
    if (!this.isTauri) {
      console.log('[TauriAPI] Using mock force restart - not in Tauri environment');
      return `🔄 模拟强制重启Chrome完成

✓ 已关闭所有Chrome进程 (模拟)
✓ 确认所有Chrome进程已关闭 (模拟)

🔄 Chrome已关闭，请使用以下命令重新启动:

chrome.exe --remote-debugging-port=9222 --user-data-dir="C:\\Users\\User\\AppData\\Local\\Google\\Chrome\\User Data"

💡 提示: 运行上述命令后，系统将自动检测连接状态`;
    }

    try {
      console.log('[TauriAPI] Importing Tauri invoke function for force restart...');
      const { invoke } = await import('@tauri-apps/api/core');
      
      console.log('[TauriAPI] Calling force_restart_chrome command...');
      const result = await invoke<string>('force_restart_chrome');
      console.log('[TauriAPI] Force restart Chrome result:', result);
      
      return result;
    } catch (error) {
      console.error('[TauriAPI] Failed to force restart Chrome:', error);
      throw new Error(`Failed to force restart Chrome: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // File management API for automation
  async copyFileToAppData(
    sourcePath: string,
    category: 'profiles' | 'ip_assets',
    subcategory: 'id_cards' | 'auth_docs' | 'proof_docs'
  ): Promise<string> {
    await this.ensureInitialized();
    console.log('[TauriAPI] copyFileToAppData called:', { sourcePath, category, subcategory });
    
    if (!this.isTauri) {
      console.log('[TauriAPI] Using mock file copy - not in Tauri environment');
      return `files/${category}/${subcategory}/mock_${Date.now()}.jpg`;
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<string>('copy_file_to_app_data', {
        sourcePath,
        category,
        subcategory
      });
      console.log('[TauriAPI] File copied to app data:', result);
      return result;
    } catch (error) {
      console.error('[TauriAPI] Failed to copy file to app data:', error);
      throw error;
    }
  }

  async getAppFilePath(relativePath: string): Promise<string> {
    await this.ensureInitialized();
    console.log('[TauriAPI] getAppFilePath called:', relativePath);
    
    if (!this.isTauri) {
      console.log('[TauriAPI] Using mock file path - not in Tauri environment');
      return `/mock/path/${relativePath}`;
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<string>('get_app_file_path', { relativePath });
      console.log('[TauriAPI] App file path:', result);
      return result;
    } catch (error) {
      console.error('[TauriAPI] Failed to get app file path:', error);
      throw error;
    }
  }

}

// 导出单例实例
export const tauriAPI = new TauriAPI();