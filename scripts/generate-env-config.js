const fs = require('fs');
const path = require('path');

// Load env vars from .env file manually (no dotenv dependency)
function loadEnvFile(filePath) {
  const env = {};
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    content.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const idx = line.indexOf('=');
        if (idx > 0) {
          const key = line.substring(0, idx).trim();
          const value = line.substring(idx + 1).trim();
          env[key] = value;
        }
      }
    });
  }
  return env;
}

const env = loadEnvFile(path.resolve(__dirname, '../.env'));

const config = {
  NEXT_PUBLIC_SUPABASE_URL: env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
};

const outputDir = path.resolve(__dirname, '../public');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const outputPath = path.resolve(outputDir, 'env-config.js');
const content = `// Auto-generated at build time - do not edit manually
window.__ENV__ = ${JSON.stringify(config, null, 2)};
`;

fs.writeFileSync(outputPath, content);
console.log('Generated env-config.js at', outputPath);