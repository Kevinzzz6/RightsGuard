import { useState, useEffect } from 'react';
import { tauriAPI } from '@/lib/tauri-api';

export function useTauri() {
  const [isTauri, setIsTauri] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // 检查是否在Tauri环境中
    const checkTauriEnvironment = async () => {
      try {
        const inTauri = tauriAPI.isInTauri();
        setIsTauri(inTauri);
        
        // 如果在Tauri环境中，等待Tauri API完全加载
        if (inTauri) {
          // 等待一小段时间确保Tauri API已加载
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        setIsReady(true);
      } catch (error) {
        console.error('Failed to check Tauri environment:', error);
        setIsReady(true);
      }
    };

    checkTauriEnvironment();
  }, []);

  return {
    isTauri,
    isReady,
    tauriAPI
  };
}