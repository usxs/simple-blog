// 图片上传优化：自动转换为 WebP（更轻量的现代格式）并适当压缩，成功后只保留 .webp（原图不落盘）。
// 转换依赖 sharp（Dockerfile 构建时安装，自带预编译 libvips，无需系统编译工具）。
// 任何失败（依赖缺失、格式不支持、转换出错、转换后反而更大）都自动回退为「按原格式保存」，
// 上传功能永远可用，绝不会因为转换问题导致上传失败。
const path = require('path');

// "适当压缩"参数：质量 82 是体积/清晰度的甜点位；超大图等比缩到 2560px 内（网页显示足够，
// 手机原图常见 4000px，缩到 2560 可显著减小体积；只缩小、绝不放大）
const WEBP_QUALITY = 82;
const MAX_DIMENSION = 2560;

// 需要转 WebP 的格式：JPEG / PNG（网页两大主流）+ GIF（动画一并转成动画 WebP）。
// SVG（矢量）、AVIF（已很现代）等保持原样；.webp 输入不再重编码，避免二次有损。
const CONVERTIBLE = new Set(['.jpg', '.jpeg', '.png', '.gif']);

// 运维开关：IMAGE_WEBP_DISABLE=1 时跳过转换（排查问题时可用）
const DISABLED = process.env.IMAGE_WEBP_DISABLE === '1';

let sharp = null;
try {
  sharp = require('sharp');
} catch (e) {
  console.warn('[image] 未检测到 sharp 依赖，图片将按原格式保存（不做 WebP 转换）。');
  console.warn('[image] 启用转换请重新构建镜像：docker compose up -d --build');
}

/**
 * 把图片 Buffer 转换为 WebP。
 * @param {Buffer} inputBuffer 原始图片字节
 * @param {string} originalExt 原扩展名（含点，如 '.png'）
 * @returns {Promise<{buffer: Buffer, ext: '.webp', width: number, height: number} | null>}
 *          成功返回转换结果（ext 固定 '.webp'）；不转换/失败返回 null（调用方按原格式保存）
 */
async function optimizeToWebp(inputBuffer, originalExt) {
  if (DISABLED || !sharp) return null;
  const ext = String(originalExt || '').toLowerCase();
  if (!CONVERTIBLE.has(ext)) return null;
  try {
    // GIF 可能是多帧动画：animated:true 让 libvips 读取全部帧，输出动画 WebP
    const animated = ext === '.gif';
    let pipeline = sharp(inputBuffer, { animated, failOn: 'none' });
    const meta = await pipeline.metadata();
    if (meta.width > MAX_DIMENSION || meta.height > MAX_DIMENSION) {
      pipeline = pipeline.resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: 'inside',              // 等比缩放，保持比例
        withoutEnlargement: true    // 只缩小不放大
      });
    }
    const { data } = await pipeline
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    if (!data || !data.length) return null;
    // 转换后反而更大（原图已是高度优化的小图）→ 保留原图更合理
    if (data.length >= inputBuffer.length) return null;
    return { buffer: data, ext: '.webp' };
  } catch (e) {
    console.warn(`[image] WebP 转换失败（保留原图）: ${e.message}`);
    return null;
  }
}

/**
 * 目录内取唯一文件名：不冲突则原样返回；冲突时在扩展名前追加 -1、-2 ……（同日多图场景）。
 * @param {string} dir 目标目录
 * @param {string} fileName 期望文件名（如 '1737...-照片.webp'）
 * @returns {string} 实际可用的文件名
 */
function uniqueFileName(dir, fileName) {
  const fs = require('fs');
  if (!fs.existsSync(path.join(dir, fileName))) return fileName;
  const ext = path.extname(fileName);
  const base = path.basename(fileName, ext);
  for (let i = 1; i < 1000; i++) {
    const candidate = `${base}-${i}${ext}`;
    if (!fs.existsSync(path.join(dir, candidate))) return candidate;
  }
  return `${base}-${Date.now()}${ext}`;
}

/**
 * 把文件名的扩展名替换为 .webp（主体与时间戳前缀保持不变）。
 * sanitizeFileName 生成的名字形如 '<毫秒时间戳>-<原名>.<ext>'
 */
function replaceExtWithWebp(fileName) {
  const ext = path.extname(fileName);
  if (!ext) return fileName + '.webp';
  return fileName.slice(0, -ext.length) + '.webp';
}

module.exports = { optimizeToWebp, uniqueFileName, replaceExtWithWebp };
