
const { test, chromium } = require('@playwright/test');
const fs = require('fs');

test('Bilibili Appeal - Connect Mode with File Upload', async () => {
    try {
        console.log('🚀 开始自动化申诉流程...');
        console.log('⏰ 脚本启动时间:', new Date().toISOString());
        console.log('🔍 关键修复验证: 逐个文件上传机制已启用');
        console.log('🎯 预期效果: 上传真实可查看的图片，支持多文件上传');
        console.log('🔧 Playwright脚本已启动并开始执行 - 如果你看到这条消息，说明JavaScript语法正确');
        const browser = await chromium.connectOverCDP('http://127.0.0.1:9222', { timeout: 15000 });
        const context = browser.contexts()[0];
        const page = context.pages()[0] || await context.newPage();
        
        console.log('\\n⏰ 阶段1开始时间:', new Date().toISOString());
        console.log('📄 导航到B站版权申诉页面...');
        console.log('🌐 页面导航开始 - 目标URL: https://www.bilibili.com/v/copyright/apply?origin=home');
        await page.goto('https://www.bilibili.com/v/copyright/apply?origin=home', { timeout: 60000, waitUntil: 'networkidle' });
        console.log('✅ 页面导航完成，开始填写表单...');

        console.log('\\n⏰ 阶段2开始时间:', new Date().toISOString());
        console.log('✏️ 开始填写个人信息...');
        await page.locator('input[placeholder="真实姓名"].el-input__inner').first().fill("Test User");
        await page.locator('input[placeholder="手机号"].el-input__inner').first().fill("13798396696");
        await page.locator('.el-form-item:has-text("邮箱") input.el-input__inner').first().fill("test@example.com");
        await page.locator('input[placeholder="证件号码"].el-input__inner').first().fill("110101199001011234");
        console.log('✓ 个人信息填写完成');

        console.log('\\n⏰ 阶段3开始时间:', new Date().toISOString());
        console.log('🔥 关键阶段：身份证文件上传开始...');
        
        console.log('🆔 开始上传真实身份证文件（来自个人档案配置）...');
        console.log('📁 身份证文件列表:', ["test_1756095658.png", "屏幕截图 2025-07-20 115009_1756095658.png"]);
        console.log('🚦 文件上传模块启动 - 即将开始上传流程...');
        
        try {
            const idCardFiles = ["C:\\Users\\kevin\\AppData\\Roaming\\com.rightsguard.app\\files\\profiles\\id_cards\\test_1756095658.png", "C:\\Users\\kevin\\AppData\\Roaming\\com.rightsguard.app\\files\\profiles\\id_cards\\屏幕截图 2025-07-20 115009_1756095658.png"];
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
            console.log('🎯 DEBUG: 检查修复后的策略是否生效 - 这是新增的调试信息');
            
            // 🔍 关键诊断：检查所有可能的文件输入元素
            console.log('🔍 开始全面文件输入元素检测...');
            try {
                // 检查.el-upload__input元素
                const elUploadInputCount = await page.locator('.el-upload__input').count();
                console.log(`📊 .el-upload__input 元素数量: ${elUploadInputCount}`);
                
                if (elUploadInputCount > 0) {
                    for (let i = 0; i < elUploadInputCount; i++) {
                        const element = page.locator('.el-upload__input').nth(i);
                        const isVisible = await element.isVisible();
                        const isEnabled = await element.isEnabled();
                        const attributes = await element.evaluate(el => {
                            return {
                                id: el.id,
                                className: el.className,
                                name: el.name,
                                type: el.type,
                                accept: el.accept,
                                multiple: el.multiple,
                                style: el.style.cssText
                            };
                        });
                        console.log(`📄 .el-upload__input[${i}]: visible=${isVisible}, enabled=${isEnabled}`);
                        console.log(`📄 属性:`, JSON.stringify(attributes, null, 2));
                    }
                }
                
                // 检查所有input[type=\"file\"]元素
                const allFileInputs = await page.locator('input[type=\"file\"]').count();
                console.log(`📊 所有 input[type=\"file\"] 数量: ${allFileInputs}`);
                
                if (allFileInputs > 0) {
                    for (let i = 0; i < Math.min(allFileInputs, 3); i++) { // 限制检查前3个
                        const element = page.locator('input[type=\"file\"]').nth(i);
                        const isVisible = await element.isVisible();
                        const isEnabled = await element.isEnabled();
                        const selector = await element.evaluate(el => {
                            // 生成元素的唯一选择器
                            const classes = el.className ? '.' + el.className.split(' ').join('.') : '';
                            const id = el.id ? '#' + el.id : '';
                            return `input[type=\"file\"]${id}${classes}`;
                        });
                        console.log(`📄 FileInput[${i}]: visible=${isVisible}, enabled=${isEnabled}, selector: ${selector}`);
                    }
                }
                
                // 检查.el-upload元素
                const elUploadCount = await page.locator('.el-upload').count();
                console.log(`📊 .el-upload 元素数量: ${elUploadCount}`);
                
            } catch (domAnalysisError) {
                console.error('❌ 文件输入元素检测失败:', domAnalysisError.message);
            }
            
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
            
            // 🎯 优化策略顺序 - 优先使用不依赖文件选择器的方法
            const selectorStrategies = [
                // 策略1: Element UI组件直接API调用 - 最专业的方法
                { selector: '.el-upload', type: 'element_ui_api', name: 'Element UI组件API直接调用' },
                // 策略2: 隐藏文件输入直接设置 - 最可靠，不检查可见性
                { selector: '.el-upload__input', type: 'hidden_input', name: '隐藏文件输入直接设置' },
                // 策略3: 通用文件输入直接设置 - 需要检查可见性
                { selector: 'input[type=\"file\"]', type: 'visible_input', name: '通用文件输入直接设置' },
                // 策略4: FileChooser API方法 - 如果支持的话，程序化设置
                { selector: '.el-upload', type: 'chooser', name: 'FileChooser API设置' },
                // 策略5: 用户验证方法作为最后备用 - 可能打开选择界面
                { selector: '.el-upload', type: 'fallback', name: '点击后直接设置（备用）' }
            ];
            
            console.log('🔍 开始5级智能选择器检测（Element UI API优先，避免文件选择器依赖）...');
            
            // 🔍 增强文件验证和错误处理
            console.log('📁 开始全面文件验证...');
            let validFiles = [];
            let fileValidationErrors = [];
            
            for (let i = 0; i < idCardFiles.length; i++) {
                const filePath = idCardFiles[i];
                console.log(`\n🔍 验证文件${i+1}: ${filePath}`);
                
                try {
                    const fs = require('fs');
                    const exists = fs.existsSync(filePath);
                    
                    if (exists) {
                        const stats = fs.statSync(filePath);
                        const fileName = filePath.split(/[/\\\\]/).pop();
                        const fileSize = stats.size;
                        const isImage = /\.(png|jpg|jpeg|gif|bmp|webp)$/i.test(fileName);
                        
                        console.log(`✅ 文件${i+1}验证通过:`);
                        console.log(`   📄 文件名: ${fileName}`);
                        console.log(`   📊 文件大小: ${fileSize} bytes (${(fileSize/1024/1024).toFixed(2)} MB)`);
                        console.log(`   🖼️ 图片格式: ${isImage ? '是' : '否'}`);
                        console.log(`   📅 修改时间: ${stats.mtime}`);
                        
                        // 检查文件大小合理性
                        if (fileSize === 0) {
                            console.log(`⚠️ 文件${i+1}大小为0，可能是空文件`);
                            fileValidationErrors.push(`文件${i+1}为空文件`);
                        } else if (fileSize > 10 * 1024 * 1024) {
                            console.log(`⚠️ 文件${i+1}超过10MB，可能过大`);
                        }
                        
                        if (!isImage) {
                            console.log(`⚠️ 文件${i+1}可能不是图片格式`);
                        }
                        
                        validFiles.push(filePath);
                        
                    } else {
                        console.log(`❌ 文件${i+1}不存在: ${filePath}`);
                        fileValidationErrors.push(`文件${i+1}不存在: ${filePath}`);
                        
                        // 路径问题诊断
                        console.log(`🔍 路径诊断:`);
                        console.log(`   长度: ${filePath.length} 字符`);
                        console.log(`   包含空格: ${filePath.includes(' ') ? '是' : '否'}`);
                        console.log(`   包含中文: ${/[\u4e00-\u9fa5]/.test(filePath) ? '是' : '否'}`);
                        
                        // 尝试备选路径
                        const altPaths = [
                            filePath.replace(/\\\\/g, '/'),
                            filePath.replace(/\\//g, '\\\\'),
                            filePath.normalize()
                        ];
                        
                        for (const altPath of altPaths) {
                            if (fs.existsSync(altPath)) {
                                console.log(`✅ 在备选路径找到文件: ${altPath}`);
                                validFiles.push(altPath);
                                break;
                            }
                        }
                    }
                } catch (fileError) {
                    console.error(`❌ 验证文件${i+1}时出错:`, fileError.message);
                    fileValidationErrors.push(`文件${i+1}验证错误: ${fileError.message}`);
                }
            }
            
            // 验证结果总结
            console.log(`\n📋 文件验证结果:`);
            console.log(`   ✅ 有效文件: ${validFiles.length}/${idCardFiles.length}`);
            console.log(`   ❌ 错误数量: ${fileValidationErrors.length}`);
            
            if (fileValidationErrors.length > 0) {
                console.log(`⚠️ 发现的问题:`);
                fileValidationErrors.forEach((error, index) => {
                    console.log(`   ${index + 1}. ${error}`);
                });
            }
            
            if (validFiles.length === 0) {
                console.log(`❌ 没有找到有效的文件，无法继续上传`);
                throw new Error(`没有找到有效的身份证文件。请检查个人档案中的文件配置。`);
            }
            
            // 使用验证通过的文件进行上传
            console.log(`🚀 将使用${validFiles.length}个有效文件进行上传`);
            const finalFiles = validFiles;
            
            let uploadSuccess = false;
            
            for (let i = 0; i < selectorStrategies.length && !uploadSuccess; i++) {
                const strategy = selectorStrategies[i];
                console.log(`\\n🎯 尝试策略${i+1}: ${strategy.name} (${strategy.selector})`);
                console.log(`🔍 策略类型: ${strategy.type} - 这将决定执行路径`);
                
                try {
                    if (strategy.type === 'element_ui_api') {
                        // Element UI组件API直接调用策略 - 最专业的方法
                        console.log(`🎯 使用Element UI组件API直接调用方法`);
                        const uploadComponents = page.locator(strategy.selector);
                        const componentCount = await uploadComponents.count();
                        console.log(`   Element UI上传组件数量: ${componentCount}`);
                        
                        if (componentCount > 0) {
                            console.log(`🔍 尝试直接调用Element UI Upload组件方法...`);
                            
                            // 尝试每个Upload组件
                            for (let j = 0; j < componentCount; j++) {
                                const component = uploadComponents.nth(j);
                                console.log(`🔍 处理第${j+1}个Upload组件...`);
                                
                                try {
                                    const apiCallResult = await component.evaluate((el, files) => {
                                        console.log('📡 开始Element UI API调用...');
                                        
                                        // 查找Vue实例
                                        let vueInstance = el.__vue__ || el._vueParentComponent;
                                        if (!vueInstance && el.__vueParentComponent) {
                                            vueInstance = el.__vueParentComponent.ctx;
                                        }
                                        
                                        if (vueInstance) {
                                            console.log('📡 找到Vue实例，组件类型:', vueInstance.$options.name || 'Unknown');
                                            
                                            // ❌ 不使用Mock File - 这会导致上传空内容
                                            // ✅ Element UI API策略暂时跳过，因为无法传递真实文件内容
                                            console.log('⚠️ Element UI API策略需要真实File对象，当前跳过此策略');
                                            console.log('💡 建议使用hidden_input策略，可以直接设置文件路径');
                                            return { success: false, error: 'Cannot create real File objects with content in browser context' };
                                        } else {
                                            console.log('❌ 未找到Vue实例');
                                            return { success: false, error: 'Vue instance not found' };
                                        }
                                    }, finalFiles);
                                    
                                    console.log(`📊 API调用结果:`, JSON.stringify(apiCallResult, null, 2));
                                    
                                    if (apiCallResult.success) {
                                        console.log(`🎉 Element UI API调用成功！使用方法: ${apiCallResult.method}`);
                                        
                                        // 等待处理完成
                                        await page.waitForTimeout(3000);
                                        
                                        // 验证上传成功
                                        const uploadItemsVariants = [
                                            '.copyright-img-upload .el-upload-list__item',
                                            '.el-upload-list--picture-card .el-upload-list__item', 
                                            '.el-upload-list__item',
                                            '[class*=\"upload-list\"] [class*=\"item\"]',
                                            '.el-upload-list .el-upload-list__item'
                                        ];
                                        
                                        let totalUploadItems = 0;
                                        for (const variant of uploadItemsVariants) {
                                            const count = await page.locator(variant).count();
                                            if (count > 0) {
                                                console.log(`📊 找到${count}个上传项目 (选择器: ${variant})`);
                                                totalUploadItems = Math.max(totalUploadItems, count);
                                            }
                                        }
                                        
                                        if (totalUploadItems > 0) {
                                            uploadSuccess = true;
                                            console.log(`🎉 Element UI API上传成功，使用策略${i+1}: ${strategy.name}`);
                                            break; // 退出组件循环
                                        }
                                    }
                                    
                                } catch (componentError) {
                                    console.log(`❌ 第${j+1}个组件处理失败: ${componentError.message}`);
                                }
                            }
                            
                            if (uploadSuccess) {
                                console.log(`🛑 Element UI API上传成功，停止其他策略尝试`);
                                break; // 立即退出策略循环
                            }
                        }
                        
                    } else if (strategy.type === 'chooser') {
                        // File Chooser API策略 - 增强版本，处理文件选择界面
                        console.log(`🎯 使用FileChooser API方法`);
                        const trigger = page.locator(strategy.selector).first();
                        const isVisible = await trigger.isVisible({ timeout: 3000 });
                        console.log(`   上传触发器可见性: ${isVisible}`);
                        
                        if (isVisible) {
                            console.log(`🎯 准备点击上传触发器: ${strategy.selector}`);
                            
                            // 设置文件选择器监听 - 增加超时时间并处理多个可能的事件
                            const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 15000 });
                            
                            // 点击触发器
                            console.log(`👆 点击上传触发器...`);
                            await trigger.click();
                            console.log(`⏳ 等待文件选择器事件...`);
                            
                            try {
                                const fileChooser = await fileChooserPromise;
                                console.log(`📁 FileChooser事件已触发！`);
                                console.log(`🔍 FileChooser详细信息: isMultiple=${fileChooser.isMultiple()}`);
                                
                                // 设置文件 - 使用验证通过的文件
                                console.log(`📂 开始设置${finalFiles.length}个验证通过的文件`);
                                console.log(`📋 文件清单:`, finalFiles.map(f => f.split(/[/\\\\]/).pop()));
                                await fileChooser.setFiles(finalFiles);
                                console.log(`✅ FileChooser文件设置完成，避免了用户手动选择`);
                                
                                // 等待上传处理 - 增加等待时间
                                console.log(`⏳ 等待文件上传和处理...`);
                                await page.waitForTimeout(5000);
                                
                                // 验证上传成功 - 检查多种可能的上传成功指示器
                                const uploadItemsVariants = [
                                    '.copyright-img-upload .el-upload-list__item',
                                    '.el-upload-list--picture-card .el-upload-list__item', 
                                    '.el-upload-list__item',
                                    '[class*=\"upload-list\"] [class*=\"item\"]'
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
                                    console.log(`🎉 FileChooser方法上传成功，使用策略${i+1}: ${strategy.name}`);
                                    
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
                                } else {
                                    console.log(`⚠️ 策略${i+1}FileChooser成功但未检测到上传项目`);
                                    console.log(`🔍 可能需要等待更长时间或触发其他事件`);
                                }
                                
                            } catch (chooserError) {
                                console.log(`❌ 策略${i+1}FileChooser超时或失败: ${chooserError.message}`);
                                console.log(`💡 FileChooser可能不被此页面支持，继续尝试其他方法`);
                            }
                        }
                        
                        
                        
                    } else if (strategy.type === 'hidden_input') {
                        // 隐藏文件输入策略 - 不检查可见性，直接设置文件
                        console.log(`🎯 使用隐藏输入策略，跳过可见性检查`);
                        console.log(`🔍 正在搜索选择器: ${strategy.selector}`);
                        const element = page.locator(strategy.selector).first();
                        
                        try {
                            // 检查元素是否存在
                            const elementCount = await element.count();
                            console.log(`   隐藏输入元素数量: ${elementCount}`);
                            
                            if (elementCount > 0) {
                                // 🔍 详细的元素状态检查
                                console.log(`🔍 检查隐藏输入元素详细信息...`);
                                const elementInfo = await element.evaluate(el => {
                                    return {
                                        tagName: el.tagName,
                                        type: el.type,
                                        className: el.className,
                                        id: el.id,
                                        name: el.name,
                                        accept: el.accept,
                                        multiple: el.multiple,
                                        disabled: el.disabled,
                                        readOnly: el.readOnly,
                                        style: {
                                            display: el.style.display,
                                            visibility: el.style.visibility,
                                            opacity: el.style.opacity
                                        },
                                        offsetParent: el.offsetParent !== null,
                                        files: el.files ? el.files.length : 0
                                    };
                                });
                                console.log(`📊 元素信息:`, JSON.stringify(elementInfo, null, 2));
                                
                                // 🔍 关键修复：逐个文件上传而非一次性多文件上传
                                console.log(`📁 开始逐个文件上传策略，避免多文件一次性设置问题`);
                                console.log(`🎯 设置前文件数量: ${elementInfo.files}`);
                                console.log(`🎯 总共需要上传: ${finalFiles.length} 个文件`);
                                
                                let successfulUploads = 0;
                                
                                // 逐个上传每个文件
                                for (let fileIndex = 0; fileIndex < finalFiles.length; fileIndex++) {
                                    const filePath = finalFiles[fileIndex];
                                    const fileName = filePath.split(/[/\\\\\\\\]/).pop();
                                    console.log(`\\n📄 上传第${fileIndex + 1}/${finalFiles.length}个文件: ${fileName}`);
                                    console.log(`📍 文件路径: ${filePath}`);
                                    
                                    try {
                                        // 设置单个文件
                                        await element.setInputFiles([filePath]);
                                        console.log(`✅ 文件${fileIndex + 1}设置完成`);
                                        
                                        // 检查设置是否成功
                                        const afterSingleFile = await element.evaluate(el => el.files ? el.files.length : 0);
                                        console.log(`🎯 文件${fileIndex + 1}设置后元素文件数量: ${afterSingleFile}`);
                                        
                                        if (afterSingleFile > 0) {
                                            console.log(`✅ 文件${fileIndex + 1}成功设置到输入元素`);
                                            successfulUploads++;
                                            
                                            // 立即触发事件处理该文件
                                            await element.evaluate((input) => {
                                                const changeEvent = new Event('change', { bubbles: true, cancelable: true });
                                                const inputEvent = new Event('input', { bubbles: true, cancelable: true });
                                                input.dispatchEvent(inputEvent);
                                                input.dispatchEvent(changeEvent);
                                                console.log(`📡 文件${fileIndex + 1}事件已触发`);
                                            });
                                            
                                            // 等待处理完成
                                            console.log(`⏳ 等待文件${fileIndex + 1}处理完成...`);
                                            await page.waitForTimeout(2000);
                                            
                                            // 检查是否生成了上传项目
                                            const uploadItemsNow = await page.locator('.el-upload-list__item').count();
                                            console.log(`📊 文件${fileIndex + 1}处理后上传项目数量: ${uploadItemsNow}`);
                                            
                                        } else {
                                            console.log(`❌ 文件${fileIndex + 1}设置失败，输入元素文件数量仍为0`);
                                        }
                                        
                                    } catch (singleFileError) {
                                        console.log(`❌ 文件${fileIndex + 1}上传失败: ${singleFileError.message}`);
                                    }
                                }
                                
                                console.log(`\\n📊 逐个上传完成统计: 成功${successfulUploads}/${finalFiles.length}个文件`);
                                
                                console.log(`✅ 策略${i+1}逐个文件处理完成: ${strategy.name}`);
                                
                                // 最终验证所有文件上传成功 - 延长等待时间
                                console.log(`⏳ 等待所有文件最终处理完成...`);
                                await page.waitForTimeout(3000);
                                
                                // 检查多种上传成功指示器
                                const uploadItemsVariants = [
                                    '.copyright-img-upload .el-upload-list__item',
                                    '.el-upload-list--picture-card .el-upload-list__item', 
                                    '.el-upload-list__item',
                                    '[class*=\"upload-list\"] [class*=\"item\"]',
                                    '.el-upload-list .el-upload-list__item'
                                ];
                                
                                let totalUploadItems = 0;
                                for (const variant of uploadItemsVariants) {
                                    const count = await page.locator(variant).count();
                                    if (count > 0) {
                                        console.log(`📊 找到${count}个上传项目 (选择器: ${variant})`);
                                        totalUploadItems = Math.max(totalUploadItems, count);
                                    }
                                }
                                
                                console.log(`📊 最终上传项目数量: ${totalUploadItems}`);
                                console.log(`📊 成功处理的文件数量: ${successfulUploads}`);
                                console.log(`📊 期望上传的文件数量: ${finalFiles.length}`);
                                
                                // 判断成功条件：至少上传了一些文件
                                if (totalUploadItems > 0 || successfulUploads > 0) {
                                    uploadSuccess = true;
                                    console.log(`🎉 隐藏输入逐个文件上传成功！`);
                                    console.log(`   ✅ 策略${i+1}: ${strategy.name}`);
                                    console.log(`   ✅ 成功上传: ${Math.max(totalUploadItems, successfulUploads)} 个文件`);
                                    console.log(`   ✅ 预期上传: ${finalFiles.length} 个文件`);
                                    
                                    if (totalUploadItems < finalFiles.length && successfulUploads < finalFiles.length) {
                                        console.log(`⚠️ 注意: 部分文件上传成功，但未达到预期数量`);
                                        console.log(`💡 可能原因: Element UI组件限制或浏览器文件处理限制`);
                                    }
                                    
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
                                } else {
                                    console.log(`❌ 策略${i+1}逐个文件处理完成，但未检测到任何上传项目`);
                                    console.log(`🔍 可能的问题:`);
                                    console.log(`   - 文件路径不正确或文件不存在`);
                                    console.log(`   - Element UI组件未正确响应文件设置`);
                                    console.log(`   - 上传组件选择器不匹配实际页面结构`);
                                }
                            } else {
                                console.log(`❌ 策略${i+1}隐藏输入元素未找到`);
                            }
                        } catch (hiddenError) {
                            console.log(`❌ 策略${i+1}隐藏输入处理失败: ${hiddenError.message}`);
                        }
                        
                    } else if (strategy.type === 'visible_input') {
                        // 可见文件输入策略 - 需要检查可见性
                        console.log(`🎯 使用可见输入策略，需要检查可见性`);
                        const element = page.locator(strategy.selector).first();
                        const isVisible = await element.isVisible({ timeout: 3000 });
                        console.log(`   可见输入元素可见性: ${isVisible}`);
                        
                        if (isVisible) {
                            await element.setInputFiles(finalFiles);
                            
                            // 主动触发change事件
                            await element.evaluate((input) => {
                                const changeEvent = new Event('change', { bubbles: true });
                                const inputEvent = new Event('input', { bubbles: true });
                                input.dispatchEvent(changeEvent);
                                input.dispatchEvent(inputEvent);
                                console.log('✅ 已触发change和input事件');
                            });
                            
                            console.log(`✅ 策略${i+1}成功: ${strategy.name}`);
                            
                            // 验证上传成功
                            await page.waitForTimeout(3000);
                            const uploadItems = await page.locator('.el-upload-list__item, .upload-list-item, .el-upload-list .el-upload-list__item').count();
                            console.log(`📊 检测到上传项目数量: ${uploadItems}`);
                            
                            if (uploadItems > 0) {
                                uploadSuccess = true;
                                console.log(`🎉 可见输入文件上传验证成功，使用策略${i+1}: ${strategy.name}`);
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
                        
                    } else if (strategy.type === 'fallback') {
                        // 备用方法: 点击.el-upload然后设置文件 (可能打开文件选择界面)
                        console.log(`🎯 使用备用方法: 点击 + setInputFiles (可能显示选择器)`);
                        const uploadElement = page.locator(strategy.selector).first();
                        const isVisible = await uploadElement.isVisible({ timeout: 3000 });
                        console.log(`   上传元素可见性: ${isVisible}`);
                        
                        if (isVisible) {
                            // 步骤1: 点击.el-upload触发上传界面
                            await uploadElement.click();
                            console.log(`👆 已点击上传元素: ${strategy.selector}`);
                            console.log(`⏳ 等待文件选择界面加载完成...`);
                            await page.waitForTimeout(1000); // 增加等待时间
                            
                            // 步骤2: 尝试多种方式设置文件
                            console.log(`🔍 尝试多种文件设置方法...`);
                            
                            // 方法2a: 直接设置到原来的上传元素
                            try {
                                await uploadElement.setInputFiles(finalFiles);
                                console.log(`✅ 方法2a: 成功设置文件到原上传元素`);
                            } catch (error2a) {
                                console.log(`❌ 方法2a失败: ${error2a.message}`);
                                
                                // 方法2b: 寻找并设置到隐藏的文件输入元素
                                try {
                                    const fileInput = page.locator('input[type="file"]').first();
                                    const fileInputVisible = await fileInput.isVisible({ timeout: 2000 });
                                    console.log(`🔍 文件输入元素可见性: ${fileInputVisible}`);
                                    await fileInput.setInputFiles(finalFiles);
                                    console.log(`✅ 方法2b: 成功设置文件到文件输入元素`);
                                } catch (error2b) {
                                    console.log(`❌ 方法2b失败: ${error2b.message}`);
                                    
                                    // 方法2c: 寻找.el-upload__input元素
                                    try {
                                        const elUploadInput = page.locator('.el-upload__input').first();
                                        await elUploadInput.setInputFiles(finalFiles);
                                        console.log(`✅ 方法2c: 成功设置文件到.el-upload__input元素`);
                                    } catch (error2c) {
                                        console.log(`❌ 方法2c失败: ${error2c.message}`);
                                        console.log(`❌ 所有文件设置方法均失败`);
                                    }
                                }
                            }
                            
                            // 等待上传处理并验证
                            console.log(`⏳ 等待文件上传处理完成...`);
                            await page.waitForTimeout(4000); // 增加等待时间
                            const uploadItems = await page.locator('.el-upload-list__item').count();
                            console.log(`📊 检测到上传项目数量: ${uploadItems}`);
                            
                            if (uploadItems > 0) {
                                uploadSuccess = true;
                                console.log(`🎉 用户验证方法上传成功，使用策略${i+1}: ${strategy.name}`);
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
                            } else {
                                console.log(`⚠️ 策略${i+1}文件界面打开成功但未检测到上传项目`);
                                console.log(`🔍 继续尝试其他策略...`);
                            }
                        }
                    }
                    
                } catch (strategyError) {
                    console.log(`❌ 策略${i+1}失败: ${strategyError.message}`);
                }
            }
            
            if (!uploadSuccess) {
                console.log('⚠️ 所有5种智能文件上传策略均未成功（Element UI API→隐藏输入→可见输入→FileChooser→备用方法）');
                
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
        
        console.log('⏳ 等待用户完成验证码并进入下一页...');
        console.log('💡 请在页面中输入验证码并点击下一步');
        
        // 等待IP资产页面的关键元素出现，最多等待5分钟
        console.log('🔍 正在检测IP资产页面加载...');
        await page.waitForSelector('.el-form-item:has-text("权利人")', { 
            timeout: 300000 
        });
        
        console.log('✅ 检测到IP资产页面，开始自动填写...');
        await page.waitForTimeout(2000);
        
        // 执行完整的IP资产信息填写和文件上传
        
        console.log('\\n⏰ 阶段4开始时间:', new Date().toISOString());
        console.log('📋 开始填写完整IP资产信息...');
        
        // 填写权利人 - 使用智能选择器策略
        console.log('👤 开始填写权利人信息...');
        
        // 🔍 第一步：分析权利人字段DOM结构
        console.log('🔍 分析权利人字段DOM结构...');
        try {
            const rightsHolderSection = page.locator('.el-form-item:has-text("权利人")');
            const sectionExists = await rightsHolderSection.count();
            console.log(`📊 权利人表单项数量: ${sectionExists}`);
            
            if (sectionExists > 0) {
                const allInputs = await rightsHolderSection.locator('input').all();
                console.log(`🔍 权利人字段包含 ${allInputs.length} 个input元素:`);
                
                for (let i = 0; i < Math.min(allInputs.length, 5); i++) {
                    const inputType = await allInputs[i].getAttribute('type') || 'text';
                    const inputClass = await allInputs[i].getAttribute('class') || '';
                    const inputValue = await allInputs[i].getAttribute('value') || '';
                    const isVisible = await allInputs[i].isVisible();
                    console.log(`  Input[${i}]: type=${inputType}, class="${inputClass}", value="${inputValue}", visible=${isVisible}`);
                }
            }
        } catch (domError) {
            console.log('⚠️ DOM分析失败:', domError.message);
        }
        
        // 🎯 第二步：使用多重选择器策略填写权利人
        const rightsHolderStrategies = [
            { selector: '.el-form-item:has-text("权利人") input[type="text"]', name: '文本输入框(type=text)' },
            { selector: '.el-form-item:has-text("权利人") .el-input__inner', name: 'Element UI输入框(.el-input__inner)' },
            { selector: '.el-form-item:has-text("权利人") input:not([type="radio"]):not([type="checkbox"])', name: '非单选按钮输入框' },
            { selector: '.el-form-item:has-text("权利人") textarea', name: '文本域' },
            { selector: '.el-form-item:has-text("权利人") [contenteditable="true"]', name: '可编辑内容元素' }
        ];
        
        let rightsHolderFilled = false;
        
        for (let i = 0; i < rightsHolderStrategies.length && !rightsHolderFilled; i++) {
            const strategy = rightsHolderStrategies[i];
            console.log(`🎯 尝试策略${i+1}: ${strategy.name} (${strategy.selector})`);
            
            try {
                const element = page.locator(strategy.selector);
                const count = await element.count();
                console.log(`   元素数量: ${count}`);
                
                if (count > 0) {
                    const firstElement = element.first();
                    const isVisible = await firstElement.isVisible({ timeout: 2000 });
                    const isEnabled = await firstElement.isEnabled();
                    console.log(`   第一个元素: visible=${isVisible}, enabled=${isEnabled}`);
                    
                    if (isVisible && isEnabled) {
                        await firstElement.fill("酷酷酷");
                        console.log(`✅ 权利人填写成功! 使用策略: ${strategy.name}`);
                        rightsHolderFilled = true;
                        
                        // 验证填写是否成功
                        await page.waitForTimeout(500);
                        const filledValue = await firstElement.inputValue().catch(() => '');
                        console.log(`🔍 验证填写结果: "${filledValue}"`);
                    } else {
                        console.log(`   ⚠️ 元素不可见或不可用`);
                    }
                }
            } catch (strategyError) {
                console.log(`   ❌ 策略${i+1}失败: ${strategyError.message}`);
            }
        }
        
        if (!rightsHolderFilled) {
            console.error('❌ 所有权利人填写策略都失败了');
            console.log('🔍 建议手动检查页面结构或联系开发者');
        } else {
            console.log('✅ 权利人信息填写完成');
        }
        
        // 填写授权期限 - 起始时间和结束时间
        if (true && true) {
            console.log('📅 设置授权期限...');
            await page.locator('div').filter({ hasText: /^授权期限/ }).getByPlaceholder('起始时间').click();
            // 等待日期选择器打开，然后选择日期 (暂时使用简化处理)
            await page.waitForTimeout(500);
            await page.keyboard.type("2025-08-06");
            await page.keyboard.press('Tab');
            
            await page.locator('div').filter({ hasText: /^授权期限/ }).getByPlaceholder('结束时间').click();
            await page.waitForTimeout(500);
            await page.keyboard.type("2025-08-21");
            await page.keyboard.press('Tab');
        }
        
        // 著作类型选择
        console.log('🎨 选择著作类型...');
        await page.locator('div').filter({ hasText: /^著作类型/ }).getByPlaceholder('请选择').click();
        await page.waitForTimeout(500);
        await page.getByRole('listitem').filter({ hasText: "视频" }).click();
        
        // 填写著作名称 - 使用安全选择器策略
        console.log('📝 开始填写著作名称...');
        const workNameStrategies = [
            { selector: '.el-form-item:has-text("著作名称") input[type="text"]', name: '文本输入框' },
            { selector: '.el-form-item:has-text("著作名称") .el-input__inner', name: 'Element UI输入框' },
            { selector: 'div:has-text("著作名称") input:not([type="radio"]):not([type="checkbox"])', name: '非单选按钮输入框' },
            { selector: 'div:has-text("著作名称") [role="textbox"]', name: '角色为textbox的元素' }
        ];
        
        let workNameFilled = false;
        for (let i = 0; i < workNameStrategies.length && !workNameFilled; i++) {
            const strategy = workNameStrategies[i];
            try {
                const element = page.locator(strategy.selector);
                const count = await element.count();
                if (count > 0 && await element.first().isVisible({ timeout: 1000 })) {
                    await element.first().fill("大大");
                    console.log(`✅ 著作名称填写成功! 使用: ${strategy.name}`);
                    workNameFilled = true;
                }
            } catch (error) {
                console.log(`⚠️ 著作名称策略${i+1}失败: ${error.message}`);
            }
        }
        
        if (!workNameFilled) {
            console.error('❌ 著作名称填写失败，尝试备用方法...');
            try {
                await page.locator('div').filter({ hasText: /^著作名称/ }).getByRole('textbox').fill("大大");
                console.log('✅ 著作名称填写成功 (备用方法)');
            } catch (backupError) {
                console.error('❌ 著作名称备用方法也失败:', backupError.message);
            }
        }
        
        // 地区选择 (默认中国大陆) - 使用精确选择器
        console.log('🌏 开始设置地区...');
        const regionStrategies = [
            { selector: '.el-form-item:has-text("地区") .el-select', name: '地区表单项内的下拉选择框' },
            { selector: '.el-form-item:has-text("地区") .el-input', name: '地区表单项内的输入框' },
            { selector: 'div:has-text("地区") [role="textbox"]', name: '地区相关的textbox角色元素' },
            { selector: '.el-form-item:has-text("地区") .el-input__inner', name: '地区表单项内的输入核心元素' }
        ];
        
        let regionSelected = false;
        for (let i = 0; i < regionStrategies.length && !regionSelected; i++) {
            const strategy = regionStrategies[i];
            try {
                const element = page.locator(strategy.selector);
                const count = await element.count();
                console.log(`🔍 地区策略${i+1}: 找到${count}个元素 (${strategy.name})`);
                
                if (count > 0) {
                    const firstElement = element.first();
                    const isVisible = await firstElement.isVisible({ timeout: 1000 });
                    if (isVisible) {
                        console.log(`👆 点击地区选择器: ${strategy.name}`);
                        await firstElement.click();
                        await page.waitForTimeout(500);
                        
                        // 选择"中国大陆"选项
                        const option = page.getByRole('listitem').filter({ hasText: '中国大陆' });
                        const optionExists = await option.count();
                        console.log(`🔍 "中国大陆"选项数量: ${optionExists}`);
                        
                        if (optionExists > 0) {
                            await option.first().click();
                            console.log('✅ 地区选择成功: 中国大陆');
                            regionSelected = true;
                        }
                    }
                }
            } catch (error) {
                console.log(`⚠️ 地区选择策略${i+1}失败: ${error.message}`);
            }
        }
        
        // 备用方法：使用原始选择器
        if (!regionSelected) {
            console.log('🔄 使用备用地区选择方法...');
            try {
                await page.getByRole('textbox', { name: '请选择' }).nth(1).click();
                await page.waitForTimeout(500);
                await page.getByRole('listitem').filter({ hasText: '中国大陆' }).click();
                console.log('✅ 地区选择成功 (备用方法)');
            } catch (backupError) {
                console.error('❌ 地区选择备用方法失败:', backupError.message);
            }
        }
        
        // 填写期限 (作品有效期)
        if (false && false) {
            console.log('⏰ 设置作品期限...');
            await page.locator('div').filter({ hasText: /^期限/ }).getByPlaceholder('起始时间').click();
            await page.waitForTimeout(500);
            await page.keyboard.type("");
            await page.keyboard.press('Tab');
            
            await page.locator('div').filter({ hasText: /^期限/ }).getByPlaceholder('结束时间').click();
            await page.waitForTimeout(500);
            await page.keyboard.type("");
            await page.keyboard.press('Tab');
        }
        
        // 上传授权证明文件
        
        console.log('📋 开始上传授权证明文件...');
        try {
            const authFiles = ["C:\\Users\\kevin\\Pictures\\Screenshots\\屏幕截图 2025-07-20 120221.png", "C:\\Users\\kevin\\AppData\\Roaming\\com.rightsguard.app\\files\\ip_assets\\auth_docs\\test.png"];
            console.log('📁 授权证明文件数量:', authFiles.length);
            
            // 使用更精确的选择器，基于用户录制的操作
            const authUploadArea = page.locator('div:nth-child(3) > .el-form-item__content > .inline-form-item > .copyright-img-upload > div > .el-upload');
            const uploadExists = await authUploadArea.count();
            console.log('🔍 授权证明上传区域数量:', uploadExists);
            
            if (uploadExists > 0) {
                await authUploadArea.first().setInputFiles(authFiles);
                console.log('✅ 授权证明文件上传完成');
                await page.waitForTimeout(2000); // 等待处理完成
            } else {
                console.log('⚠️ 未找到授权证明上传区域，尝试备用方法');
                const backupSelector = page.locator('.el-form-item:has-text("授权证明") input[type="file"]');
                const backupExists = await backupSelector.count();
                if (backupExists > 0) {
                    await backupSelector.first().setInputFiles(authFiles);
                    console.log('✅ 授权证明文件上传完成 (备用方法)');
                    await page.waitForTimeout(2000);
                }
            }
        } catch (error) {
            console.error('❌ 授权证明文件上传失败:', error);
        }
        
        // 上传作品证明文件  
        
        console.log('🏆 开始上传作品证明文件...');
        try {
            const workProofFiles = ["C:\\Users\\kevin\\AppData\\Roaming\\com.rightsguard.app\\files\\ip_assets\\proof_docs\\test.png"];
            console.log('📁 作品证明文件数量:', workProofFiles.length);
            
            // 使用更精确的选择器，基于用户录制的操作
            const workProofUploadArea = page.locator('.el-form-item.default-item > .el-form-item__content > .inline-form-item > .copyright-img-upload > div > .el-upload');
            const uploadExists = await workProofUploadArea.count();
            console.log('🔍 作品证明上传区域数量:', uploadExists);
            
            if (uploadExists > 0) {
                await workProofUploadArea.first().setInputFiles(workProofFiles);
                console.log('✅ 作品证明文件上传完成');
                await page.waitForTimeout(2000); // 等待处理完成
            } else {
                console.log('⚠️ 未找到作品证明上传区域，尝试备用方法');
                const backupSelector = page.locator('.el-form-item:has-text("证明")').last().locator('input[type="file"]');
                const backupExists = await backupSelector.count();
                if (backupExists > 0) {
                    await backupSelector.setInputFiles(workProofFiles);
                    console.log('✅ 作品证明文件上传完成 (备用方法)');
                    await page.waitForTimeout(2000);
                }
            }
        } catch (error) {
            console.error('❌ 作品证明文件上传失败:', error);
        }
        
        console.log('✅ IP资产完整信息填写完成');
        console.log('👆 点击下一步按钮...');
        await page.getByRole('button', { name: '下一步' }).click();
        await page.waitForTimeout(2000);

        
        console.log('📝 填写申诉详情...');
        await page.locator('input[placeholder*="他人发布的B站侵权链接"]').first().fill("https://www.bilibili.com/video/BV1DfgzzrEd1");
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
