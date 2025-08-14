"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { User, Upload, Save, Shield, Database } from "lucide-react";
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
    console.log('[Profile] Starting save process...');
    console.log('[Profile] Profile data to save:', profileData);
    
    // Basic validation
    if (!profileData.name?.trim()) {
      await tauriAPI.showMessage("验证错误", "请填写姓名");
      return;
    }
    
    if (!profileData.phone?.trim()) {
      await tauriAPI.showMessage("验证错误", "请填写手机号");
      return;
    }
    
    if (!profileData.email?.trim()) {
      await tauriAPI.showMessage("验证错误", "请填写邮箱地址");
      return;
    }
    
    if (!profileData.idCardNumber?.trim()) {
      await tauriAPI.showMessage("验证错误", "请填写身份证号码");
      return;
    }
    
    try {
      console.log('[Profile] Calling saveProfile API...');
      const result = await tauriAPI.saveProfile(profileData);
      console.log('[Profile] Save successful, result:', result);
      
      // Update local state with the returned data (including ID and timestamps)
      setProfileData(result);
      
      await tauriAPI.showMessage("成功", "个人档案已保存！");
      setIsEditing(false);
    } catch (error) {
      console.error("[Profile] Failed to save profile:", error);
      
      let errorMessage = "保存失败";
      if (error instanceof Error) {
        errorMessage = `保存失败: ${error.message}`;
      } else if (typeof error === 'string') {
        errorMessage = `保存失败: ${error}`;
      }
      
      await tauriAPI.showMessage("错误", errorMessage);
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
    console.log('[Profile] Testing database connectivity...');
    try {
      const result = await tauriAPI.testDatabase();
      console.log('[Profile] Database test result:', result);
      
      await tauriAPI.showMessage(
        result.success ? "数据库测试成功" : "数据库测试失败",
        result.message
      );
    } catch (error) {
      console.error("[Profile] Database test error:", error);
      await tauriAPI.showMessage("错误", `数据库测试失败: ${error instanceof Error ? error.message : '未知错误'}`);
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
            <div className="flex gap-2 pt-2 border-t mt-4">
              <Button 
                variant="outline"
                size="sm"
                onClick={handleTestDatabase}
                className="text-xs"
              >
                <Database className="h-3 w-3 mr-1" />
                测试数据库连接
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