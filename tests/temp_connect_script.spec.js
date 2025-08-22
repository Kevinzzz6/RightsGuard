
const { test, chromium } = require('@playwright/test');
const fs = require('fs');

test('Bilibili Appeal - Connect Mode with File Upload', async () => {
    try {
        console.log('🚀 开始自动化申诉流程...');
        const browser = await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 15000 });
        const context = browser.contexts()[0];
        const page = context.pages()[0] || await context.newPage();
        
        console.log('📄 导航到B站版权申诉页面...');
        await page.goto('https://www.bilibili.com/v/copyright/apply?origin=home', { timeout: 60000, waitUntil: 'networkidle' });

        console.log('✏️ 开始填写个人信息...');
        await page.locator('input[placeholder="真实姓名"].el-input__inner').first().fill("Test User");
        await page.locator('input[placeholder="手机号"].el-input__inner').first().fill("13800138000");
        await page.locator('.el-form-item:has-text("邮箱") input.el-input__inner').first().fill("test@example.com");
        await page.locator('input[placeholder="证件号码"].el-input__inner').first().fill("110101199001011234");
        console.log('✓ 个人信息填写完成');

        
        console.log('🆔 开始上传真实身份证文件（来自个人档案配置）...');
        console.log('📁 身份证文件列表:', ["test_1755856667.png", "屏幕截图 2025-07-20 115009_1755858193.png"]);
        
        try {
            const idCardFiles = ["C:\\Users\\kevin\\AppData\\Roaming\\com.rightsguard.app\\files/profiles/id_cards/test_1755856667.png", "C:\\Users\\kevin\\AppData\\Roaming\\com.rightsguard.app\\files/profiles/id_cards/屏幕截图 2025-07-20 115009_1755858193.png"];
            console.log('📊 文件数量:', idCardFiles.length, '，请确认包含身份证正反面');
            
            // ✅ 验证身份证文件完整性
            console.log('🔍 身份证文件验证开始...');
            for (let i = 0; i < idCardFiles.length; i++) {
                const filePath = idCardFiles[i];
                const fileName = filePath.split(/[/\\\\]/).pop();
                console.log(`📄 第${i+1}个文件: ${fileName}`);
                console.log(`📍 完整路径: ${filePath}`);
            }
            
            if (idCardFiles.length === 1) {
                console.log('⚠️ 只检测到1个身份证文件，建议上传正反面两张照片');
            } else if (idCardFiles.length === 2) {
                console.log('✅ 检测到2个身份证文件，符合正反面要求');
            } else {
                console.log(`📊 检测到${idCardFiles.length}个身份证文件`);
            }
            
            // 🔍 第一步：详细DOM结构分析 - 专门针对版权图片上传区域
            console.log('🔍 开始版权图片上传区域DOM结构深度分析...');
            
            try {
                // 直接定位版权图片上传区域
                const copyrightUploadArea = page.locator('.copyright-img-upload');
                const areaExists = await copyrightUploadArea.count();
                console.log(`📍 版权图片上传区域数量: ${areaExists}`);
                
                if (areaExists > 0) {
                    // 获取版权上传区域的完整HTML结构
                    const areaHTML = await copyrightUploadArea.first().innerHTML();
                    console.log('📋 版权上传区域完整HTML:');
                    console.log(areaHTML);
                    
                    // 检查el-upload--picture-card元素
                    const pictureCardUpload = await copyrightUploadArea.first().locator('.el-upload--picture-card').count();
                    console.log(`🖼️ picture-card上传组件数量: ${pictureCardUpload}`);
                    
                    // 检查加号图标
                    const plusIcon = await copyrightUploadArea.first().locator('.el-icon-plus').count();
                    console.log(`➕ 加号图标数量: ${plusIcon}`);
                    
                    // 检查文件输入元素
                    const fileInputs = await copyrightUploadArea.first().locator('input[type="file"]').count();
                    console.log(`📁 文件输入元素数量: ${fileInputs}`);
                    
                    // 逐个检查文件输入元素的详细信息
                    for (let i = 0; i < fileInputs; i++) {
                        const input = copyrightUploadArea.first().locator('input[type="file"]').nth(i);
                        const inputClass = await input.getAttribute('class') || '';
                        const inputName = await input.getAttribute('name') || '';
                        const isVisible = await input.isVisible();
                        console.log(`📁 FileInput[${i}]: class="${inputClass}", name="${inputName}", visible=${isVisible}`);
                    }
                    
                    // 检查可点击的上传触发器
                    const clickableTriggers = await copyrightUploadArea.first().locator('[tabindex="0"], .el-upload--picture-card').count();
                    console.log(`👆 可点击上传触发器数量: ${clickableTriggers}`);
                    
                    // 检查上传列表区域
                    const uploadList = await copyrightUploadArea.first().locator('.el-upload-list').count();
                    console.log(`📋 上传列表区域数量: ${uploadList}`);
                    
                } else {
                    console.log('❌ 未找到.copyright-img-upload区域！');
                    
                    // 查找其他可能的上传区域
                    const allUploadElements = await page.locator('[class*="upload"]').count();
                    console.log(`🔍 页面所有包含upload的元素数量: ${allUploadElements}`);
                    
                    const allFileInputs = await page.locator('input[type="file"]').count();
                    console.log(`📁 页面所有文件输入数量: ${allFileInputs}`);
                    
                    // 显示页面所有可能相关的class
                    const uploadClasses = await page.locator('[class*="upload"], [class*="img"], [class*="picture"]').allInnerTexts();
                    console.log('🎨 可能相关的上传元素:', uploadClasses.slice(0, 10));
                }
            } catch (domError) {
                console.error('❌ DOM分析失败:', domError.message);
            }
            
            // 🎯 基于新Playwright录制的精确方法
            const selectorStrategies = [
                // 策略1: 新Playwright录制 - 先点击加号图标，再设置文件
                { selector: 'form i:nth-child(2)', uploadSelector: '.el-upload', type: 'icon_click', name: '表单加号图标点击' },
                // 策略2: 更通用的加号图标定位
                { selector: 'form i', uploadSelector: '.el-upload', type: 'icon_click_all', name: '表单所有图标尝试' },
                // 策略3: 直接.el-upload方法（简化版）
                { selector: '.el-upload', type: 'direct_simple', name: '直接el-upload上传' },
                // 策略4: 版权区域内的.el-upload
                { selector: '.copyright-img-upload .el-upload', type: 'direct_simple', name: '版权区域el-upload' },
                // 策略5: 文件输入备选
                { selector: '.el-upload__input', type: 'input', name: '文件输入备选' },
                // 策略6: FileChooser备选
                { selector: '.el-upload', type: 'chooser', name: 'FileChooser备选' }
            ];
            
            console.log('🔍 开始6级智能选择器检测（基于Playwright录制）...');
            let uploadSuccess = false;
            
            for (let i = 0; i < selectorStrategies.length && !uploadSuccess; i++) {
                const strategy = selectorStrategies[i];
                console.log(`🎯 尝试策略${i+1}: ${strategy.name} (${strategy.selector})`);
                
                try {
                    if (strategy.type === 'icon_click') {
                        // 新录制方法: 先点击加号图标，再设置文件
                        const iconElement = page.locator(strategy.selector).nth(1);
                        const uploadElement = page.locator(strategy.uploadSelector).first();
                        
                        const iconVisible = await iconElement.isVisible({ timeout: 3000 });
                        const uploadVisible = await uploadElement.isVisible({ timeout: 3000 });
                        console.log(`   加号图标可见性: ${iconVisible}, 上传元素可见性: ${uploadVisible}`);
                        
                        if (iconVisible && uploadVisible) {
                            console.log(`🎯 使用新Playwright录制方法: 点击加号图标 + setInputFiles`);
                            
                            // 步骤1: 点击加号图标
                            await iconElement.click();
                            console.log(`👆 已点击加号图标: ${strategy.selector}`);
                            
                            // 步骤2: 设置文件到.el-upload
                            await page.waitForTimeout(500);
                            await uploadElement.setInputFiles(idCardFiles);
                            console.log(`📁 已设置文件到上传元素`);
                            
                            console.log(`✅ 策略${i+1}加号点击方法完成: ${strategy.name}`);
                            
                            // 验证上传成功
                            await page.waitForTimeout(3000);
                            const uploadItems = await page.locator('.el-upload-list__item').count();
                            console.log(`📊 检测到上传项目数量: ${uploadItems}`);
                            
                            if (uploadItems > 0) {
                                uploadSuccess = true;
                                console.log(`🎉 加号点击方法上传成功，使用策略${i+1}: ${strategy.name}`);
                                console.log(`🛑 文件上传成功，停止其他策略尝试`);
                                
                                // 防止页面晃动 - 停止所有页面滚动和鼠标事件
                                await page.evaluate(() => {
                                    document.body.style.overflow = 'hidden';
                                    window.scrollTo(0, 0);
                                });
                                await page.waitForTimeout(1000);
                                await page.evaluate(() => {
                                    document.body.style.overflow = 'auto';
                                });
                                break; // 立即退出策略循环
                            }
                        }
                        
                    } else if (strategy.type === 'icon_click_all') {
                        // 尝试所有加号图标
                        const iconElements = await page.locator(strategy.selector).all();
                        const uploadElement = page.locator(strategy.uploadSelector).first();
                        
                        console.log(`   找到${iconElements.length}个图标元素`);
                        
                        for (let iconIndex = 0; iconIndex < iconElements.length; iconIndex++) {
                            try {
                                const icon = iconElements[iconIndex];
                                const iconVisible = await icon.isVisible();
                                if (iconVisible) {
                                    console.log(`🎯 尝试点击第${iconIndex + 1}个图标`);
                                    await icon.click();
                                    await page.waitForTimeout(500);
                                    await uploadElement.setInputFiles(idCardFiles);
                                    
                                    await page.waitForTimeout(2000);
                                    const uploadItems = await page.locator('.el-upload-list__item').count();
                                    if (uploadItems > 0) {
                                        uploadSuccess = true;
                                        console.log(`🎉 第${iconIndex + 1}个图标点击成功`);
                                        console.log(`🛑 文件上传成功，停止策略尝试`);
                                        
                                        // 防止页面晃动 - 停止所有页面滚动
                                        await page.evaluate(() => {
                                            document.body.style.overflow = 'hidden';
                                            window.scrollTo(0, 0);
                                        });
                                        await page.waitForTimeout(1000);
                                        await page.evaluate(() => {
                                            document.body.style.overflow = 'auto';
                                        });
                                        break; // 退出图标循环
                                    }
                                }
                            } catch (iconError) {
                                console.log(`❌ 第${iconIndex + 1}个图标点击失败: ${iconError.message}`);
                            }
                        }
                        
                    } else if (strategy.type === 'direct_simple') {
                        // 简化的直接方法 - 只setInputFiles一次
                        const uploadElement = page.locator(strategy.selector).first();
                        const isVisible = await uploadElement.isVisible({ timeout: 3000 });
                        console.log(`   上传元素可见性: ${isVisible}`);
                        
                        if (isVisible) {
                            console.log(`🎯 使用简化直接方法: 直接setInputFiles`);
                            await uploadElement.setInputFiles(idCardFiles);
                            console.log(`📁 已设置文件: ${strategy.selector}`);
                            
                            await page.waitForTimeout(3000);
                            const uploadItems = await page.locator('.el-upload-list__item').count();
                            console.log(`📊 检测到上传项目数量: ${uploadItems}`);
                            
                            if (uploadItems > 0) {
                                uploadSuccess = true;
                                console.log(`🎉 简化直接方法上传成功，使用策略${i+1}: ${strategy.name}`);
                                console.log(`🛑 文件上传成功，停止其他策略尝试`);
                                
                                // 防止页面晃动
                                await page.evaluate(() => {
                                    document.body.style.overflow = 'hidden';
                                    window.scrollTo(0, 0);
                                });
                                await page.waitForTimeout(1000);
                                await page.evaluate(() => {
                                    document.body.style.overflow = 'auto';
                                });
                                break; // 立即退出策略循环
                            }
                        }
                        
                    } else if (strategy.type === 'input') {
                        // 直接文件输入策略
                        const element = page.locator(strategy.selector).first();
                        const isVisible = await element.isVisible({ timeout: 3000 });
                        console.log(`   可见性: ${isVisible}`);
                        
                        if (isVisible) {
                            await element.setInputFiles(idCardFiles);
                            console.log(`✅ 策略${i+1}成功: ${strategy.name}`);
                            
                            // 验证上传成功
                            await page.waitForTimeout(2000);
                            const uploadItems = await page.locator('.el-upload-list__item, .upload-list-item, .el-upload-list .el-upload-list__item').count();
                            console.log(`📊 检测到上传项目数量: ${uploadItems}`);
                            
                            if (uploadItems > 0) {
                                uploadSuccess = true;
                                console.log(`🎉 文件上传验证成功，使用策略${i+1}: ${strategy.name}`);
                                console.log(`🛑 文件上传成功，停止其他策略尝试`);
                                
                                // 防止页面晃动
                                await page.evaluate(() => {
                                    document.body.style.overflow = 'hidden';
                                    window.scrollTo(0, 0);
                                });
                                await page.waitForTimeout(1000);
                                await page.evaluate(() => {
                                    document.body.style.overflow = 'auto';
                                });
                                break; // 立即退出策略循环
                            }
                        }
                        
                    } else if (strategy.type === 'chooser') {
                        // File Chooser API策略 - 优化版本
                        const trigger = page.locator(strategy.selector).first();
                        const isVisible = await trigger.isVisible({ timeout: 3000 });
                        console.log(`   上传触发器可见性: ${isVisible}`);
                        
                        if (isVisible) {
                            console.log(`🎯 准备点击上传触发器: ${strategy.selector}`);
                            
                            // 设置文件选择器监听 - 增加超时时间
                            const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 10000 });
                            
                            // 点击触发器
                            await trigger.click();
                            console.log(`👆 已点击上传触发器，等待文件选择器...`);
                            
                            try {
                                const fileChooser = await fileChooserPromise;
                                console.log(`📁 文件选择器已打开，设置文件:`, idCardFiles);
                                
                                await fileChooser.setFiles(idCardFiles);
                                console.log(`✅ 策略${i+1}文件选择完成: ${strategy.name}`);
                                
                                // 等待上传处理
                                await page.waitForTimeout(4000);
                                
                                // 验证上传成功 - 检查多种可能的上传成功指示器
                                const uploadItemsVariants = [
                                    '.copyright-img-upload .el-upload-list__item',
                                    '.el-upload-list--picture-card .el-upload-list__item', 
                                    '.el-upload-list__item',
                                    '[class*="upload-list"] [class*="item"]'
                                ];
                                
                                let totalUploadItems = 0;
                                for (const variant of uploadItemsVariants) {
                                    const count = await page.locator(variant).count();
                                    if (count > 0) {
                                        console.log(`📊 找到${count}个上传项目 (选择器: ${variant})`);
                                        totalUploadItems = Math.max(totalUploadItems, count);
                                    }
                                }
                                
                                console.log(`📊 总上传项目数量: ${totalUploadItems}`);
                                
                                if (totalUploadItems > 0) {
                                    uploadSuccess = true;
                                    console.log(`🎉 文件上传验证成功，使用策略${i+1}: ${strategy.name}`);
                                    
                                    // 防止页面晃动
                                    await page.evaluate(() => {
                                        document.body.style.overflow = 'hidden';
                                        window.scrollTo(0, 0);
                                    });
                                    await page.waitForTimeout(1000);
                                    await page.evaluate(() => {
                                        document.body.style.overflow = 'auto';
                                    });
                                } else {
                                    console.log(`⚠️ 策略${i+1}文件选择成功但未检测到上传项目`);
                                }
                                
                            } catch (chooserError) {
                                console.log(`❌ 策略${i+1}文件选择器超时或失败: ${chooserError.message}`);
                            }
                        }
                    }
                    
                } catch (strategyError) {
                    console.log(`❌ 策略${i+1}失败: ${strategyError.message}`);
                }
            }
            
            if (!uploadSuccess) {
                console.log('⚠️ 所有6种选择器策略均未成功');
                
                // 🔍 增强调试信息 - DOM结构分析
                console.log('🔍 开始页面DOM结构分析...');
                const allFileInputs = await page.locator('input[type="file"]').count();
                console.log(`🔍 页面总文件输入控件数量: ${allFileInputs}`);
                
                // 列出所有表单项的文本内容
                try {
                    const formItems = await page.locator('.el-form-item').allTextContents();
                    console.log('🔍 页面表单项文本: ', formItems);
                    
                    // 检查上传相关元素
                    const uploadElements = await page.locator('.el-upload, [class*="upload"]').count();
                    console.log(`🔍 上传相关元素数量: ${uploadElements}`);
                    
                    // 检查按钮元素
                    const buttons = await page.locator('button, .el-button').allTextContents();
                    console.log('🔍 页面按钮文本: ', buttons.slice(0, 10)); // 前10个
                    
                } catch (debugError) {
                    console.log('调试信息获取失败:', debugError.message);
                }
            }
            
        } catch (error) {
            console.error('❌ 身份证文件上传整体失败: ', error);
        }
        
        console.log('⏳ 等待用户完成人工验证...');
        fs.writeFileSync("C:\\Users\\kevin\\Desktop\\Code\\RG\\waiting_for_verification.txt", 'waiting');
        while (true) {
            if (fs.existsSync("C:\\Users\\kevin\\Desktop\\Code\\RG\\verification_completed.txt")) {
                fs.unlinkSync("C:\\Users\\kevin\\Desktop\\Code\\RG\\verification_completed.txt");
                fs.unlinkSync("C:\\Users\\kevin\\Desktop\\Code\\RG\\waiting_for_verification.txt");
                break;
            }
            await page.waitForTimeout(1000);
        }
        console.log('✓ 人工验证已完成');
        
        await page.locator('button:has-text("下一步")').first().click();
        await page.waitForTimeout(2000);
        
        // This is now safe, as ip_section is either a valid block of code or an empty string.
        
        console.log('开始填写IP资产信息...');
        await page.locator('.el-form-item:has-text("权利人") input.el-input__inner').first().fill("酷酷酷");
        await page.locator('.el-form-item:has-text("著作类型") .el-select').first().click();
        await page.waitForTimeout(500);
        await page.locator('.el-select-dropdown__item:has-text("视频")').first().click();
        await page.locator('.el-form-item:has-text("著作名称") input.el-input__inner').first().fill("大大");
        console.log('✓ IP资产信息填写完成');
        await page.locator('button:has-text("下一步")').first().click();
        await page.waitForTimeout(2000);


        
        console.log('📋 开始上传授权证明文件...');
        console.log('📁 文件列表:', ["屏幕截图 2025-07-20 120221.png"]);
        
        try {
            const authFiles = ["C:\\Users\\kevin\\Pictures\\Screenshots\\屏幕截图 2025-07-20 120221.png"];
            const authFileInput = page.locator('.el-form-item:has-text("授权证明") input[type="file"]');
            await page.waitForTimeout(1000); // Wait for form to be ready
            
            const isVisible = await authFileInput.isVisible({ timeout: 5000 });
            console.log('🔍 授权证明文件上传控件可见性: ', isVisible);
            
            if (isVisible) {
                await authFileInput.setInputFiles(authFiles);
                console.log('✅ 授权证明文件上传完成，文件数量:', authFiles.length);
                
                // Wait and check for upload success
                await page.waitForTimeout(3000);
                const uploadSuccess = await page.locator('.el-form-item:has-text("授权证明") .el-upload-list__item').count();
                console.log('📊 上传成功文件数量: ', uploadSuccess);
                
            } else {
                console.log('⚠️ 授权证明文件上传控件未找到');
                // Alternative selector attempts
                const altSelector1 = await page.locator('.el-form-item:has-text("授权") input[type="file"]').isVisible({ timeout: 1000 });
                const altSelector2 = await page.locator('input[type="file"][accept*="image"]').count();
                console.log('🔍 备用选择器1可见性: ', altSelector1);
                console.log('🔍 图片文件输入数量: ', altSelector2);
            }
        } catch (error) {
            console.error('❌ 授权证明文件上传失败: ', error);
        }

                console.log('ℹ️ 无作品证明文件需要上传');
        
        console.log('📝 填写申诉详情...');
        await page.locator('input[placeholder*="他人发布的B站侵权链接"]').first().fill("https://www.bilibili.com/v/copyright/apply?origin=home");
        await page.locator('textarea[placeholder*="该链接内容全部"]').first().fill('该链接内容侵犯了我的版权，要求立即删除。');
        await page.locator('.el-checkbox__label:has-text("本人保证")').first().click();
        console.log('✓ 申诉详情填写完成');
        
        console.log('🎉 自动化申诉流程准备就绪，保持页面打开供用户最终确认...');
        await new Promise(() => {}); // Keep open indefinitely
    } catch (error) {
        console.error('❌ 自动化申诉流程失败:', error);
        throw error;
    }
});
