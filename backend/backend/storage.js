/**
 * backend/storage.js — 存储层入口
 *
 * V2 / V3 默认走 SQLite（storage-db.js）。
 * 想回到 V1 的纯文件存储：`STORE=file node server.js`（两套实现导出签名一致）。
 */

'use strict';

const useFile = String(process.env.STORE || '').toLowerCase() === 'file';

module.exports = useFile ? require('./storage-file') : require('./storage-db');
