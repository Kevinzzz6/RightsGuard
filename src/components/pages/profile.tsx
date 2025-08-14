"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { User, Upload, Save, Shield, Database, Info, Activity } from "lucide-react";
import { useTauri } from "@/hooks/use-tauri";
import type { Profile } from "@/lib/tauri-api";

const initialProfileState: Profile = {
  name: "",
  phone: "",
  email: "",
  idCardNumber: "",
  idCardFiles: []
};

export function ProfilePage() {
  const { tauriAPI, isReady } = useTauri();
  const [profileData, setProfileData] = useState<Profile>(initialProfileState);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      if (isReady) {
        setLoading(true);
        try {
          console.log('[Profile] Loading profile data...');
          const data = await tauriAPI.getProfile();
          console.log('[Profile] Loaded profile data:', data);
          
          if (data) {
            // Handle idCardFiles - it should already be processed by the API client
            const processedData = {
              ...data,
              idCardFiles: Array.isArray(data.idCardFiles) ? data.idCardFiles : []
            };
            console.log('[Profile] Setting processed profile data:', processedData);
            setProfileData(processedData);
          } else {
            console.log('[Profile] No profile data found, using initial state');
            setProfileData(initialProfileState);
          }
        } catch (error) {
          console.error("[Profile] Failed to load profile:", error);
          await tauriAPI.showMessage("错误", `加载个人档案失败: ${error instanceof Error ? error.message : '未知错误'}`);
          setProfileData(initialProfileState);
        } finally {
          setLoading(false);
        }
      }
    };
    loadProfile();
  }, [isReady, tauriAPI]);

  const handleInputChange = (field: keyof Profile, value: string) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    console.log('[Profile] ========== STARTING SAVE PROCESS ==========');
    console.log('[Profile] Profile data to save:', JSON.stringify(profileData, null, 2));
    console.log('[Profile] TauriAPI instance:', tauriAPI);
    console.log('[Profile] Is in Tauri environment:', tauriAPI.isInTauri());
    
    // Basic validation
    if (!profileData.name?.trim()) {
      console.log('[Profile] Validation failed: missing name');
      await tauriAPI.showMessage("验证错误", "请填写姓名");
      return;
    }
    
    if (!profileData.phone?.trim()) {
      console.log('[Profile] Validation failed: missing phone');
      await tauriAPI.showMessage("验证错误", "请填写手机号");
      return;
    }
    
    if (!profileData.email?.trim()) {
      console.log('[Profile] Validation failed: missing email');
      await tauriAPI.showMessage("验证错误", "请填写邮箱地址");
      return;
    }
    
    if (!profileData.idCardNumber?.trim()) {
      console.log('[Profile] Validation failed: missing ID card number');
      await tauriAPI.showMessage("验证错误", "请填写身份证号码");
      return;
    }
    
    console.log('[Profile] Validation passed, proceeding with save...');
    
    try {
      console.log('[Profile] About to call tauriAPI.saveProfile...');
      const startTime = Date.now();
      
      const result = await tauriAPI.saveProfile(profileData);
      
      const endTime = Date.now();
      console.log('[Profile] Save operation completed in', endTime - startTime, 'ms');
      console.log('[Profile] Save successful, result:', JSON.stringify(result, null, 2));
      console.log('[Profile] Result type:', typeof result, 'is object:', result && typeof result === 'object');
      
      if (!result) {
        console.error('[Profile] WARNING: Save result is null/undefined!');
        throw new Error('Save operation returned null/undefined result');
      }
      
      // Update local state with the returned data (including ID and timestamps)
      console.log('[Profile] Updating local state with save result...');
      setProfileData(result);
      
      console.log('[Profile] Showing success message...');
      await tauriAPI.showMessage("成功", "个人档案已保存！");
      
      console.log('[Profile] Exiting edit mode...');
      setIsEditing(false);
      
      console.log('[Profile] ========== SAVE PROCESS COMPLETED SUCCESSFULLY ==========');
    } catch (error) {
      console.error("[Profile] ========== SAVE PROCESS FAILED ==========" );
      console.error("[Profile] Error type:", typeof error);
      console.error("[Profile] Error constructor:", error?.constructor?.name);
      console.error("[Profile] Error message:", error instanceof Error ? error.message : String(error));
      console.error("[Profile] Error stack:", error instanceof Error ? error.stack : 'No stack trace');
      console.error("[Profile] Full error object:", error);
      
      // Try to get additional error details
      if (error && typeof error === 'object') {
        console.error("[Profile] Error properties:", Object.getOwnPropertyNames(error));
        console.error("[Profile] Error valueOf:", error.valueOf());
        console.error("[Profile] Error toString:", error.toString());
      }
      
      let errorMessage = "保存失败 - 未知错误";
      if (error instanceof Error) {
        errorMessage = `保存失败: ${error.message}`;
      } else if (typeof error === 'string') {
        errorMessage = `保存失败: ${error}`;
      } else if (error && typeof error === 'object') {
        errorMessage = `保存失败: ${JSON.stringify(error)}`;
      }
      
      console.error("[Profile] Final error message for user:", errorMessage);
      await tauriAPI.showMessage("错误", errorMessage);
      
      console.log('[Profile] ========== SAVE ERROR HANDLING COMPLETED ==========');
    }
  };

  const handleFileSelect = async () => {
    try {
        console.log('[Profile] Starting file selection...');
        const selection = await tauriAPI.selectFiles();
        console.log('[Profile] File selection result:', selection);
        
        if (selection.paths.length > 0) {
            setProfileData(prev => ({
                ...prev,
                idCardFiles: [...(prev.idCardFiles || []), ...selection.paths]
            }));
            console.log('[Profile] Updated profile with new files');
        }
    } catch (error) {
        console.error("[Profile] File selection error:", error);
        await tauriAPI.showMessage("错误", `文件选择失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };

  const handleTestDatabase = async () => {
    console.log('[Profile] ========== STARTING DATABASE TEST ==========');
    console.log('[Profile] TauriAPI instance:', tauriAPI);
    console.log('[Profile] Is in Tauri environment:', tauriAPI.isInTauri());
    
    try {
      console.log('[Profile] About to call tauriAPI.testDatabase...');
      const startTime = Date.now();
      
      const result = await tauriAPI.testDatabase();
      
      const endTime = Date.now();
      console.log('[Profile] Database test completed in', endTime - startTime, 'ms');
      console.log('[Profile] Database test result:', JSON.stringify(result, null, 2));
      console.log('[Profile] Result type:', typeof result, 'has success property:', 'success' in result);
      
      await tauriAPI.showMessage(
        result.success ? "数据库测试成功" : "数据库测试失败",
        result.message
      );
      
      console.log('[Profile] ========== DATABASE TEST COMPLETED ==========');
    } catch (error) {
      console.error("[Profile] ========== DATABASE TEST FAILED ==========" );
      console.error("[Profile] Error type:", typeof error);
      console.error("[Profile] Error constructor:", error?.constructor?.name);
      console.error("[Profile] Error message:", error instanceof Error ? error.message : String(error));
      console.error("[Profile] Error stack:", error instanceof Error ? error.stack : 'No stack trace');
      console.error("[Profile] Full error object:", error);
      
      const errorMessage = `数据库测试失败: ${error instanceof Error ? error.message : '未知错误'}`;
      console.error("[Profile] Final error message for user:", errorMessage);
      
      await tauriAPI.showMessage("错误", errorMessage);
      
      console.log('[Profile] ========== DATABASE TEST ERROR HANDLING COMPLETED ==========');
    }
  };
  
  const handleShowDiagnostics = async () => {
    console.log('[Profile] Running diagnostics...');
    try {
      const diagnostics = await tauriAPI.getDiagnosticInfo();
      const diagnosticsText = [
        `环境检测结果:`,
        `- Tauri 环境: ${diagnostics.isTauri ? '是' : '否'}`,
        `- Tauri API 可导入: ${diagnostics.canImportTauri ? '是' : '否'}`,
        `- Invoke 函数可用: ${diagnostics.tauriApiAvailable ? '是' : '否'}`,
        `- 运行环境: ${diagnostics.environment}`,
        `- 浏览器: ${diagnostics.userAgent}`,
        `- Tauri 窗口键: ${diagnostics.windowKeys.join(', ') || '无'}`,
        `- 检测时间: ${diagnostics.timestamp}`
      ].join('\n');
      
      await tauriAPI.showMessage('诊断信息', diagnosticsText);
    } catch (error) {
      console.error('[Profile] Diagnostics error:', error);
      await tauriAPI.showMessage('错误', `诊断失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };
  
  const handleTestBackendConnection = async () => {
    console.log('[Profile] Testing backend connection...');
    try {
      const connectionTest = await tauriAPI.testBackendConnection();
      const testResultsText = [
        `后端连接测试结果:`,
        `总体状态: ${connectionTest.success ? '成功' : '失败'}`,
        '',
        '命令测试详情:'
      ];
      
      connectionTest.testResults.forEach(test => {
        testResultsText.push(
          `- ${test.command}: ${test.success ? '成功' : '失败'} (${test.duration}ms)` +
          (test.error ? ` - 错误: ${test.error}` : '')
        );
      });
      
      await tauriAPI.showMessage('后端连接测试', testResultsText.join('\n'));
    } catch (error) {
      console.error('[Profile] Backend connection test error:', error);
      await tauriAPI.showMessage('错误', `后端连接测试失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };
  
  if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">个人档案配置</h1>
        <p className="text-muted-foreground">
          配置您的个人认证信息，用于自动化申诉流程
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            个人认证信息
          </CardTitle>
          <CardDescription>
            这些信息将用于B站版权中心的资质认证步骤
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">名称 *</Label>
            <Input
              id="name"
              placeholder="真实姓名"
              value={profileData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              disabled={!isEditing}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">手机号 *</Label>
            <Input
              id="phone"
              placeholder="手机号"
              value={profileData.phone}
              onChange={(e) => handleInputChange("phone", e.target.value)}
              disabled={!isEditing}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">邮箱 *</Label>
            <Input
              id="email"
              type="email"
              placeholder="邮箱地址"
              value={profileData.email}
              onChange={(e) => handleInputChange("email", e.target.value)}
              disabled={!isEditing}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="idCard">身份认证 *</Label>
            <Input
              id="idCard"
              placeholder="身份证号码"
              value={profileData.idCardNumber}
              onChange={(e) => handleInputChange("idCardNumber", e.target.value)}
              disabled={!isEditing}
            />
          </div>

          <div className="space-y-2">
            <Label>证件证明 *</Label>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">身份证正反面照片</span>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleFileSelect}
                  disabled={!isEditing}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  选择文件
                </Button>
              </div>
              
              {profileData.idCardFiles && Array.isArray(profileData.idCardFiles) && profileData.idCardFiles.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">已选择的文件：</Label>
                  <div className="space-y-1">
                    {profileData.idCardFiles.map((file, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
                        <Badge variant="secondary" className="text-xs">
                          {file.split(/[/\\]/).pop()}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            {isEditing ? (
              <>
                <Button onClick={handleSave} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  保存
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsEditing(false)}
                  className="flex-1"
                >
                  取消
                </Button>
              </>
            ) : (
              <Button 
                onClick={() => setIsEditing(true)}
                className="flex-1"
              >
                编辑信息
              </Button>
            )}
          </div>
          
          {/* Debug section - only show if in development or Tauri environment */}
          {(process.env.NODE_ENV === 'development' || tauriAPI.isInTauri()) && (
            <div className="flex flex-wrap gap-2 pt-2 border-t mt-4">
              <Button 
                variant="outline"
                size="sm"
                onClick={handleTestDatabase}
                className="text-xs"
              >
                <Database className="h-3 w-3 mr-1" />
                测试数据库
              </Button>
              <Button 
                variant="outline"
                size="sm"
                onClick={handleShowDiagnostics}
                className="text-xs"
              >
                <Info className="h-3 w-3 mr-1" />
                系统诊断
              </Button>
              <Button 
                variant="outline"
                size="sm"
                onClick={handleTestBackendConnection}
                className="text-xs"
              >
                <Activity className="h-3 w-3 mr-1" />
                后端连接测试
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="max-w-2xl mt-6">
        <CardHeader>
          <CardTitle className="text-lg">使用说明</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• 请确保填写的信息真实有效，这些信息将用于B站版权中心的资质认证</p>
            <p>• 身份证正反面照片需要清晰可见，信息完整</p>
            <p>• 所有信息都将安全存储在本地，不会上传到云端</p>
            <p>• 信息配置完成后，在申诉流程中将自动填充到B站表单中</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}