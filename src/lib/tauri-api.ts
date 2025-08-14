// Tauri API 客户端
export interface Profile {
  id?: string;
  name: string;
  phone: string;
  email: string;
  idCardNumber: string;
  idCardFiles?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface IpAsset {
  id?: string;
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
  authFiles?: string[];
  workProofFiles?: string[];
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Case {
  id?: string;
  infringingUrl: string;
  originalUrl?: string;
  associatedIpId?: string;
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
    console.log('  - window object keys:', inBrowser ? Object.keys(window).filter(k => k.includes('TAURI')).join(', ') : 'N/A');
    
    this.isTauri = hasTauriInternals;
    console.log('[TauriAPI] Final isTauri:', this.isTauri);
  }

  // 检查是否在Tauri环境中
  isInTauri(): boolean {
    return this.isTauri;
  }

  // 个人档案相关API
  async getProfile(): Promise<Profile | null> {
    if (!this.isTauri) {
      // Mock data for web environment
      return {
        name: "张三",
        phone: "13800138000",
        email: "zhangsan@example.com",
        idCardNumber: "110101199001011234",
        idCardFiles: ["身份证正面.jpg", "身份证反面.jpg"]
      };
    }
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<Profile>('get_profile');
    } catch (error) {
      console.error('Failed to get profile:', error);
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
      
      // Convert files array to JSON string
      const profileData = {
        ...profile,
        idCardFiles: profile.idCardFiles ? JSON.stringify(profile.idCardFiles) : undefined
      };
      
      console.log('[TauriAPI] Calling Tauri invoke with data:', profileData);
      const result = await invoke<Profile>('save_profile', { profile: profileData });
      console.log('[TauriAPI] Save successful, result:', result);
      
      return result;
    } catch (error) {
      console.error('[TauriAPI] Failed to save profile:', error);
      throw error;
    }
  }

  // IP资产相关API
  async getIpAssets(): Promise<IpAsset[]> {
    if (!this.isTauri) {
      // Mock data for web environment
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
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<IpAsset[]>('get_ip_assets');
    } catch (error) {
      console.error('Failed to get IP assets:', error);
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
    if (!this.isTauri) {
      // Mock save for web environment
      alert('IP资产已保存！');
      return { ...asset, id: Date.now().toString() };
    }
    
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      
      // Convert files arrays to JSON strings
      const assetData = {
        ...asset,
        authFiles: asset.authFiles ? JSON.stringify(asset.authFiles) : undefined,
        workProofFiles: asset.workProofFiles ? JSON.stringify(asset.workProofFiles) : undefined
      };
      
      return await invoke<IpAsset>('save_ip_asset', { asset: assetData });
    } catch (error) {
      console.error('Failed to save IP asset:', error);
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
}

// 导出单例实例
export const tauriAPI = new TauriAPI();