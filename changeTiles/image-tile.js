const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const fromPath = '矢量底图'; //底图来源文件夹
const toPath = '换色底图'; //底图目标新文件夹

//需替换的颜色值
const targetColors = [
  //橙色
  {target: [254, 205, 120], newColor: [255, 255, 255]},
  //绿色
  {target: [206, 234, 214], newColor: [234, 239, 239]},
  //蓝色
  {target: [171, 198, 239], newColor: [204, 214, 215]},
  //底色
  {target: [245, 244, 238], newColor: [242, 242, 242]},
  //黄色
  {target: [254, 240, 158], newColor: [255, 255, 255]},
  //黄色
  {target: [254, 243, 175], newColor: [255, 255, 255]},
  //紫色
  {target: [186, 160, 241], newColor: [255, 255, 255]}
];
//颜色最小距离
const MIN = 5;
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
      // const a = data[i + 3]; //透明度

      let tag = false;
      let minD = 255,
        newC = [255, 255, 255];

      //找到与替换颜色最小距离那个颜色
      for (let i = 0; i < targetColors.length; i++) {
        const {target, newColor} = targetColors[i];
        //计算距离
        const distance = Math.sqrt(
          Math.pow(r - target[0], 2) + Math.pow(g - target[1], 2) + Math.pow(b - target[2], 2)
        );
        if (distance <= MIN) {
          minD = Math.min(minD, distance);
          if (minD === distance) {
            newC = newColor;
          }
          tag = true;
          //   break;
        }
      }
      if (!tag) {
        //莫找到替换颜色，默认取平均值，处理成灰色

        //颜色与灰色相近不处理
        if (Math.abs(r - g) < MIN && Math.abs(r - b) < MIN && Math.abs(b - g) < MIN) {
          continue;
        }

        const v = Math.round((r + g + b) / 3);
        data[i] = v; // 替换 R
        data[i + 1] = v; // 替换 G
        data[i + 2] = v; // 替换 B
      } else {
        //替换成新颜色
        data[i] = newC[0]; // 替换 R
        data[i + 1] = newC[1]; // 替换 G
        data[i + 2] = newC[2]; // 替换 B
      }
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
