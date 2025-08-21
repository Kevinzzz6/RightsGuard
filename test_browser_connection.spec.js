// 简单的浏览器连接测试脚本
// 运行: node test_browser_connection.spec.js 或在Playwright测试中

const { test, expect } = require('@playwright/test');

test('Tauri环境检测测试', async ({ page }) => {
  // 导航到应用
  await page.goto('http://localhost:3000');
  
  // 等待页面加载
  await page.waitForLoadState('networkidle');
  
  // 检查控制台日志
  const logs = [];
  page.on('console', msg => {
    if (msg.text().includes('[TauriAPI]') || msg.text().includes('[useTauri]')) {
      logs.push(msg.text());
      console.log('🔍', msg.text());
    }
  });
  
  // 等待一段时间让环境检测完成
  await page.waitForTimeout(2000);
  
  // 检查是否有相关的日志输出
  const hasRuntimeCheck = logs.some(log => log.includes('Runtime environment check'));
  const hasEnvironmentDetected = logs.some(log => log.includes('environment detected'));
  
  console.log('📊 检测到的日志:');
  logs.forEach(log => console.log('  ', log));
  
  console.log('\n✅ 测试结果:');
  console.log('  - 运行时检测:', hasRuntimeCheck ? '✅ 已执行' : '❌ 未执行');
  console.log('  - 环境检测完成:', hasEnvironmentDetected ? '✅ 已完成' : '❌ 未完成');
  
  // 可以添加更多断言
  if (hasRuntimeCheck) {
    console.log('\n🎉 SSR环境问题修复成功！');
  } else {
    console.log('\n⚠️  可能还需要进一步调试');
  }
});

test('浏览器连接状态测试', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');
  
  // 查找浏览器配置相关的元素
  const browserConfigButton = page.locator('text=浏览器配置').first();
  if (await browserConfigButton.isVisible()) {
    console.log('🔍 找到浏览器配置按钮，点击测试...');
    await browserConfigButton.click();
    
    // 等待连接检测
    await page.waitForTimeout(1000);
    
    // 查找连接状态
    const statusElements = await page.locator('[data-testid="browser-status"], .text-green-600, .text-red-600, .text-blue-600').all();
    
    if (statusElements.length > 0) {
      console.log('✅ 找到浏览器连接状态显示');
    } else {
      console.log('⚠️  未找到浏览器连接状态显示');
    }
  } else {
    console.log('⚠️  未找到浏览器配置按钮');
  }
});