// Chrome命令测试脚本
// 用于验证生成的Chrome启动命令是否正确

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// 模拟我们的Chrome用户数据目录生成逻辑
function getChromeUserDataDir() {
    const homeDir = os.homedir();
    
    if (process.platform === 'win32') {
        return path.join(homeDir, 'AppData', 'Local', 'RightsGuard', 'ChromeProfile');
    } else if (process.platform === 'darwin') {
        return path.join(homeDir, 'Library', 'Application Support', 'RightsGuard', 'ChromeProfile');
    } else {
        return path.join(homeDir, '.config', 'rights-guard', 'chrome-profile');
    }
}

// 生成Chrome启动命令
function generateChromeCommand() {
    const userDataDir = getChromeUserDataDir();
    
    if (process.platform === 'win32') {
        return `chrome.exe --remote-debugging-port=9222 --user-data-dir="${userDataDir}"`;
    } else if (process.platform === 'darwin') {
        return `/Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222 --user-data-dir="${userDataDir}"`;
    } else {
        return `google-chrome --remote-debugging-port=9222 --user-data-dir="${userDataDir}"`;
    }
}

// 测试目录创建
function testDirectoryCreation() {
    const userDataDir = getChromeUserDataDir();
    console.log('🔍 测试Chrome用户数据目录创建...');
    console.log('  目标目录:', userDataDir);
    
    try {
        // 创建目录
        fs.mkdirSync(userDataDir, { recursive: true });
        console.log('  ✅ 目录创建成功');
        
        // 检查目录是否存在
        if (fs.existsSync(userDataDir)) {
            console.log('  ✅ 目录存在验证通过');
            
            // 检查权限
            try {
                const testFile = path.join(userDataDir, 'test_write.tmp');
                fs.writeFileSync(testFile, 'test');
                fs.unlinkSync(testFile);
                console.log('  ✅ 目录写入权限正常');
            } catch (error) {
                console.log('  ❌ 目录写入权限异常:', error.message);
            }
        } else {
            console.log('  ❌ 目录不存在');
        }
    } catch (error) {
        console.log('  ❌ 目录创建失败:', error.message);
    }
}

// 测试Chrome命令格式
function testChromeCommand() {
    console.log('\n🔍 测试Chrome启动命令生成...');
    
    const command = generateChromeCommand();
    console.log('  生成的命令:', command);
    
    // 验证命令格式
    const checks = {
        hasRemoteDebugging: command.includes('--remote-debugging-port=9222'),
        hasUserDataDir: command.includes('--user-data-dir='),
        hasCustomDir: command.includes('RightsGuard') || command.includes('rights-guard'),
        noDefaultDir: !command.includes('Google\\Chrome\\User Data') && 
                      !command.includes('Google/Chrome') && 
                      !command.includes('google-chrome')
    };
    
    console.log('  ✅ 包含调试端口参数:', checks.hasRemoteDebugging);
    console.log('  ✅ 包含用户数据目录参数:', checks.hasUserDataDir);
    console.log('  ✅ 使用自定义目录:', checks.hasCustomDir);
    console.log('  ✅ 避免默认目录:', checks.noDefaultDir);
    
    if (Object.values(checks).every(Boolean)) {
        console.log('  🎉 Chrome命令格式验证通过！');
    } else {
        console.log('  ⚠️  Chrome命令格式可能有问题');
    }
    
    return command;
}

// 测试端口连接
async function testPortConnection() {
    console.log('\n🔍 测试端口9222连接...');
    
    const net = require('net');
    const client = new net.Socket();
    
    return new Promise((resolve) => {
        client.setTimeout(3000);
        
        client.connect(9222, '127.0.0.1', () => {
            console.log('  ✅ 端口9222已开放，Chrome调试服务运行中');
            client.destroy();
            resolve(true);
        });
        
        client.on('error', () => {
            console.log('  ❌ 端口9222未开放，Chrome调试服务未运行');
            resolve(false);
        });
        
        client.on('timeout', () => {
            console.log('  ❌ 连接端口9222超时');
            client.destroy();
            resolve(false);
        });
    });
}

// 主测试函数
async function main() {
    console.log('🚀 Chrome连接功能测试开始...\n');
    
    // 测试1: 目录创建
    testDirectoryCreation();
    
    // 测试2: 命令生成
    const command = testChromeCommand();
    
    // 测试3: 端口连接
    const isConnected = await testPortConnection();
    
    console.log('\n📊 测试总结:');
    console.log('  - 目录创建: 请查看上方日志');
    console.log('  - 命令生成: 已完成');
    console.log('  - Chrome连接:', isConnected ? '✅ 已连接' : '❌ 未连接');
    
    if (!isConnected) {
        console.log('\n💡 建议操作:');
        console.log('  1. 复制以下命令到命令行运行:');
        console.log(`     ${command}`);
        console.log('  2. 等待Chrome启动完成');
        console.log('  3. 重新运行此测试脚本验证连接');
    }
    
    console.log('\n✨ 测试完成！');
}

// 运行测试
main().catch(console.error);