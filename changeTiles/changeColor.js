const sharp = require('sharp');

function clampByte(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }
  return [h, s, l];
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360; // normalize 0..360
  if (s === 0) {
    const v = clampByte(l * 255);
    return [v, v, v];
  }
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hh = h / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r1 = 0,
    g1 = 0,
    b1 = 0;
  if (hh >= 0 && hh < 1) [r1, g1, b1] = [c, x, 0];
  else if (hh < 2) [r1, g1, b1] = [x, c, 0];
  else if (hh < 3) [r1, g1, b1] = [0, c, x];
  else if (hh < 4) [r1, g1, b1] = [0, x, c];
  else if (hh < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = l - c / 2;
  return [clampByte((r1 + m) * 255), clampByte((g1 + m) * 255), clampByte((b1 + m) * 255)];
}

const contrast = 1.2;

const changeContrast = (color) => {
  color.forEach((a, i) => {
    let c = contrast * (a - 128) + 128;
    if (c < 0) {
      c = 0;
    } else if (c > 255) {
      c = 255;
    }
    color[i] = c;
  });
  return color;
};

const light = 1.2;
const addLight = (light - 1) * 255;
const changeLight = (color) => {
  color.forEach((a, i) => {
    let c = addLight + a;
    if (c < 0) {
      c = 0;
    } else if (c > 255) {
      c = 255;
    }
    color[i] = c;
  });
  return color;
};

const invertColor = (color) => {
  color.forEach((a, i) => {
    let c = 255 - a;
    if (c < 0) {
      c = 0;
    } else if (c > 255) {
      c = 255;
    }
    color[i] = c;
  });
  return color;
};

const saturate = 3;
const changeSaturate = (color) => {
  const [h, s, l] = rgbToHsl(color[0], color[1], color[2]);
  let c = s * saturate;
  if (c < 0) {
    c = 0;
  } else if (c > 1) {
    c = 1;
  }
  return hslToRgb(h, c, l);
};

const hue = 120;
const changeHue = (color) => {
  const [h, s, l] = rgbToHsl(color[0], color[1], color[2]);
  return hslToRgb((h + hue) % 360, s, l);
};

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

      // const newC = changeContrast([r, g, b]);
      // const newC = changeLight([r, g, b]);
      // const newC = invertColor([r, g, b]);
      // const newC = changeSaturate([r, g, b]);
      const newC = changeHue([r, g, b]);
      //替换成新颜色
      data[i] = newC[0]; // 替换 R
      data[i + 1] = newC[1]; // 替换 G
      data[i + 2] = newC[2]; // 替换 B
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

// replaceColor('./13367.png', './13367-contrast.png');
// replaceColor('./13367.png', './13367-light.png');
// replaceColor('./13367.png', './13367-invert.png');

// replaceColor('./13367.png', './13367-saturate.png');
replaceColor('./13367.png', './13367-hue.png');
