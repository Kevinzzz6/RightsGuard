
const { test, chromium } = require('@playwright/test');
const fs = require('fs');

test('Bilibili Appeal - Smart Connect Mode', async () => {
    let browser;
    let context;
    let page;
    
    try {
        try {
            console.log('策略1: 尝试连接到已运行的Chrome调试实例...');
            browser = await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 10000 });
            context = browser.contexts()[0];
            page = context.pages()[0] || await context.newPage();
            console.log('✓ 成功连接到现有Chrome实例!');
        } catch (cdpError) {
            console.log('策略1失败:', cdpError.message);
            
            try {
                console.log('策略2: 使用持久化上下文启动Chrome...');
                const userDataDir = 'C:\\Users\\kevin\\AppData\\Local\\RightsGuard\\ChromeProfile';
                context = await chromium.launchPersistentContext(userDataDir, {
                    headless: false,
                    args: ['--no-first-run', '--no-default-browser-check', '--disable-blink-features=AutomationControlled'],
                    ignoreDefaultArgs: ['--enable-automation']
                });
                page = context.pages()[0] || await context.newPage();
                console.log('✓ 成功启动持久化Chrome上下文!');
            } catch (persistentError) {
                console.log('策略2失败:', persistentError.message);
                
                console.log('策略3: 使用标准浏览器启动...');
                browser = await chromium.launch({ headless: false });
                context = await browser.newContext();
                page = await context.newPage();
                console.log('✓ 成功启动标准Chrome实例!');
            }
        }
        
        console.log('正在导航到B站申诉页面...');
        await page.goto('https://www.bilibili.com/v/copyright/apply?origin=home', { 
            timeout: 60000,
            waitUntil: 'networkidle' 
        });
        console.log('✓ 成功导航到B站申诉页面');
        await page.waitForTimeout(2000);
        
        try {
            const nameLocator = page.locator('input[placeholder="真实姓名"].el-input__inner').first();
            await nameLocator.waitFor({ state: 'visible', timeout: 5000 });
            console.log('✓ 用户已登录');
        } catch {
            console.log('检测到未登录状态，请先手动登录...');
            await page.waitForSelector('input[placeholder="真实姓名"].el-input__inner', { timeout: 120000 });
            console.log('✓ 检测到已登录，继续申诉流程');
        }

        console.log('开始填写申诉表单...');
        await page.locator('input[placeholder="真实姓名"].el-input__inner').first().fill('Test User');
        await page.locator('input[placeholder="手机号"].el-input__inner').first().fill('13800138000');
        await page.locator('.el-form-item:has-text("邮箱") input.el-input__inner').first().fill('test@example.com');
        await page.locator('input[placeholder="证件号码"].el-input__inner').first().fill('110101199001011234');
        console.log('✓ 基本信息填写完成');
        
        console.log('请手动完成滑块验证和短信验证...');
        fs.writeFileSync('waiting_for_verification.txt', 'waiting');
        while (true) {
            if (fs.existsSync('verification_completed.txt')) {
                fs.unlinkSync('verification_completed.txt');
                fs.unlinkSync('waiting_for_verification.txt');
                break;
            }
            await page.waitForTimeout(1000);
        }
        
        console.log('✓ 验证完成，继续申诉流程');
        await page.locator('button:has-text("下一步")').first().click();
        await page.waitForTimeout(2000);
        
        
        await page.locator('.el-form-item:has-text("权利人") input.el-input__inner').first().fill('酷酷酷');
        await page.waitForTimeout(500);
        await page.locator('.el-form-item:has-text("著作类型") .el-select').first().click();
        await page.waitForTimeout(500);
        await page.locator('.el-select-dropdown__item:has-text("视频")').first().click();
        await page.waitForTimeout(500);
        await page.locator('.el-form-item:has-text("著作名称") input.el-input__inner').first().fill('大大');

        if ("
        await page.locator('.el-form-item:has-text("权利人") input.el-input__inner').first().fill('酷酷酷');
        await page.waitForTimeout(500);
        await page.locator('.el-form-item:has-text("著作类型") .el-select').first().click();
        await page.waitForTimeout(500);
        await page.locator('.el-select-dropdown__item:has-text("视频")').first().click();
        await page.waitForTimeout(500);
        await page.locator('.el-form-item:has-text("著作名称") input.el-input__inner').first().fill('大大');
" !== "") {
            console.log('✓ IP资产信息填写完成');
            await page.locator('button:has-text("下一步")').first().click();
            await page.waitForTimeout(2000);
        }
        
        console.log('填写侵权信息...');
        await page.locator('input[placeholder*="他人发布的B站侵权链接"]').first().fill('https://www.bilibili.com/video/BV1DfgzzrEd1');
        await page.locator('textarea[placeholder*="该链接内容全部"]').first().fill('该链接内容侵犯了我的版权，要求立即删除。');
        await page.locator('.el-checkbox__label:has-text("本人保证")').first().click();
        console.log('✓ 申诉表单填写完毕');
        
        console.log('请检查表单内容无误后手动点击提交按钮');
        await page.waitForTimeout(300000);

    } catch (error) {
        console.error('[错误] 自动化脚本执行失败:', error);
        throw error;
    } finally {
        // Cleanup logic
    }
});
