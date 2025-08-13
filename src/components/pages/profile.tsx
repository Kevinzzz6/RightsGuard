"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { User, Upload, Save, Shield } from "lucide-react";
import { useTauri } from "@/hooks/use-tauri";

interface ProfileData {
  name: string;
  phone: string;
  email: string;
  idCardNumber: string;
  idCardFiles: { name: string; path: string }[];
}

export function ProfilePage() {
  const { tauriAPI, isReady } = useTauri();
  const [profileData, setProfileData] = useState<ProfileData>({
    name: "",
    phone: "",
    email: "",
    idCardNumber: "",
    idCardFiles: []
  });
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, [isReady]);

  const loadProfile = async () => {
    if (!isReady) return;
    
    try {
      const profile = await tauriAPI.getProfile();
      if (profile) {
        setProfileData({
          name: profile.name,
          phone: profile.phone,
          email: profile.email,
          idCardNumber: profile.idCardNumber,
          idCardFiles: profile.idCardFiles?.map(file => ({ name: file, path: file })) || []
        });
      }
    } catch (error) {
      console.error("Failed to load profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    try {
      await tauriAPI.saveProfile({
        name: profileData.name,
        phone: profileData.phone,
        email: profileData.email,
        idCardNumber: profileData.idCardNumber,
        idCardFiles: profileData.idCardFiles.map(file => file.name)
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save profile:", error);
    }
  };

  const handleFileSelect = async () => {
    try {
      const result = await tauriAPI.selectFiles();
      if (result.paths.length > 0) {
        const newFiles = result.paths.map(path => ({
          name: path.split('/').pop() || path,
          path: path
        }));
        setProfileData(prev => ({
          ...prev,
          idCardFiles: [...prev.idCardFiles, ...newFiles]
        }));
      }
    } catch (error) {
      console.error("Failed to select files:", error);
    }
  };

  const removeFile = (index: number) => {
    setProfileData(prev => ({
      ...prev,
      idCardFiles: prev.idCardFiles.filter((_, i) => i !== index)
    }));
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">加载中...</div>
        </div>
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
          {/* Name */}
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

          {/* Phone */}
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

          {/* Email */}
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

          {/* ID Card Number */}
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

          {/* ID Card Files */}
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
              
              {/* Selected Files List */}
              {profileData.idCardFiles.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">已选择的文件：</Label>
                  <div className="space-y-1">
                    {profileData.idCardFiles.map((file, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded">
                        <Badge variant="secondary" className="text-xs">
                          {file.name}
                        </Badge>
                        {isEditing && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                            className="h-6 w-6 p-0"
                          >
                            ×
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
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
        </CardContent>
      </Card>

      {/* Info Card */}
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