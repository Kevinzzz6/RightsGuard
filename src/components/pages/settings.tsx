"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Settings, Database, Globe, Shield, Info } from "lucide-react";

export function SettingsPage() {
  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">设置</h1>
        <p className="text-muted-foreground">
          配置应用程序参数和偏好设置
        </p>
      </div>

      <div className="space-y-6">
        {/* General Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              通用设置
            </CardTitle>
            <CardDescription>
              应用程序的基本配置选项
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>自动更新</Label>
                <p className="text-sm text-muted-foreground">
                  自动检查并下载应用程序更新
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>启动时自动运行</Label>
                <p className="text-sm text-muted-foreground">
                  系统启动时自动打开应用程序
                </p>
              </div>
              <Switch />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>系统托盘图标</Label>
                <p className="text-sm text-muted-foreground">
                  在系统托盘中显示应用程序图标
                </p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Automation Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              自动化设置
            </CardTitle>
            <CardDescription>
              配置自动化流程的相关参数
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="timeout">操作超时时间（秒）</Label>
              <Input 
                id="timeout" 
                type="number" 
                defaultValue="30"
                placeholder="操作超时时间"
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>有头模式</Label>
                <p className="text-sm text-muted-foreground">
                  显示浏览器窗口进行自动化操作
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>自动重试</Label>
                <p className="text-sm text-muted-foreground">
                  操作失败时自动重试
                </p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Data Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              数据管理
            </CardTitle>
            <CardDescription>
              管理本地数据和备份
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>数据存储位置</Label>
              <Input 
                defaultValue="/Users/user/Documents/RightsGuard/data"
                readOnly
              />
            </div>
            <Separator />
            <div className="flex gap-2">
              <Button variant="outline">
                备份数据
              </Button>
              <Button variant="outline">
                恢复数据
              </Button>
              <Button variant="outline">
                清理缓存
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              安全设置
            </CardTitle>
            <CardDescription>
              配置应用程序的安全选项
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>数据加密</Label>
                <p className="text-sm text-muted-foreground">
                  加密存储敏感数据
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label htmlFor="password">主密码</Label>
              <Input 
                id="password" 
                type="password"
                placeholder="设置主密码保护应用"
              />
            </div>
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              关于
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">版本</span>
                <span className="text-sm">1.0.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">构建日期</span>
                <span className="text-sm">2024-01-15</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">开发者</span>
                <span className="text-sm">RightsGuard Team</span>
              </div>
            </div>
            <Separator />
            <Button variant="outline" className="w-full">
              检查更新
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}