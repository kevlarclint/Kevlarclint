// Neofetch Profile API - Vercel Serverless Function
// Generates SVG stats card for GitHub users

import { Jimp } from 'jimp';
import sharp from 'sharp';

const THEMES = {
  'github-dark': {
    bg: '#161b22',
    key: '#ffa657',
    val: '#a5d6ff',
    sep: '#616e7f',
    add: '#3fb950',
    del: '#f85149',
    ascii: '#c9d1d9',
    text: '#c9d1d9'
  },
  'github-light': {
    bg: '#f6f8fa',
    key: '#953800',
    val: '#0a3069',
    sep: '#c2cfde',
    add: '#1a7f37',
    del: '#cf222e',
    ascii: '#24292f',
    text: '#24292f'
  }
};

const ASCII_CHARS = ' .`"^-+*o()[]{}?#%@M';

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function parseOffset(value, dimension) {
  if (value === undefined || value === null) return 0;
  if (typeof value === 'number') return Math.round(value);
  if (typeof value !== 'string') return 0;
  value = value.trim();
  if (value.endsWith('%')) {
    const percent = parseFloat(value) / 100;
    return Math.round(dimension * percent);
  }
  if (value.endsWith('px')) {
    const px = parseInt(value, 10) || 0;
    return Math.round(px / 10);
  }
  return Math.round(parseInt(value, 10) || 0);
}

async function avatarToAscii(avatarUrl, maxHeight = 25, maxWidth = 38, respectTransparency = false, colored = false, imageScale = 1, removeBackground = false, offsetX = 0, offsetY = 0) {
  const gridWidth = maxWidth;
  const gridHeight = maxHeight;

  if (imageScale <= 0) {
    if (colored) {
      const emptyLine = Array(gridWidth).fill({ char: ' ', color: null });
      return { colored: true, lines: Array(gridHeight).fill(null).map(() => [...emptyLine]) };
    }
    return Array(gridHeight).fill(' '.repeat(gridWidth));
  }

  try {
    let image;
    const isSvg = avatarUrl.toLowerCase().endsWith('.svg');

    if (isSvg) {
      const response = await fetch(avatarUrl);
      const svgBuffer = Buffer.from(await response.arrayBuffer());
      const pngBuffer = await sharp(svgBuffer, { density: 300 }).png().toBuffer();
      image = await Jimp.read(pngBuffer);
    } else {
      image = await Jimp.read(avatarUrl);
    }

    if (removeBackground) {
      const w = image.width;
      const h = image.height;
      const tolerance = 30;

      const corners = [
        image.getPixelColor(0, 0),
        image.getPixelColor(w - 1, 0),
        image.getPixelColor(0, h - 1),
        image.getPixelColor(w - 1, h - 1)
      ];

      const cornerColors = corners.map(c => ({
        r: (c >> 24) & 0xFF,
        g: (c >> 16) & 0xFF,
        b: (c >> 8) & 0xFF
      }));

      const bgColor = {
        r: Math.round(cornerColors.reduce((sum, c) => sum + c.r, 0) / 4),
        g: Math.round(cornerColors.reduce((sum, c) => sum + c.g, 0) / 4),
        b: Math.round(cornerColors.reduce((sum, c) => sum + c.b, 0) / 4)
      };

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const pixel = image.getPixelColor(x, y);
          const r = (pixel >> 24) & 0xFF;
          const g = (pixel >> 16) & 0xFF;
          const b = (pixel >> 8) & 0xFF;
          const diff = Math.sqrt(
            Math.pow(r - bgColor.r, 2) +
            Math.pow(g - bgColor.g, 2) +
            Math.pow(b - bgColor.b, 2)
          );
          if (diff <= tolerance) {
            image.setPixelColor(0x00000000, x, y);
          }
        }
      }
    }

    if (respectTransparency && !removeBackground) {
      let minX = image.width, minY = image.height, maxX = 0, maxY = 0;
      let hasOpaquePixels = false;

      for (let y = 0; y < image.height; y++) {
        for (let x = 0; x < image.width; x++) {
          const color = image.getPixelColor(x, y);
          const a = color & 0xFF;
          if (a >= 128) {
            hasOpaquePixels = true;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }

      if (hasOpaquePixels && (minX > 0 || minY > 0 || maxX < image.width - 1 || maxY < image.height - 1)) {
        const cropW = maxX - minX + 1;
        const cropH = maxY - minY + 1;
        image.crop({ x: minX, y: minY, w: cropW, h: cropH });
      }
    }

    const charAspect = 0.5;
    const gridVisualWidth = gridWidth * charAspect;
    const gridVisualHeight = gridHeight;

    const imgAspect = image.width / image.height;

    let visualWidth, visualHeight;
    if (imgAspect > gridVisualWidth / gridVisualHeight) {
      visualWidth = gridVisualWidth;
      visualHeight = gridVisualWidth / imgAspect;
    } else {
      visualHeight = gridVisualHeight;
      visualWidth = gridVisualHeight * imgAspect;
    }

    let baseCharWidth = visualWidth / charAspect;
    let baseCharHeight = visualHeight;

    const scaledCharWidth = Math.round(baseCharWidth * imageScale);
    const scaledCharHeight = Math.round(baseCharHeight * imageScale);

    image.resize({ w: scaledCharWidth, h: scaledCharHeight });

    const parsedOffsetX = parseOffset(offsetX, gridWidth);
    const parsedOffsetY = parseOffset(offsetY, gridHeight);

    const imgStartX = Math.round((gridWidth - scaledCharWidth) / 2) + parsedOffsetX;
    const imgStartY = Math.round((gridHeight - scaledCharHeight) / 2) + parsedOffsetY;

    const contrast = 1.2;
    const ASCII_CHARS = ' `.\':_,^=;><+!rc*/z?sLTv)J7(|Fi{C}fI31tlu[neoZ5Yxjya]2ESwqkP6h9d4VpOGbUAKXHm8RD#$Bg0MNWQ%&@';

    let totalLuma = 0;
    let pixelCount = 0;
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        const color = image.getPixelColor(x, y);
        const a = color & 0xFF;
        if (a >= 128) {
          const r = (color >> 24) & 0xFF;
          const g = (color >> 16) & 0xFF;
          const b = (color >> 8) & 0xFF;
          totalLuma += 0.299 * r + 0.587 * g + 0.114 * b;
          pixelCount++;
        }
      }
    }
    const avgLuma = pixelCount > 0 ? totalLuma / pixelCount : 128;
    const shouldInvert = avgLuma < 128;

    let lines = [];

    for (let gridY = 0; gridY < gridHeight; gridY++) {
      let lineData = colored ? [] : '';

      for (let gridX = 0; gridX < gridWidth; gridX++) {
        const imgX = gridX - imgStartX;
        const imgY = gridY - imgStartY;

        if (imgX < 0 || imgX >= image.width || imgY < 0 || imgY >= image.height) {
          if (colored) {
            lineData.push({ char: ' ', color: null });
          } else {
            lineData += ' ';
          }
          continue;
        }

        const color = image.getPixelColor(imgX, imgY);
        const r = (color >> 24) & 0xFF;
        const g = (color >> 16) & 0xFF;
        const b = (color >> 8) & 0xFF;
        const a = color & 0xFF;

        if (a < 128) {
          if (colored) {
            lineData.push({ char: ' ', color: null });
          } else {
            lineData += ' ';
          }
          continue;
        }

        let luma = 0.299 * r + 0.587 * g + 0.114 * b;
        let adjustedLuma = (luma - 128) * contrast + 128;
        adjustedLuma = Math.max(0, Math.min(255, adjustedLuma));
        if (shouldInvert) {
          adjustedLuma = 255 - adjustedLuma;
        }

        const charIndex = Math.floor(adjustedLuma / 255 * (ASCII_CHARS.length - 1));
        const char = ASCII_CHARS[charIndex];

        if (colored) {
          lineData.push({ char, color: rgbToHex(r, g, b) });
        } else {
          lineData += char;
        }
      }

      lines.push(lineData);
    }

    return colored ? { colored: true, lines } : lines;
  } catch (error) {
    console.error('Failed to convert avatar:', error);
    return null;
  }
}

const DEFAULT_ASCII = Array(25).fill(' '.repeat(38));

const ROW_CHAR_LENGTH = 60;
const PIPE_POSITION = 36;

function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatNumber(num) {
  return num.toLocaleString('en-US');
}

function calculateUptime(birthday) {
  const bday = new Date(birthday);
  if (isNaN(bday.getTime())) return '';

  const today = new Date();
  let years = today.getFullYear() - bday.getFullYear();
  let months = today.getMonth() - bday.getMonth();
  let days = today.getDate() - bday.getDate();

  if (days < 0) {
    months--;
    const prevMonth = new Date(today.getFullYear(), today.getMonth(), 0);
    days += prevMonth.getDate();
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  const formatPlural = (num, word) => `${num} ${word}${num !== 1 ? 's' : ''}`;
  return `${formatPlural(years, 'year')}, ${formatPlural(months, 'month')}, ${formatPlural(days, 'day')}`;
}

function fitDetailRow(key, value) {
  const prefix = '. ';
  const colon = ':';
  let displayValue = String(value || '');

  let availableForDots = ROW_CHAR_LENGTH - prefix.length - key.length - colon.length - displayValue.length;

  while (displayValue.length > 3 && availableForDots < 3) {
    const contentLen = displayValue.length - 3;
    const startLen = Math.max(1, Math.ceil(contentLen / 2) - 1);
    const endLen = Math.max(1, Math.floor(contentLen / 2) - 1);
    displayValue = displayValue.slice(0, startLen) + '...' + displayValue.slice(-endLen);
    availableForDots = ROW_CHAR_LENGTH - prefix.length - key.length - colon.length - displayValue.length;
  }

  const dotCount = Math.max(1, availableForDots - 2);

  return {
    key: key,
    dots: ' ' + '.'.repeat(dotCount) + ' ',
    value: displayValue
  };
}

function fitSectionSeparator(title) {
  const referenceLen = ROW_CHAR_LENGTH;
  const start = ' -';
  const end = '-—-';

  let dashCount = referenceLen - title.length - start.length - end.length;
  dashCount = Math.max(0, dashCount);

  return start + '—'.repeat(dashCount) + end;
}

function fitSplitRow(leftKey, leftVal, rightKey, rightVal) {
  const leftKeyStr = String(leftKey);
  const leftValStr = String(leftVal);
  const rightKeyStr = String(rightKey);
  const rightValStr = String(rightVal);

  const leftFixed = 4 + leftKeyStr.length + leftValStr.length;
  const dots1Len = Math.max(3, PIPE_POSITION - leftFixed);

  const rightFixed = 3 + rightKeyStr.length + rightValStr.length;
  const dots2Len = Math.max(3, (ROW_CHAR_LENGTH - PIPE_POSITION) - rightFixed);

  const dots1 = ' ' + '.'.repeat(Math.max(1, dots1Len - 2)) + ' ';
  const dots2 = ' ' + '.'.repeat(Math.max(1, dots2Len - 2)) + ' ';

  return { dots1, dots2, leftKey: leftKeyStr, leftVal: leftValStr, rightKey: rightKeyStr, rightVal: rightValStr };
}

function fitLocRow(loc, locAdd, locDel) {
  const fixedLen = 16 + 3 + 2 + 1 + 2 + 2;
  const locStr = String(loc);
  const addStr = String(locAdd);
  const delStr = String(locDel);

  const availableForVariable = ROW_CHAR_LENGTH - fixedLen;
  const spaceForDots = availableForVariable - locStr.length - addStr.length - delStr.length;

  const dots2Len = Math.max(1, Math.min(2, spaceForDots - 3));
  const dots1Len = Math.max(3, spaceForDots - dots2Len);

  const dots1 = ' ' + '.'.repeat(Math.max(1, dots1Len - 2)) + ' ';
  const dots2 = ' '.repeat(dots2Len);

  return { dots1, dots2 };
}

async function fetchGitHubData(username, token) {
  const headers = { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'neofetch-profile' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const userRes = await fetch(`https://api.github.com/users/${username}`, { headers });
  if (!userRes.ok) {
    if (userRes.status === 404) throw new Error('User not found');
    if (userRes.status === 403) throw new Error('GitHub API rate limit exceeded. Try again later or add GITHUB_TOKEN.');
    const errorData = await userRes.json().catch(() => ({}));
    throw new Error(`GitHub API error: ${userRes.status} - ${errorData.message || 'Unknown error'}`);
  }
  const userData = await userRes.json();

  let totalRepos = userData.public_repos;
  if (token) {
    const authUserRes = await fetch('https://api.github.com/user', { headers });
    if (authUserRes.ok) {
      const authUserData = await authUserRes.json();
      if (authUserData.login.toLowerCase() === username.toLowerCase()) {
        totalRepos = authUserData.public_repos + (authUserData.total_private_repos || 0);
      }
    }
  }

  let starsCount = 0;
  let totalForks = 0;
  let page = 1;
  let hasMore = true;
  const languageCounts = {};

  const reposEndpoint = token
    ? `https://api.github.com/user/repos?per_page=100&affiliation=owner&page=`
    : `https://api.github.com/users/${username}/repos?per_page=100&page=`;

  while (hasMore && page <= 10) {
    const reposRes = await fetch(`${reposEndpoint}${page}`, { headers });
    if (reposRes.ok) {
      const reposData = await reposRes.json();
      if (reposData.length === 0) {
        hasMore = false;
      } else {
        reposData.forEach(repo => {
          starsCount += repo.stargazers_count;
          totalForks += repo.forks_count;
          if (repo.language) {
            languageCounts[repo.language] = (languageCounts[repo.language] || 0) + 1;
          }
        });
        page++;
      }
    } else {
      hasMore = false;
    }
  }

  const topLanguages = Object.entries(languageCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([lang]) => lang)
    .join(', ') || 'Various';

  let issuesCount = 0;
  let prsCount = 0;

  try {
    const [issuesRes, prsRes] = await Promise.all([
      fetch(`https://api.github.com/search/issues?q=author:${username}+type:issue`, { headers }),
      fetch(`https://api.github.com/search/issues?q=author:${username}+type:pr`, { headers })
    ]);

    if (issuesRes.ok) {
      const issuesData = await issuesRes.json();
      issuesCount = issuesData.total_count || 0;
    }

    if (prsRes.ok) {
      const prsData = await prsRes.json();
      prsCount = prsData.total_count || 0;
    }
  } catch (error) {
    console.error('Failed to fetch issues/PRs:', error);
  }

  const contribCount = Math.round(userData.public_repos * 0.3) + Math.round(totalForks * 0.1);
  const avgCommitsPerRepo = 50;
  const estimatedCommits = totalRepos * avgCommitsPerRepo;
  const avgLocPerRepo = 2000;
  const estimatedLoc = totalRepos * avgLocPerRepo + starsCount * 100;
  const additions = Math.round(estimatedLoc * 1.2);
  const deletions = Math.round(estimatedLoc * 0.2);

  return {
    username: userData.login,
    name: userData.name || userData.login,
    company: userData.company ? userData.company.replace(/^@/, '') : '',
    bio: userData.bio ? userData.bio.substring(0, 40) : '',
    email: userData.email || '',
    location: userData.location || '',
    blog: userData.blog || '',
    twitter: userData.twitter_username || '',
    avatarUrl: userData.avatar_url || '',
    createdAt: userData.created_at?.substring(0, 10) || '',
    repos: totalRepos,
    followers: userData.followers,
    following: userData.following,
    stars: starsCount,
    forks: totalForks,
    gists: userData.public_gists || 0,
    issues: issuesCount,
    prs: prsCount,
    contrib: contribCount,
    commits: formatNumber(estimatedCommits),
    loc: formatNumber(estimatedLoc),
    locAdd: formatNumber(additions),
    locDel: formatNumber(deletions),
    topLanguages: topLanguages
  };
}

function generateSvgWithConfig(data, config, asciiArt, isCustomAscii = false, theme = 'github-dark') {
  const colors = THEMES[theme] || THEMES['github-dark'];

  const asciiX = 15;
  const textAnchor = '';

  const isLightTheme = theme === 'github-light';
  const imageColorOverride = config.imageColor
    ? (isLightTheme ? config.imageColor.light : config.imageColor.dark)
    : null;

  const backgroundColorOverride = config.backgroundColor
    ? (isLightTheme ? config.backgroundColor.light : config.backgroundColor.dark)
    : null;

  const separatorColorOverride = config.separatorColor
    ? (isLightTheme ? config.separatorColor.light : config.separatorColor.dark)
    : null;

  let asciiLines;
  const isColored = asciiArt && asciiArt.colored;

  if (imageColorOverride) {
    if (isColored) {
      asciiLines = asciiArt.lines.map((lineData, i) => {
        const y = 30 + i * 20;
        const lineText = lineData.map(({ char }) => escapeXml(char)).join('');
        return `<tspan x="${asciiX}" y="${y}">${lineText}</tspan>`;
      }).join('\n');
    } else {
      asciiLines = asciiArt.map((line, i) => {
        const y = 30 + i * 20;
        return `<tspan x="${asciiX}" y="${y}">${escapeXml(line)}</tspan>`;
      }).join('\n');
    }
  } else if (isColored) {
    asciiLines = asciiArt.lines.map((lineData, i) => {
      const y = 30 + i * 20;
      let lineContent = '';
      let currentColor = null;
      let buffer = '';

      for (const { char, color } of lineData) {
        if (color === currentColor) {
          buffer += escapeXml(char);
        } else {
          if (buffer) {
            if (currentColor) {
              lineContent += `<tspan fill="${currentColor}">${buffer}</tspan>`;
            } else {
              lineContent += buffer;
            }
          }
          buffer = escapeXml(char);
          currentColor = color;
        }
      }
      if (buffer) {
        if (currentColor) {
          lineContent += `<tspan fill="${currentColor}">${buffer}</tspan>`;
        } else {
          lineContent += buffer;
        }
      }

      return `<tspan x="${asciiX}" y="${y}">${lineContent}</tspan>`;
    }).join('\n');
  } else {
    asciiLines = asciiArt.map((line, i) => {
      const y = 30 + i * 20;
      return `<tspan x="${asciiX}" y="${y}">${escapeXml(line)}</tspan>`;
    }).join('\n');
  }

  let y = 30;
  const lineHeight = 20;
  let detailLines = [];

  for (const section of config.sections) {
    if (section.title) {
      const sectionSeparator = fitSectionSeparator(section.title);

      const titleTextColor = section.titleColor?.text
        ? (isLightTheme ? section.titleColor.text.light : section.titleColor.text.dark)
        : null;
      const titleLineColor = section.titleColor?.line
        ? (isLightTheme ? section.titleColor.line.light : section.titleColor.line.dark)
        : null;

      const titleSpan = titleTextColor
        ? `<tspan x="390" y="${y}" fill="${titleTextColor}">${escapeXml(section.title)}</tspan>`
        : `<tspan x="390" y="${y}">${escapeXml(section.title)}</tspan>`;
      const lineSpan = titleLineColor
        ? `<tspan fill="${titleLineColor}">${escapeXml(sectionSeparator)}</tspan>`
        : `<tspan>${escapeXml(sectionSeparator)}</tspan>`;

      detailLines.push(`${titleSpan}${lineSpan}`);
      y += lineHeight;
    }

    for (const field of section.fields) {
      const row = fitDetailRow(field.key, field.value);

      const keyColor = field.keyColor
        ? (isLightTheme ? field.keyColor.light : field.keyColor.dark)
        : null;
      const valueColor = field.valueColor
        ? (isLightTheme ? field.valueColor.light : field.valueColor.dark)
        : null;

      const keySpan = keyColor
        ? `<tspan fill="${keyColor}">${escapeXml(row.key)}</tspan>`
        : `<tspan class="key">${escapeXml(row.key)}</tspan>`;
      const valueSpan = valueColor
        ? `<tspan fill="${valueColor}">${escapeXml(row.value)}</tspan>`
        : `<tspan class="value">${escapeXml(row.value)}</tspan>`;

      detailLines.push(`<tspan x="390" y="${y}" class="cc">. </tspan>${keySpan}:<tspan class="cc">${escapeXml(row.dots)}</tspan>${valueSpan}`);
      y += lineHeight;
    }

    detailLines.push(`<tspan x="390" y="${y}" class="cc">. </tspan>`);
    y += lineHeight;
  }

  if (config.stats && config.stats.enabled !== false) {
    const statsTitle = config.stats.title || '- GitHub Stats';
    const statsSeparator = fitSectionSeparator(statsTitle);

    const statsTitleTextColor = config.stats.titleColor?.text
      ? (isLightTheme ? config.stats.titleColor.text.light : config.stats.titleColor.text.dark)
      : null;
    const statsTitleLineColor = config.stats.titleColor?.line
      ? (isLightTheme ? config.stats.titleColor.line.light : config.stats.titleColor.line.dark)
      : null;

    const statsTitleSpan = statsTitleTextColor
      ? `<tspan x="390" y="${y}" fill="${statsTitleTextColor}">${escapeXml(statsTitle)}</tspan>`
      : `<tspan x="390" y="${y}">${escapeXml(statsTitle)}</tspan>`;
    const statsLineSpan = statsTitleLineColor
      ? `<tspan fill="${statsTitleLineColor}">${escapeXml(statsSeparator)}</tspan>`
      : `<tspan>${escapeXml(statsSeparator)}</tspan>`;

    detailLines.push(`${statsTitleSpan}${statsLineSpan}`);
    y += lineHeight;

    const rows = config.stats.rows || ['repos-stars', 'commits-followers', 'loc'];

    for (const row of rows) {
      if (row === 'loc') {
        const { dots1: locDots, dots2: locDelDots } = fitLocRow(data.loc, data.locAdd, data.locDel);
        detailLines.push(`<tspan x="390" y="${y}" class="cc">. </tspan><tspan class="key">Lines of Code</tspan>:<tspan class="cc">${escapeXml(locDots)}</tspan><tspan class="value">${data.loc}</tspan> ( <tspan class="addColor">${data.locAdd}</tspan><tspan class="addColor">++</tspan>,${escapeXml(locDelDots)}<tspan class="delColor">${data.locDel}</tspan><tspan class="delColor">--</tspan> )`);
      } else if (row.left && row.right) {
        const r = fitSplitRow(row.left.key, row.left.value, row.right.key, row.right.value);
        detailLines.push(`<tspan x="390" y="${y}" class="cc">. </tspan><tspan class="key">${escapeXml(r.leftKey)}</tspan>:<tspan class="cc">${escapeXml(r.dots1)}</tspan><tspan class="value">${escapeXml(r.leftVal)}</tspan> | <tspan class="key">${escapeXml(r.rightKey)}</tspan>:<tspan class="cc">${escapeXml(r.dots2)}</tspan><tspan class="value">${escapeXml(r.rightVal)}</tspan>`);
      }

      y += lineHeight;
    }
  }

  const svg = `<?xml version='1.0' encoding='UTF-8'?>
<svg xmlns="http://www.w3.org/2000/svg" font-family="Consolas,Monaco,monospace" width="985px" height="530px" font-size="16px">
<style>
@font-face {
  src: local('Consolas'), local('Monaco'), local('monospace');
  font-family: 'CardFont';
  font-display: swap;
}
.key { fill: ${colors.key}; }
.value { fill: ${colors.val}; }
.addColor { fill: ${colors.add}; }
.delColor { fill: ${colors.del}; }
.cc { fill: ${separatorColorOverride || colors.sep}; }
text, tspan { white-space: pre; }
</style>
<rect width="985px" height="530px" fill="${backgroundColorOverride || colors.bg}" rx="15"/>
<text x="${asciiX}" y="30" fill="${imageColorOverride || colors.ascii}"${textAnchor}>
${asciiLines}
</text>
<text x="390" y="30" fill="${colors.text}">
${detailLines.join('\n')}
</text>
</svg>`;

  return svg;
}

async function fetchConfig(configUrl) {
  try {
    const res = await fetch(configUrl);
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error('Failed to fetch config:', error);
    return null;
  }
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function replaceTemplateVars(str, data) {
  if (!str || typeof str !== 'string') return str;

  return str
    .replace(/\{\{username\}\}/g, data.username || '')
    .replace(/\{\{name\}\}/g, data.name || '')
    .replace(/\{\{company\}\}/g, capitalize(data.company) || '')
    .replace(/\{\{location\}\}/g, data.location || '')
    .replace(/\{\{bio\}\}/g, data.bio || '')
    .replace(/\{\{uptime\}\}/g, data.uptime || '')
    .replace(/\{\{languages\}\}/g, data.topLanguages || '')
    .replace(/\{\{repos\}\}/g, String(data.repos || 0))
    .replace(/\{\{stars\}\}/g, String(data.stars || 0))
    .replace(/\{\{forks\}\}/g, String(data.forks || 0))
    .replace(/\{\{gists\}\}/g, String(data.gists || 0))
    .replace(/\{\{issues\}\}/g, String(data.issues || 0))
    .replace(/\{\{prs\}\}/g, String(data.prs || 0))
    .replace(/\{\{commits\}\}/g, data.commits || '')
    .replace(/\{\{followers\}\}/g, String(data.followers || 0))
    .replace(/\{\{following\}\}/g, String(data.following || 0))
    .replace(/\{\{email\}\}/g, data.email || '')
    .replace(/\{\{blog\}\}/g, data.blog || '')
    .replace(/\{\{twitter\}\}/g, data.twitter || '')
    .replace(/\{\{created\}\}/g, data.createdAt || '');
}

function processConfig(config, data) {
  const processed = { sections: [] };

  const parseColors = (colorStr) => {
    if (!colorStr || typeof colorStr !== 'string') return null;
    const colors = [];
    let current = '';
    let parenDepth = 0;
    for (const char of colorStr) {
      if (char === '(') parenDepth++;
      else if (char === ')') parenDepth--;
      else if (char === ',' && parenDepth === 0) {
        colors.push(current.trim());
        current = '';
        continue;
      }
      current += char;
    }
    if (current.trim()) colors.push(current.trim());

    return {
      light: colors[0] || null,
      dark: colors[1] || colors[0] || null
    };
  };

  for (const section of config.sections) {
    const processedSection = {
      title: section.title ? replaceTemplateVars(section.title, data) : null,
      titleColor: section.titleColor ? {
        text: parseColors(section.titleColor.text),
        line: parseColors(section.titleColor.line)
      } : null,
      fields: section.fields.map(field => ({
        key: replaceTemplateVars(field.key, data),
        value: replaceTemplateVars(field.value, data),
        keyColor: parseColors(field.keyColor),
        valueColor: parseColors(field.valueColor)
      }))
    };
    processed.sections.push(processedSection);
  }

  const defaultRows = [
    { left: { key: 'Repos', value: '{{repos}}' }, right: { key: 'Stars', value: '{{stars}}' } },
    { left: { key: 'Commits', value: '{{commits}}' }, right: { key: 'Followers', value: '{{followers}}' } },
    'loc'
  ];

  const statsRows = config.stats?.rows || defaultRows;

  processed.stats = {
    enabled: config.stats?.enabled !== false,
    title: config.stats?.title ? replaceTemplateVars(config.stats.title, data) : '- GitHub Stats',
    titleColor: config.stats?.titleColor ? {
      text: parseColors(config.stats.titleColor.text),
      line: parseColors(config.stats.titleColor.line)
    } : null,
    rows: statsRows.map(row => {
      if (row === 'loc') return row;
      if (row.left && row.right) {
        return {
          left: {
            key: replaceTemplateVars(row.left.key, data),
            value: replaceTemplateVars(row.left.value, data)
          },
          right: {
            key: replaceTemplateVars(row.right.key, data),
            value: replaceTemplateVars(row.right.value, data)
          }
        };
      }
      return row;
    })
  };

  if (config.image) {
    processed.image = replaceTemplateVars(config.image, data);
  }

  processed.coloredImage = config.coloredImage === true;
  processed.imageScale = typeof config.imageScale === 'number' ? config.imageScale : 1;
  processed.removeBackground = config.removeBackground === true;
  processed.imageOffsetX = config.imageOffsetX ?? 0;
  processed.imageOffsetY = config.imageOffsetY ?? 0;

  if (config.imageColor && typeof config.imageColor === 'string') {
    processed.imageColor = parseColors(config.imageColor);
  }

  if (config.backgroundColor && typeof config.backgroundColor === 'string') {
    processed.backgroundColor = parseColors(config.backgroundColor);
  }

  if (config.separatorColor && typeof config.separatorColor === 'string') {
    processed.separatorColor = parseColors(config.separatorColor);
  }

  return processed;
}

function getDefaultConfig(data) {
  return {
    sections: [
      {
        title: `${data.username}@github`,
        fields: [
          { "key": "Name", "value": data.name || data.username },
          { "key": "Location", "value": data.location || "Earth" },
          { "key": "Created", "value": data.createdAt },
          { "key": "Uptime", "value": data.uptime },
          { "key": "Company", "value": data.company || "" }
        ]
      },
      {
        fields: [
          { "key": "Languages", "value": data.topLanguages || "Various" },
          { "key": "IDE", "value": "VSCode, Neovim" }
        ]
      },
      {
        title: "- Contact",
        fields: [
          { "key": "Email", "value": data.email || "Not public" },
          { "key": "Website", "value": data.blog || `https://github.com/${data.username}` },
          { "key": "GitHub", "value": `https://github.com/${data.username}` }
        ]
      }
    ],
    stats: {
      title: "- GitHub Stats",
      rows: [
        { left: { key: "Repos", value: String(data.repos) }, right: { key: "Stars", value: String(data.stars) } },
        { left: { key: "Following", value: String(data.following) }, right: { key: "Followers", value: String(data.followers) } },
        { left: { key: "Commits", value: data.commits }, right: { key: "Forks", value: String(data.forks) } },
        "loc"
      ]
    }
  };
}

export default async function handler(req, res) {
  const { username, theme = 'github-dark', config: configUrl } = req.query;

  if (!username) {
    res.status(400).json({ error: 'Missing username parameter. Usage: /api?username=YOUR_GITHUB_USERNAME' });
    return;
  }

  try {
    const token = process.env.GITHUB_TOKEN || '';

    const data = await fetchGitHubData(username, token);

    data.uptime = data.createdAt ? calculateUptime(data.createdAt) : '0 years';

    let config = null;
    if (configUrl) {
      config = await fetchConfig(configUrl);
    }
    if (!config) {
      config = getDefaultConfig(data);
    }

    config = processConfig(config, data);

    const imageUrl = config.image || data.avatarUrl;
    const transparentFormats = ['.png', '.webp', '.avif', '.gif', '.svg'];
    const hasTransparency = imageUrl && transparentFormats.some(ext => imageUrl.toLowerCase().endsWith(ext));
    const useColoredAscii = config.coloredImage === true;
    const imageScale = typeof config.imageScale === 'number' ? config.imageScale : 1;
    const removeBackground = config.removeBackground === true;
    const imageOffsetX = config.imageOffsetX ?? 0;
    const imageOffsetY = config.imageOffsetY ?? 0;
    const respectTransparency = hasTransparency || removeBackground;

    let asciiArt = DEFAULT_ASCII;
    let isCustomAscii = false;
    if (imageUrl) {
      const converted = await avatarToAscii(imageUrl, 25, 38, respectTransparency, useColoredAscii, imageScale, removeBackground, imageOffsetX, imageOffsetY);
      if (converted) {
        asciiArt = converted;
        isCustomAscii = true;
      }
    }

    const svg = generateSvgWithConfig(data, config, asciiArt, isCustomAscii, theme);

    res.setHeader('Cache-Control', 'public, max-age=14400, s-maxage=14400, stale-while-revalidate=86400');
    res.setHeader('Content-Type', 'image/svg+xml');
    res.status(200).send(svg);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
