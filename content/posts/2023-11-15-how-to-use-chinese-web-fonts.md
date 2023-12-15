---
title: "如何在网站中正确使用中文字体"
date: 2023-11-14T15:47:20+0800
tags: [fonts, design]
---

{{% panguSpacing %}}

## 中文字体的挑战

与只含几十个字母加上常用符号的拉丁字体不同，一个完整的中文字体字符集超过1万个字符。中文常用字有3500+个，而《通用规范汉字表》则收录了8000多个汉字。因此中文字体的大小远超英文字体，往往从10MB起步[^1]。这意味着中文字体大多预装在操作系统内，而不适宜作为网站资源直接加载。

[^1]: 谷歌推出的[Noto Sans SC](https://fonts.google.com/noto/specimen/Noto+Sans+SC?noto.query=noto+sans+sc)简体中文字体大小超过10MB（ttf格式）。

## 可变字体（Variable Fonts）
单一常规字体的体积已经相当可观，如果还需要支持粗体、斜体等不同字形（如`Bold` `Italic`），每种字形又得加载独立的字体文件，总字体文件的体积就会成倍增加。因此，[**variable fonts**](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_fonts/Variable_fonts_guide#variable_fonts)技术应运而生，它通过算法将多种字形融合进一个文件中，减少了总体积，尽管总体积会略大于单个字体文件。例如，Adobe 在其 [Source Han Sans](https://blog.adobe.com/en/publish/2021/04/08/source-han-sans-goes-variable) 字体的介绍中说明了一些技术细节，最终能以4.2MB的**woff2**格式提供可变字体。不过，即使如此，在网页中直接引用一个4.2MB的字体文件也会显著影响网页加载速度。

## 解决方案
目前针对网页中使用中文字体的最佳实践是，将中文字体分割成多个包，并利用`CSS`中的**unicode-range**特性来实现字符的按需加载。这样，只有在网页上出现需要渲染的中文字时，才会加载对应的资源包。通常情况下，只需加载几个包含常用字符的字体包。

> The unicode-range CSS descriptor sets the specific range of characters to be used from a font defined by @font-face and made available for use on the current page. If the page doesn’t use any character in this range, the font is not downloaded; if it uses at least one, the whole font is downloaded. {=[MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/unicode-range)}

使用[local google fonts](https://local-google-fonts.vercel.app/)在线工具可以轻松实现字体拆分和生成CSS引用。下载CSS文件后，请确保修改`src: url()`以使用正确的路径。

## CSS配置

有了正确的 `font-face` 和中文字体之后，应该在 CSS 中设置中文字体的 fallback, 使用`Noto Sans SC`添加比较通用的 fallback 字体设置如下

```css
font-family: 'Noto Sans SC', "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "WenQuanYi Micro Hei", sans-serif;
```


 ## References
 * [self hosting google web fonts](https://dominikschilling.de/notes/self-hosting-google-web-fonts-helper/)
 * [中文字体的终极解决方案——对字体进行切片](https://voderl.cn/js/%E5%AF%B9%E4%B8%AD%E6%96%87%E5%AD%97%E4%BD%93%E8%BF%9B%E8%A1%8C%E5%88%87%E7%89%87/)
 * [Improve font fallbacks](https://developer.chrome.com/blog/font-fallbacks/)

{{% /panguSpacing %}}