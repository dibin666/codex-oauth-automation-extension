const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('manifest 保留 declarativeNetRequest 权限以支持现有 iCloud 规则', () => {
  const manifest = JSON.parse(fs.readFileSync('manifest.json', 'utf8'));

  assert.equal(
    Array.isArray(manifest.permissions) && manifest.permissions.includes('declarativeNetRequest'),
    true,
    'manifest 缺少 declarativeNetRequest 权限'
  );
  assert.equal(
    manifest.declarative_net_request?.rule_resources?.some((item) => item.id === 'icloud_headers'),
    true,
    'manifest 应继续保留 iCloud 静态规则资源'
  );
});

test('background 应在启动时清理旧的微软 token 动态删头规则', () => {
  const source = fs.readFileSync('background.js', 'utf8');

  assert.match(source, /setupDeclarativeNetRequestRules\(\)/, '应初始化动态规则清理逻辑');
  assert.match(source, /chrome\.declarativeNetRequest\.updateDynamicRules\(/, '应使用 declarativeNetRequest 动态规则');
  assert.match(source, /removeRuleIds:\s*\[\s*MICROSOFT_TOKEN_DNR_RULE_ID\s*\]/, '应移除旧的动态规则');
  assert.doesNotMatch(source, /header:\s*'Origin'\s*,\s*operation:\s*'remove'/, '不应再删除 Origin 请求头');
  assert.doesNotMatch(source, /login\.microsoftonline\.com\/\*\/oauth2\/v2\.0\/token/, '不应再注册微软 token 接口删头规则');
});
