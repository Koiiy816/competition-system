// 独立审核端口，保留机器上已有的开发服务。
const path = require('node:path');
process.chdir(path.resolve(__dirname, '..'));
process.env.PORT = process.argv[2] || process.env.REVIEW_API_PORT || '5001';
require('../server');
