
const { test, chromium } = require('@playwright/test');
const fs = require('fs');

test('Bilibili Appeal - Smart Connect Mode', async () => {
    let browser;
    let context;
    let page;
    
    try {
        try {
            browser = await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 10000 });
            context = browser.contexts()[0];
            page = context.pages()[0] || await context.newPage();
        } catch (cdpError) {
            // Fallback strategies removed for simplicity to rely on start_chrome_with_remote_debugging
            console.error('无法连接到Chrome调试实例。请确保已通过程序启动Chrome。', cdpError);
            throw cdpError;
        }
        
        await page.goto('https://www.bilibili.com/v/copyright/apply?origin=home', { 
            timeout: 60000,
            waitUntil: 'networkidle' 
        });

        await page.locator('input[placeholder="真实姓名"].el-input__inner').first().fill('Test User');
        await page.locator('input[placeholder="手机号"].el-input__inner').first().fill('13800138000');
        await page.locator('.el-form-item:has-text("邮箱") input.el-input__inner').first().fill('test@example.com');
        await page.locator('input[placeholder="证件号码"].el-input__inner').first().fill('110101199001011234');
        
        console.log('请手动完成滑块验证和短信验证...');
        fs.writeFileSync('C:\\Users\\kevin\\Desktop\\Code\\RG\\waiting_for_verification.txt', 'waiting');
        while (true) {
            if (fs.existsSync('C:\\Users\\kevin\\Desktop\\Code\\RG\\verification_completed.txt')) {
                fs.unlinkSync('C:\\Users\\kevin\\Desktop\\Code\\RG\\verification_completed.txt');
                fs.unlinkSync('C:\\Users\\kevin\\Desktop\\Code\\RG\\waiting_for_verification.txt');
                break;
            }
            await page.waitForTimeout(1000);
        }
        
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
            await page.locator('button:has-text("下一步")').first().click();
            await page.waitForTimeout(2000);
        }
        
        await page.locator('input[placeholder*="他人发布的B站侵权链接"]').first().fill('https://www.bilibili.com/video/BV1DfgzzrEd1');
        await page.locator('textarea[placeholder*="该链接内容全部"]').first().fill('该链接内容侵犯了我的版权，要求立即删除。');
        await page.locator('.el-checkbox__label:has-text("本人保证")').first().click();
        
        await page.waitForTimeout(300000);

    } catch (error) {
        console.error('[错误] 自动化脚本执行失败:', error);
        throw error;
    } finally {
        // Cleanup logic
    }
});
