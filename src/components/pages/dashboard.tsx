"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useTauri } from "@/hooks/use-tauri";
import { FileText, Link, Plus, Calendar, ExternalLink, Copy, Play, Square } from "lucide-react";
import type { Case, AutomationStatus, IpAsset } from "@/lib/tauri-api";

export function DashboardPage() {
  const { tauriAPI, isTauri, isReady } = useTauri();
  const [infringingUrl, setInfringingUrl] = useState("");
  const [originalUrl, setOriginalUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cases, setCases] = useState<Case[]>([]);
  const [automationStatus, setAutomationStatus] = useState<AutomationStatus | null>(null);
  const [ipAssets, setIpAssets] = useState<IpAsset[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    setLoading(true);
    try {
      const [casesData, ipAssetsData] = await Promise.all([
        tauriAPI.getCases(),
        tauriAPI.getIpAssets()
      ]);
      setCases(casesData);
      setIpAssets(ipAssetsData);
    } catch (error) {
      console.error('Failed to load data:', error);
      tauriAPI.showMessage("错误", "加载数据失败");
    } finally {
      setLoading(false);
    }
  };
  
  const checkAutomationStatus = async () => {
    try {
      const status = await tauriAPI.getAutomationStatus();
      setAutomationStatus(status);
    } catch (error) {
      console.error('Failed to get automation status:', error);
    }
  };

  useEffect(() => {
    if (isReady) {
      loadData();
      if (isTauri) {
        const interval = setInterval(checkAutomationStatus, 1000);
        return () => clearInterval(interval);
      }
    }
  }, [isReady, isTauri]);

  const handleSubmit = async () => {
    console.log('handleSubmit called');
    
    if (!infringingUrl) {
      console.log('No infringing URL provided');
      await tauriAPI.showMessage("提示", "请输入侵权作品URL");
      return;
    }
    
    if (ipAssets.length === 0) {
      console.log('No IP assets found');
      await tauriAPI.showMessage("提示", "请先在IP资产库中添加至少一个IP资产");
      return;
    }

    console.log('Starting automation with:', { infringingUrl, originalUrl, ipAssets });
    setIsSubmitting(true);
    
    try {
      // 在实际应用中，这里应该让用户选择IP资产
      // 暂时使用第一个IP资产
      const selectedIpAsset = ipAssets[0];
      console.log('Selected IP asset:', selectedIpAsset);
      
      console.log('Calling tauriAPI.startAutomation...');
      await tauriAPI.startAutomation(
        infringingUrl,
        originalUrl || undefined,
        selectedIpAsset?.id
      );
      
      console.log('Automation started successfully');
      await tauriAPI.showMessage("成功", "自动化申诉流程已启动");
      
      setInfringingUrl("");
      setOriginalUrl("");
      
      // 延迟一小段时间再刷新，等待后端状态更新
      setTimeout(loadData, 1000);
      
    } catch (error) {
      console.error('Failed to start automation:', error);
      
      // 提取更详细的错误信息
      let errorMessage = "启动自动化流程失败";
      let detailedError = "";
      
      if (error instanceof Error) {
        errorMessage = error.message;
        detailedError = error.stack || "";
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object') {
        errorMessage = (error as any).message || JSON.stringify(error);
        detailedError = (error as any).stack || "";
      }
      
      console.error('Error details:', { 
        error, 
        errorMessage, 
        detailedError,
        type: typeof error,
        keys: error && typeof error === 'object' ? Object.keys(error) : []
      });
      
      // 显示用户友好的错误信息
      let userMessage = errorMessage;
      
      // 针对常见错误提供解决方案提示
      if (errorMessage.includes("npx") || errorMessage.includes("Node.js")) {
        userMessage += "\n\n解决方案：\n1. 请确保已安装Node.js\n2. 重启应用程序\n3. 检查系统PATH环境变量";
      } else if (errorMessage.includes("Playwright")) {
        userMessage += "\n\n解决方案：\n1. 打开命令行\n2. 运行：npm install -g @playwright/test\n3. 运行：npx playwright install";
      } else if (errorMessage.includes("个人档案")) {
        userMessage += "\n\n解决方案：\n请先完善个人档案信息";
      } else if (errorMessage.includes("IP资产")) {
        userMessage += "\n\n解决方案：\n请先添加至少一个IP资产";
      }
      
      await tauriAPI.showMessage("启动自动化失败", userMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStopAutomation = async () => {
    try {
      await tauriAPI.stopAutomation();
      await checkAutomationStatus();
    } catch (error) {
      console.error('Failed to stop automation:', error);
    }
  };

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      await tauriAPI.showMessage("成功", "链接已复制到剪贴板");
    } catch (error) {
      console.error('Failed to copy URL:', error);
    }
  };

  const handleOpenUrl = async (url: string) => {
    try {
      await tauriAPI.openUrl(url);
    } catch (error) {
      console.error('Failed to open URL:', error);
    }
  };

  const handleContinueAfterVerification = async () => {
    try {
      await tauriAPI.continueAutomationAfterVerification();
      await tauriAPI.showMessage("成功", "验证完成信号已发送，自动化流程将继续执行");
    } catch (error) {
      console.error('Failed to continue automation after verification:', error);
      await tauriAPI.showMessage("错误", "发送验证完成信号失败");
    }
  };

  const handleCheckEnvironment = async () => {
    try {
      const report = await tauriAPI.checkAutomationEnvironment();
      await tauriAPI.showMessage("🔍 自动化环境检查报告", report);
    } catch (error) {
      console.error('Failed to check automation environment:', error);
      const errorMessage = error instanceof Error ? error.message : "环境检查失败";
      await tauriAPI.showMessage("错误", `环境检查失败：${errorMessage}`);
    }
  };

  if (!isReady || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">版权侵权申诉工具</h1>
        <p className="text-muted-foreground mt-1">
          RightsGuard - 高效、稳定的B站版权侵权自动化申诉工具
        </p>
        {isTauri && (
          <div className="mt-2">
            <Badge variant="outline">桌面应用模式</Badge>
          </div>
        )}
      </div>

      {automationStatus?.isRunning && (
        <Card className="mb-6 border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <Play className="h-5 w-5" />
              自动化流程运行中
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-orange-700">当前步骤：</span>
                <span className="text-sm font-medium">{automationStatus.currentStep || '...'}</span>
              </div>
              {automationStatus.progress !== undefined && automationStatus.progress !== null && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-orange-700">进度：</span>
                  <span className="text-sm font-medium">{automationStatus.progress.toFixed(0)}%</span>
                </div>
              )}
              {automationStatus.error && (
                <div className="text-sm text-red-600">
                  错误：{automationStatus.error}
                </div>
              )}
              {/* 人工验证提示和按钮 */}
              {automationStatus.currentStep?.includes('验证') && (
                <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <p className="text-sm text-yellow-800 mb-2">
                    请在浏览器中手动完成滑块验证和短信验证码输入，完成后点击下方按钮继续。
                  </p>
                  <Button 
                    onClick={handleContinueAfterVerification}
                    variant="default"
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    我已完成验证
                  </Button>
                </div>
              )}
              <div className="flex gap-2 mt-2">
                <Button 
                  onClick={handleStopAutomation}
                  variant="outline"
                  size="sm"
                >
                  <Square className="h-4 w-4 mr-2" />
                  停止自动化
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* New Complaint Section */}
      <Card className="mb-6 md:mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            新建申诉任务
          </CardTitle>
          <CardDescription>
            输入侵权链接，开始自动化申诉流程
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="space-y-2">
              <label htmlFor="infringing-url" className="text-sm font-medium">
                侵权作品URL *
              </label>
              <div className="relative">
                <Link className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="infringing-url"
                  placeholder="https://www.bilibili.com/video/..."
                  value={infringingUrl}
                  onChange={(e) => setInfringingUrl(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <label htmlFor="original-url" className="text-sm font-medium">
                原创作品URL（选填）
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="original-url"
                  placeholder="https://www.bilibili.com/video/..."
                  value={originalUrl}
                  onChange={(e) => setOriginalUrl(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <Button 
              onClick={handleSubmit} 
              className="flex-1"
              disabled={isSubmitting || automationStatus?.isRunning}
            >
              {isSubmitting ? "处理中..." : "开始申诉"}
            </Button>
            
            {isTauri && (
              <Button 
                onClick={handleCheckEnvironment}
                variant="outline"
                className="sm:w-auto"
              >
                检查环境
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cases List Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            申诉案件列表
          </CardTitle>
          <CardDescription>
            查看历史申诉任务和状态
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Mobile Cards View */}
          <div className="md:hidden space-y-4">
            {cases.map((caseItem) => (
              <Card key={caseItem.id} className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge variant={caseItem.status === "已提交" ? "default" : "secondary"}>
                      {caseItem.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(caseItem.submissionDate || caseItem.createdAt!).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <div>
                      <p className="text-xs text-muted-foreground">侵权URL</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm font-medium truncate">
                          {caseItem.infringingUrl}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyUrl(caseItem.infringingUrl)}
                          className="h-6 w-6 p-0"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenUrl(caseItem.infringingUrl)}
                          className="h-6 w-6 p-0"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    
                    {caseItem.originalUrl && (
                      <div>
                        <p className="text-xs text-muted-foreground">原创URL</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm truncate">
                            {caseItem.originalUrl}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>侵权URL</TableHead>
                  <TableHead>原创URL</TableHead>
                  <TableHead>申诉日期</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="w-24">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cases.map((caseItem) => (
                  <TableRow key={caseItem.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Link className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate max-w-[300px]">
                          {caseItem.infringingUrl}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {caseItem.originalUrl ? (
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="truncate max-w-[300px]">
                            {caseItem.originalUrl}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">未提供</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(caseItem.submissionDate || caseItem.createdAt!).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Badge variant={caseItem.status === "已提交" ? "default" : "secondary"}>
                        {caseItem.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyUrl(caseItem.infringingUrl)}
                          className="h-8 w-8 p-0"
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenUrl(caseItem.infringingUrl)}
                          className="h-8 w-8 p-0"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}