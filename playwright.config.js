// playwright.config.js
const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 300000, // 5分钟超时，足够完成人工验证
  expect: {
    timeout: 10000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    headless: false, // 使用有头模式，方便人工验证
    baseURL: 'https://www.bilibili.com',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        headless: false,
      },
    },
    {
      name: 'system-browser',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        headless: false,
        // 配置浏览器启动参数
        launchOptions: {
          args: [
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-blink-features=AutomationControlled',
            '--disable-web-security'
          ]
        }
      },
    },
    {
      name: 'system-browser-edge',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'msedge',
        headless: false,
        // 配置浏览器启动参数
        launchOptions: {
          args: [
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-blink-features=AutomationControlled'
          ]
        }
      },
    },
    {
      name: 'persistent-chrome',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
        headless: false,
      },
      // 使用持久化上下文保持用户登录状态
      testDir: './persistent-tests',
    },
  ],

  // 运行前确保依赖已安装
  webServer: undefined,
});