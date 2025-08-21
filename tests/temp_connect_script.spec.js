
const { test, chromium } = require('@playwright/test');
const fs = require('fs');

test('Bilibili Appeal - Connect Mode', async () => {
    try {
        const browser = await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 15000 });
        const context = browser.contexts()[0];
        const page = context.pages()[0] || await context.newPage();
        
        await page.goto('https://www.bilibili.com/v/copyright/apply?origin=home', { timeout: 60000, waitUntil: 'networkidle' });

        await page.locator('input[placeholder="真实姓名"].el-input__inner').first().fill('Test User');
        await page.locator('input[placeholder="手机号"].el-input__inner').first().fill('13800138000');
        await page.locator('.el-form-item:has-text("邮箱") input.el-input__inner').first().fill('test@example.com');
        await page.locator('input[placeholder="证件号码"].el-input__inner').first().fill('110101199001011234');
        
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
        
        // This is now safe, as ip_section is either a valid block of code or an empty string.
        
        console.log('开始填写IP资产信息...');
        await page.locator('.el-form-item:has-text("权利人") input.el-input__inner').first().fill('酷酷酷');
        await page.locator('.el-form-item:has-text("著作类型") .el-select').first().click();
        await page.waitForTimeout(500);
        await page.locator('.el-select-dropdown__item:has-text("视频")').first().click();
        await page.locator('.el-form-item:has-text("著作名称") input.el-input__inner').first().fill('大大');
        console.log('✓ IP资产信息填写完成');
        await page.locator('button:has-text("下一步")').first().click();
        await page.waitForTimeout(2000);

        
        await page.locator('input[placeholder*="他人发布的B站侵权链接"]').first().fill('https://www.bilibili.com/video/BV1DfgzzrEd1');
        await page.locator('textarea[placeholder*="该链接内容全部"]').first().fill('该链接内容侵犯了我的版权，要求立即删除。');
        await page.locator('.el-checkbox__label:has-text("本人保证")').first().click();
        
        await new Promise(() => {}); // Keep open indefinitely
    } catch (error) {
        console.error(error);
        throw error;
    }
});
