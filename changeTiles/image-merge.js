const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
// 底图imagePath，上方叠加图imageoverPath，目标新地址distPath
async function mergeImages(imagePath, imageoverPath, distPath) {
  await sharp(imagePath)
    .composite([
      {
        input: imageoverPath,
        top: 0, // 距离顶部的像素
        left: 0, // 距离左侧的像素
        blend: 'over' // 混合模式 over覆盖，multiply叠底
      }
    ])
    .toFile(distPath);
}

const basePath = '换色底图'; //底图来源文件夹
const overPath = '换色标注'; //底图目标新文件夹
const toPath = '叠加瓦片';
const travelPath = (filePath) => {
  const dirs = fs.readdirSync(filePath);
  dirs.forEach((d) => {
    const targetPath = path.join(filePath, d);
    const stats = fs.statSync(targetPath);
    if (stats.isFile()) {
      const textPath = targetPath.replace(basePath, overPath);
      const newPath = filePath.replace(basePath, toPath);
      //级联生成目录
      fs.mkdirSync(newPath, {recursive: true});
      //合并图片
      mergeImages(targetPath, textPath, path.join(newPath, d));
    } else if (stats.isDirectory()) {
      travelPath(targetPath);
    }
  });
};
console.log('ok');
travelPath('./' + basePath);
