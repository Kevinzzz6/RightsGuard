"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useTauri } from "@/hooks/use-tauri";
import { FileText, Link, Plus, Calendar, ExternalLink, Copy, Play, Square, Settings, Monitor, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  
  // Browser connection configuration states
  const [connectionMode, setConnectionMode] = useState<string>("auto");
  const [browserStatus, setBrowserStatus] = useState<"unknown" | "connected" | "disconnected" | "checking" | "starting">("unknown");
  const [showBrowserConfig, setShowBrowserConfig] = useState(false);
  const [connectionCheckCount, setConnectionCheckCount] = useState(0);
  const [isMonitoringConnection, setIsMonitoringConnection] = useState(false);
  
  // Use refs to avoid dependency loops in useEffect
  const monitoringIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const browserStatusRef = useRef(browserStatus);
  const connectionCheckCountRef = useRef(connectionCheckCount);
  const isMonitoringRef = useRef(isMonitoringConnection);
  
  // Update refs when state changes
  useEffect(() => { browserStatusRef.current = browserStatus; }, [browserStatus]);
  useEffect(() => { connectionCheckCountRef.current = connectionCheckCount; }, [connectionCheckCount]);
  useEffect(() => { isMonitoringRef.current = isMonitoringConnection; }, [isMonitoringConnection]);

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

  // Browser connection handlers - wrapped with useCallback to avoid re-renders
  const checkBrowserConnection = useCallback(async () => {
    // 确保Tauri环境完全就绪
    if (!isReady) {
      console.log('[BrowserMonitor] Tauri environment not ready, skipping check');
      return;
    }
    
    if (!isTauri) {
      setBrowserStatus("disconnected");
      return;
    }

    setBrowserStatus("checking");
    try {
      const status = await tauriAPI.checkBrowserConnectionStatus();
      const currentCount = connectionCheckCountRef.current;
      const currentStatus = browserStatusRef.current;
      
      console.log('Browser connection status:', status, 'Check count:', currentCount);
      
      // Map backend status to frontend status with improved logic
      switch (status) {
        case "connected":
          const wasStarting = currentStatus === "starting";
          setBrowserStatus("connected");
          setIsMonitoringConnection(false); // Stop monitoring once connected
          setConnectionCheckCount(0); // Reset counter
          
          // Show success message if we were waiting for Chrome to start
          if (wasStarting && isTauri) {
            tauriAPI.showMessage("🎉 连接成功", "Chrome调试端口已就绪！现在可以开始自动化申诉流程了。");
          }
          break;
        case "running_no_debug":
          // Chrome is running but debug port not ready - this is a starting state
          setBrowserStatus("starting");
          setConnectionCheckCount(prev => prev + 1);
          break;
        default:
          setBrowserStatus("disconnected");
          setConnectionCheckCount(0); // Reset counter for fresh disconnected state
      }
    } catch (error) {
      console.error('Failed to check browser connection:', error);
      setBrowserStatus("disconnected");
      setConnectionCheckCount(0);
    }
  }, [isTauri, tauriAPI, isReady]);

  // Start/stop monitoring based on configuration visibility with optimized intervals
  const startMonitoring = useCallback(() => {
    if (monitoringIntervalRef.current) return; // Already monitoring
    
    console.log('[BrowserMonitor] Starting optimized connection monitoring');
    setIsMonitoringConnection(true);
    
    let checkCount = 0;
    let currentInterval = 2000; // Start with 2 second intervals
    
    // Initial check with slight delay to avoid rapid firing
    const initialTimeout = setTimeout(() => {
      checkBrowserConnection();
    }, 1000);
    
    const scheduleNextCheck = () => {
      // Clear any existing interval
      if (monitoringIntervalRef.current) {
        clearTimeout(monitoringIntervalRef.current);
      }
      
      monitoringIntervalRef.current = setTimeout(() => {
        const currentStatus = browserStatusRef.current;
        const currentCount = connectionCheckCountRef.current;
        
        console.log('[BrowserMonitor] Smart auto-check:', currentStatus, 'count:', currentCount, 'interval:', currentInterval);
        
        // Update check count
        checkCount = currentCount;
        
        // Stop monitoring after 15 attempts with comprehensive timeout handling
        if (currentStatus === "starting" && checkCount >= 15) {
          console.log('[BrowserMonitor] Timeout reached (15 attempts), providing detailed diagnostics');
          stopMonitoring();
          setBrowserStatus("disconnected");
          setConnectionCheckCount(0);
          
          // Show detailed diagnostic message
          const timeoutDiagnostics = `
🚨 Chrome连接超时诊断

⏱️ 已尝试连接 ${checkCount} 次（约${Math.round(checkCount * 3.5)}秒）
❌ Chrome调试端口仍未就绪

🔍 可能的原因和解决方案：

1. **Chrome启动缓慢**
   • 重启计算机后重试
   • 关闭其他占用内存的程序

2. **端口9222被占用**
   • 在命令行运行: netstat -ano | findstr :9222
   • 结束占用端口的进程

3. **用户数据目录问题**
   • 确保目录路径正确且有权限
   • 尝试使用"强制重启Chrome"按钮

4. **防火墙阻止**
   • 检查防火墙设置
   • 临时关闭杀毒软件

💡 建议：使用"强制重启Chrome"功能可以解决大部分连接问题
          `;
          
          tauriAPI.showMessage("Chrome连接超时", timeoutDiagnostics.trim());
          return;
        }
        
        // Continue checking if not connected
        if (currentStatus !== "connected") {
          checkBrowserConnection();
          
          // Implement exponential backoff for efficiency
          // First 3 attempts: 2s intervals (quick response)
          // Next 5 attempts: 3s intervals (balanced)
          // Remaining attempts: 5s intervals (patient waiting)
          if (checkCount <= 3) {
            currentInterval = 2000;
          } else if (checkCount <= 8) {
            currentInterval = 3000;
          } else {
            currentInterval = 5000;
          }
          
          scheduleNextCheck();
        } else {
          // Connected, stop monitoring
          console.log('[BrowserMonitor] Connection successful, stopping monitoring');
          stopMonitoring();
        }
      }, currentInterval);
    };
    
    // Start the monitoring cycle after initial check
    setTimeout(scheduleNextCheck, 1500);
    
    // Store the initial timeout for cleanup
    monitoringIntervalRef.current = initialTimeout;
  }, [checkBrowserConnection, tauriAPI]);

  const stopMonitoring = useCallback(() => {
    if (monitoringIntervalRef.current) {
      clearTimeout(monitoringIntervalRef.current);
      monitoringIntervalRef.current = null;
      console.log('[BrowserMonitor] Stopped optimized monitoring');
    }
    setIsMonitoringConnection(false);
  }, []);

  // Debounced monitoring control - prevents rapid start/stop cycles
  useEffect(() => {
    const shouldMonitor = isTauri && isReady && showBrowserConfig && 
                          browserStatus !== "connected" && browserStatus !== "checking";
    
    // Add debouncing to prevent rapid toggling
    const debounceDelay = 500;
    const timeoutId = setTimeout(() => {
      if (shouldMonitor && !isMonitoringRef.current) {
        console.log('[BrowserMonitor] Starting monitoring after debounce delay');
        startMonitoring();
      } else if (!shouldMonitor && isMonitoringRef.current) {
        console.log('[BrowserMonitor] Stopping monitoring after debounce delay');
        stopMonitoring();
        setConnectionCheckCount(0);
      }
    }, debounceDelay);
    
    return () => {
      clearTimeout(timeoutId);
      stopMonitoring(); // Clean up on unmount
    };
  }, [isTauri, isReady, showBrowserConfig, browserStatus, startMonitoring, stopMonitoring]);

  // Initial connection check when browser config is first shown
  useEffect(() => {
    if (showBrowserConfig && isTauri && isReady && browserStatus === "unknown") {
      console.log('[BrowserMonitor] Browser config first shown, checking initial status');
      // Wait for Tauri environment to be fully ready before checking
      const timeoutId = setTimeout(() => {
        checkBrowserConnection();
      }, 500); // Increased delay to ensure environment is ready
      
      return () => clearTimeout(timeoutId);
    }
  }, [showBrowserConfig, isTauri, isReady, browserStatus, checkBrowserConnection]);

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
      
      // 针对常见错误提供详细解决方案提示
      if (errorMessage.includes("Chrome") || errorMessage.includes("browser") || errorMessage.includes("调试端口")) {
        userMessage += `\n\n🔍 浏览器连接问题诊断：
        
1. **检查Chrome状态**
   • 确认Chrome是否正在运行
   • 检查是否有调试端口参数

2. **立即尝试**
   • 点击"强制重启Chrome"按钮
   • 使用浏览器配置中的"复制命令"
   
3. **如果仍然失败**
   • 重启计算机清除所有Chrome进程
   • 以管理员身份运行应用程序
   
💡 提示：90%的连接问题可通过强制重启Chrome解决`;
      } else if (errorMessage.includes("npx") || errorMessage.includes("Node.js")) {
        userMessage += `\n\n🔧 环境配置问题：
        
1. **Node.js环境**
   • 确保已安装Node.js (推荐版本18+)
   • 重启应用程序
   • 检查系统PATH环境变量
   
2. **权限问题**
   • 以管理员身份运行命令提示符
   • 检查系统环境变量配置`;
      } else if (errorMessage.includes("Playwright")) {
        userMessage += `\n\n🎭 Playwright依赖问题：
        
1. **安装依赖**
   • 打开命令行（管理员权限）
   • 运行: npm install -g @playwright/test
   • 运行: npx playwright install
   
2. **如果安装失败**
   • 清除npm缓存: npm cache clean --force
   • 更换npm源: npm config set registry https://registry.npmmirror.com
   • 重新安装依赖`;
      } else if (errorMessage.includes("个人档案") || errorMessage.includes("profile")) {
        userMessage += "\n\n📋 个人档案问题：\n• 请先在个人档案页面完善必要信息\n• 确保姓名、电话、邮箱等字段已填写\n• 上传身份证等身份证明文件";
      } else if (errorMessage.includes("IP资产") || errorMessage.includes("ip_asset")) {
        userMessage += "\n\n🛡️ IP资产问题：\n• 请先在IP资产页面添加至少一个作品\n• 确保作品信息完整（名称、类型、权利期间）\n• 上传相关权利证明文件";
      } else {
        // Generic error guidance
        userMessage += `\n\n🚨 通用解决步骤：
        
1. **基础检查**
   • 重启应用程序
   • 检查网络连接
   • 暂时关闭防火墙和杀毒软件
   
2. **环境问题**
   • 以管理员身份运行程序
   • 检查Chrome浏览器是否正常运行
   • 确保个人档案和IP资产信息完整
   
3. **联系支持**
   • 如问题持续，请保存错误日志
   • 联系技术支持获取帮助`;
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

  const generateBrowserCommand = async (): Promise<string> => {
    try {
      if (isTauri) {
        return await tauriAPI.getBrowserLaunchCommand();
      } else {
        // Fallback for web environment
        const userDataDir = process.platform === 'win32' 
          ? '%USERPROFILE%\\AppData\\Local\\Google\\Chrome\\User Data'
          : process.platform === 'darwin'
          ? '~/Library/Application Support/Google/Chrome'
          : '~/.config/google-chrome';
        
        return `chrome.exe --remote-debugging-port=9222 --user-data-dir="${userDataDir}"`;
      }
    } catch (error) {
      console.error('Failed to get browser launch command:', error);
      // Return a default command if the backend call fails
      return 'chrome.exe --remote-debugging-port=9222 --user-data-dir="%USERPROFILE%\\AppData\\Local\\Google\\Chrome\\User Data"';
    }
  };

  const copyBrowserCommand = useCallback(async () => {
    try {
      const command = await generateBrowserCommand();
      await navigator.clipboard.writeText(command);
      await tauriAPI.showMessage("成功", "Chrome启动命令已复制到剪贴板\n\n请在命令行中运行该命令启动Chrome，系统将自动检测连接状态");
      
      // Prepare for optimized monitoring after command is copied
      console.log('[BrowserMonitor] Preparing for monitoring after command copy');
      setConnectionCheckCount(0);
      setBrowserStatus("checking");
      
      // The debounced monitoring system will automatically start monitoring
      // after the status changes. Give user a moment to run the command first.
      setTimeout(() => {
        if (browserStatusRef.current !== "connected") {
          setBrowserStatus("starting"); // Trigger monitoring via useEffect
        }
      }, 2500); // Slightly shorter delay for better responsiveness
    } catch (error) {
      console.error('Failed to copy command:', error);
      await tauriAPI.showMessage("错误", "复制命令失败");
    }
  }, [generateBrowserCommand, tauriAPI, startMonitoring]);

  const openBrowserSettings = () => {
    setShowBrowserConfig(!showBrowserConfig);
  };

  const handleForceRestartChrome = useCallback(async () => {
    try {
      // Stop current monitoring first
      stopMonitoring();
      setBrowserStatus("checking");
      setConnectionCheckCount(0);
      
      const result = await tauriAPI.forceRestartChrome();
      await tauriAPI.showMessage("🔄 Chrome强制重启", result);
      
      // Reset status to disconnected, then transition to starting
      setBrowserStatus("disconnected");
      
      // Let the debounced monitoring system handle restart monitoring
      setTimeout(() => {
        if (showBrowserConfig && browserStatusRef.current !== "connected") {
          setBrowserStatus("starting"); // Trigger optimized monitoring
        }
      }, 3000); // Reasonable delay for Chrome to fully restart
    } catch (error) {
      console.error('Failed to force restart Chrome:', error);
      await tauriAPI.showMessage("错误", `强制重启Chrome失败: ${error instanceof Error ? error.message : '未知错误'}`);
      setBrowserStatus("disconnected");
    }
  }, [tauriAPI, stopMonitoring, startMonitoring, showBrowserConfig]);

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

      {/* Browser Connection Configuration */}
      {isTauri && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              浏览器连接配置
              <Badge variant="outline" className="ml-auto">
                {browserStatus === "connected" && <CheckCircle className="h-3 w-3 mr-1 text-green-600" />}
                {browserStatus === "disconnected" && <XCircle className="h-3 w-3 mr-1 text-red-600" />}
                {browserStatus === "checking" && <AlertCircle className="h-3 w-3 mr-1 text-yellow-600" />}
                {browserStatus === "starting" && <AlertCircle className="h-3 w-3 mr-1 text-blue-600" />}
                {browserStatus === "unknown" && <Monitor className="h-3 w-3 mr-1" />}
                {browserStatus === "connected" ? "已连接" : 
                 browserStatus === "disconnected" ? "未连接" :
                 browserStatus === "checking" ? "检查中..." :
                 browserStatus === "starting" ? "Chrome启动中..." : "未知"}
              </Badge>
            </CardTitle>
            <CardDescription>
              配置浏览器连接模式以获得最佳自动化体验
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={showBrowserConfig ? "advanced" : "simple"} className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger 
                  value="simple" 
                  onClick={() => setShowBrowserConfig(false)}
                >
                  简单模式
                </TabsTrigger>
                <TabsTrigger 
                  value="advanced" 
                  onClick={() => setShowBrowserConfig(true)}
                >
                  高级配置
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="simple" className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h3 className="font-medium">自动连接模式</h3>
                    <p className="text-sm text-muted-foreground">
                      系统将自动选择最佳连接策略
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={checkBrowserConnection}
                      variant="outline"
                      size="sm"
                      disabled={browserStatus === "checking"}
                    >
                      {browserStatus === "checking" ? "检查中..." : "检查连接"}
                    </Button>
                  </div>
                </div>
                
                {browserStatus === "starting" && (
                  <div className="p-4 border border-blue-200 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-2 text-blue-600 mb-3">
                      <AlertCircle className="h-4 w-4 animate-spin" />
                      <span className="text-sm font-medium">Chrome启动中，正在建立调试连接...</span>
                    </div>
                    
                    {/* Progress bar */}
                    <div className="space-y-2 mb-3">
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>启动进度</span>
                        <span>{connectionCheckCount}/15 ({Math.round((connectionCheckCount / 15) * 100)}%)</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.min((connectionCheckCount / 15) * 100, 100)}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-500">
                        预计等待时间: {Math.max(0, 30 - connectionCheckCount * 2)}秒
                      </div>
                    </div>

                    {/* Diagnostic messages based on progress */}
                    <div className="text-xs bg-blue-50 p-2 rounded border-l-2 border-blue-300 mb-3">
                      {connectionCheckCount <= 3 && (
                        <span className="text-blue-700">🚀 正在启动Chrome进程...</span>
                      )}
                      {connectionCheckCount > 3 && connectionCheckCount <= 8 && (
                        <span className="text-blue-700">⏳ Chrome进程已启动，正在初始化调试端口...</span>
                      )}
                      {connectionCheckCount > 8 && connectionCheckCount <= 12 && (
                        <span className="text-yellow-700">🔄 调试端口启动耗时较长，这是正常现象...</span>
                      )}
                      {connectionCheckCount > 12 && (
                        <div className="text-orange-700">
                          <div>⚠ 启动时间过长，可能的原因：</div>
                          <ul className="ml-4 mt-1 space-y-1">
                            <li>• Chrome进程启动缓慢</li>
                            <li>• 端口9222被其他程序占用</li>
                            <li>• 用户数据目录权限问题</li>
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* Cancel button */}
                    <div className="flex justify-end">
                      <Button
                        onClick={() => {
                          stopMonitoring();
                          setBrowserStatus("disconnected");
                          setConnectionCheckCount(0);
                        }}
                        variant="ghost"
                        size="sm"
                        className="text-gray-500 hover:text-gray-700"
                      >
                        取消等待
                      </Button>
                    </div>
                  </div>
                )}
                
                {browserStatus === "connected" && (
                  <div className="p-4 border border-green-200 bg-green-50 rounded-lg">
                    <h4 className="font-medium text-green-800 mb-2">✅ 连接成功</h4>
                    <p className="text-sm text-green-700 mb-2">
                      Chrome调试端口已就绪，自动化申诉功能现已可用！
                    </p>
                    <div className="flex items-center gap-2 text-xs text-green-600">
                      <CheckCircle className="h-3 w-3" />
                      <span>调试端口: 127.0.0.1:9222 ✓</span>
                    </div>
                  </div>
                )}
                
                {browserStatus === "disconnected" && (
                  <div className="p-4 border border-orange-200 bg-orange-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-3">
                      <XCircle className="h-5 w-5 text-orange-600" />
                      <h4 className="font-medium text-orange-800">Chrome调试连接未找到</h4>
                    </div>
                    
                    <div className="space-y-3 mb-4">
                      <p className="text-sm text-orange-700">
                        未检测到Chrome调试连接。请按以下步骤启动Chrome：
                      </p>
                      
                      {/* Current command display */}
                      <div className="bg-gray-800 text-gray-100 p-3 rounded text-sm font-mono">
                        chrome.exe --remote-debugging-port=9222 --user-data-dir="[用户数据目录]"
                      </div>
                      
                      {/* Comprehensive diagnostic information for failed attempts */}
                      {connectionCheckCount > 5 && (
                        <div className="space-y-3">
                          <div className="p-3 bg-red-50 border border-red-200 rounded">
                            <div className="text-sm font-medium text-red-800 mb-2">
                              🚨 连接多次失败 (已尝试{connectionCheckCount}次)
                            </div>
                            <div className="text-xs text-red-700 space-y-2">
                              <div className="font-medium">立即检查：</div>
                              <ul className="space-y-1 ml-4">
                                <li>• 打开任务管理器，搜索"chrome"查看进程</li>
                                <li>• 确认Chrome进程正在运行但未显示调试端口</li>
                                <li>• 检查命令行是否包含 --remote-debugging-port=9222</li>
                              </ul>
                            </div>
                          </div>
                          
                          {connectionCheckCount > 10 && (
                            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                              <div className="text-sm font-medium text-yellow-800 mb-2">
                                ⚡ 高级诊断步骤：
                              </div>
                              <div className="text-xs text-yellow-700 space-y-1">
                                <div>1. <strong>端口检查</strong>：命令行运行 <code className="bg-gray-800 text-white px-1 rounded">netstat -ano | findstr :9222</code></div>
                                <div>2. <strong>权限问题</strong>：以管理员身份运行命令提示符</div>
                                <div>3. <strong>防火墙</strong>：临时关闭Windows防火墙测试</div>
                                <div>4. <strong>最后手段</strong>：重启计算机清除所有Chrome进程</div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        onClick={copyBrowserCommand}
                        variant="outline"
                        size="sm"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        复制命令
                      </Button>
                      
                      <Button
                        onClick={handleForceRestartChrome}
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                      >
                        强制重启Chrome
                      </Button>
                      
                      {connectionCheckCount > 0 && (
                        <Button
                          onClick={() => {
                            setConnectionCheckCount(0);
                            setBrowserStatus("unknown");
                            checkBrowserConnection();
                          }}
                          variant="outline"
                          size="sm"
                        >
                          重新检测
                        </Button>
                      )}
                    </div>
                    
                    {/* Comprehensive help and tips */}
                    <div className="mt-3 space-y-2">
                      <div className="p-2 bg-blue-50 border-l-2 border-blue-300">
                        <div className="text-xs text-blue-700">
                          💡 <strong>智能监控</strong>：复制命令后，系统会自动监控Chrome启动状态。
                          通常需要5-15秒完成连接建立。
                        </div>
                      </div>
                      
                      <details className="text-xs">
                        <summary className="cursor-pointer text-gray-600 hover:text-gray-800 font-medium">
                          📋 完整故障排除指南 (点击展开)
                        </summary>
                        <div className="mt-2 p-3 bg-gray-50 border rounded space-y-3">
                          <div>
                            <div className="font-medium text-gray-800">🚀 启动前准备</div>
                            <ul className="text-gray-600 mt-1 space-y-1 ml-4">
                              <li>• 关闭所有现有的Chrome窗口</li>
                              <li>• 确保有管理员权限</li>
                              <li>• 检查杀毒软件是否阻止Chrome</li>
                            </ul>
                          </div>
                          
                          <div>
                            <div className="font-medium text-gray-800">🔍 连接失败排查</div>
                            <ul className="text-gray-600 mt-1 space-y-1 ml-4">
                              <li>• 步骤1：任务管理器中查看chrome.exe进程</li>
                              <li>• 步骤2：命令行运行 <code className="bg-gray-800 text-white px-1 rounded">netstat -ano | findstr :9222</code></li>
                              <li>• 步骤3：检查防火墙和杀毒软件设置</li>
                              <li>• 步骤4：尝试不同的用户数据目录</li>
                            </ul>
                          </div>
                          
                          <div>
                            <div className="font-medium text-gray-800">⚡ 快速修复方法</div>
                            <ul className="text-gray-600 mt-1 space-y-1 ml-4">
                              <li>• 使用"强制重启Chrome"按钮（推荐）</li>
                              <li>• 重启计算机（最彻底）</li>
                              <li>• 以管理员身份运行命令</li>
                              <li>• 更换不同的端口号（如9223）</li>
                            </ul>
                          </div>
                          
                          <div className="text-center pt-2 border-t text-gray-500">
                            如果问题持续，请联系技术支持并提供详细的错误日志
                          </div>
                        </div>
                      </details>
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="advanced" className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">连接策略</label>
                    <Select value={connectionMode} onValueChange={setConnectionMode}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择连接策略" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">自动选择</SelectItem>
                        <SelectItem value="connect">连接现有Chrome</SelectItem>
                        <SelectItem value="persistent">持久化上下文</SelectItem>
                        <SelectItem value="new">启动新浏览器</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {connectionMode === "auto" && "自动尝试连接现有Chrome，失败时使用持久化上下文"}
                      {connectionMode === "connect" && "仅尝试连接到已运行的Chrome调试实例"}
                      {connectionMode === "persistent" && "使用持久化上下文保持登录状态和书签"}
                      {connectionMode === "new" && "总是启动全新的浏览器实例"}
                    </p>
                  </div>
                  
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <h4 className="font-medium">连接状态</h4>
                      <div className="flex items-center gap-2">
                        {browserStatus === "connected" && (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-sm">Chrome调试端口已连接</span>
                          </div>
                        )}
                        {browserStatus === "disconnected" && (
                          <div className="flex items-center gap-2 text-red-600">
                            <XCircle className="h-4 w-4" />
                            <span className="text-sm">未检测到Chrome调试连接</span>
                          </div>
                        )}
                        {browserStatus === "checking" && (
                          <div className="flex items-center gap-2 text-yellow-600">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-sm">正在检查连接状态...</span>
                          </div>
                        )}
                        {browserStatus === "starting" && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-blue-600">
                              <AlertCircle className="h-4 w-4 animate-spin" />
                              <span className="text-sm font-medium">Chrome启动中，正在建立调试连接...</span>
                            </div>
                            
                            {/* Progress bar */}
                            <div className="space-y-2">
                              <div className="flex justify-between text-xs text-gray-600">
                                <span>启动进度</span>
                                <span>{connectionCheckCount}/15 ({Math.round((connectionCheckCount / 15) * 100)}%)</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div 
                                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${Math.min((connectionCheckCount / 15) * 100, 100)}%` }}
                                ></div>
                              </div>
                              <div className="text-xs text-gray-500">
                                预计等待时间: {Math.max(0, 30 - connectionCheckCount * 2)}秒
                              </div>
                            </div>

                            {/* Diagnostic messages based on progress */}
                            <div className="text-xs bg-blue-50 p-2 rounded border-l-2 border-blue-300">
                              {connectionCheckCount <= 3 && (
                                <span className="text-blue-700">🚀 正在启动Chrome进程...</span>
                              )}
                              {connectionCheckCount > 3 && connectionCheckCount <= 8 && (
                                <span className="text-blue-700">⏳ Chrome进程已启动，正在初始化调试端口...</span>
                              )}
                              {connectionCheckCount > 8 && connectionCheckCount <= 12 && (
                                <span className="text-yellow-700">🔄 调试端口启动耗时较长，这是正常现象...</span>
                              )}
                              {connectionCheckCount > 12 && (
                                <div className="text-orange-700">
                                  <div>⚠ 启动时间过长，可能的原因：</div>
                                  <ul className="ml-4 mt-1 space-y-1">
                                    <li>• Chrome进程启动缓慢</li>
                                    <li>• 端口9222被其他程序占用</li>
                                    <li>• 用户数据目录权限问题</li>
                                  </ul>
                                </div>
                              )}
                            </div>

                            {/* Cancel button */}
                            <div className="flex justify-end">
                              <Button
                                onClick={() => {
                                  stopMonitoring();
                                  setBrowserStatus("disconnected");
                                  setConnectionCheckCount(0);
                                }}
                                variant="ghost"
                                size="sm"
                                className="text-gray-500 hover:text-gray-700"
                              >
                                取消等待
                              </Button>
                            </div>
                          </div>
                        )}
                        {browserStatus === "unknown" && (
                          <div className="flex items-center gap-2 text-gray-600">
                            <Monitor className="h-4 w-4" />
                            <span className="text-sm">未知连接状态</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <h4 className="font-medium">快速操作</h4>
                      <div className="flex gap-2 flex-wrap">
                        <Button
                          onClick={checkBrowserConnection}
                          variant="outline"
                          size="sm"
                          disabled={browserStatus === "checking"}
                        >
                          刷新状态
                        </Button>
                        <Button
                          onClick={copyBrowserCommand}
                          variant="outline"
                          size="sm"
                        >
                          复制启动命令
                        </Button>
                        <Button
                          onClick={handleForceRestartChrome}
                          variant="outline"
                          size="sm"
                          disabled={browserStatus === "checking"}
                        >
                          强制重启Chrome
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <h4 className="font-medium text-blue-800 mb-2">💡 使用技巧</h4>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• <strong>连接现有Chrome</strong>：保持当前浏览器状态，需要手动启用调试端口</li>
                      <li>• <strong>持久化上下文</strong>：自动保持登录状态，推荐日常使用</li>
                      <li>• <strong>新浏览器</strong>：隔离环境，适合测试或临时使用</li>
                    </ul>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
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