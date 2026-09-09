const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
//inputPath输入图片地址，outputPath输出图片地址
async function replaceColor(inputPath, outputPath) {
  try {
    // 获取图片数据
    const {data, info} = await sharp(inputPath)
      .ensureAlpha() //有透明度
      .raw()
      .toBuffer({resolveWithObject: true});

    const {width, height, channels} = info;

    // 2. 遍历每一个像素
    for (let i = 0; i < data.length; i += channels) {
      const r = data[i]; // 红色
      const g = data[i + 1]; // 绿色
      const b = data[i + 2]; // 蓝色
      const a = data[i + 3]; //透明度

      if (a === 0) continue; //透明不处理

      //去色，变成灰白色
      const v = Math.round((r + g + b) / 3);
      data[i] = v; // 替换 R
      data[i + 1] = v; // 替换 G
      data[i + 2] = v; // 替换 B
    }

    // 5. 修改后的颜色数据保存成新图片
    await sharp(data, {
      raw: {
        width,
        height,
        channels
      }
    })
      .toFormat('png')
      .toFile(outputPath);
  } catch (error) {
    console.error(outputPath, '颜色替换失败:', error.message);
  }
}
const fromPath = '矢量标注'; //标注来源文件夹
const toPath = '换色标注'; //标注目标新文件夹
const travelPath = (filePath) => {
  const dirs = fs.readdirSync(filePath);
  dirs.forEach((d) => {
    const targetPath = path.join(filePath, d);
    const stats = fs.statSync(targetPath);
    if (stats.isFile()) {
      const newPath = filePath.replace(fromPath, toPath);
      //级联生成目录
      fs.mkdirSync(newPath, {recursive: true});
      //替换颜色
      replaceColor(targetPath, path.join(newPath, d));
    } else if (stats.isDirectory()) {
      travelPath(targetPath);
    }
  });
};
travelPath('./' + fromPath);
console.log('ok');
