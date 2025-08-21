import { useState, useEffect } from 'react';
import { tauriAPI } from '@/lib/tauri-api';

export function useTauri() {
  const [isTauri, setIsTauri] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // 异步检查Tauri环境 - 兼容新的运行时检测机制
    const checkTauriEnvironment = async () => {
      try {
        console.log('[useTauri] Starting environment check...');
        
        // 使用新的异步检测方法
        const inTauri = await tauriAPI.isInTauri();
        console.log('[useTauri] Tauri environment detected:', inTauri);
        
        setIsTauri(inTauri);
        
        // 如果在Tauri环境中，确保API完全就绪
        if (inTauri) {
          console.log('[useTauri] Tauri environment confirmed, waiting for API ready state...');
          // 稍微等待确保所有初始化完成
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        console.log('[useTauri] Environment check completed, setting ready state');
        setIsReady(true);
      } catch (error) {
        console.error('[useTauri] Failed to check Tauri environment:', error);
        // 发生错误时也要设置为ready，避免无限等待
        setIsTauri(false);
        setIsReady(true);
      }
    };

    // 只在浏览器环境中执行检测
    if (typeof window !== 'undefined') {
      checkTauriEnvironment();
    } else {
      // SSR环境下直接设置为false和ready
      console.log('[useTauri] SSR environment detected, skipping Tauri check');
      setIsTauri(false);
      setIsReady(true);
    }
  }, []);

  return {
    isTauri,
    isReady,
    tauriAPI
  };
}