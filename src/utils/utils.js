export function px2rem(px) {
  const ratio = 375 / 10
  return px / ratio
}

// 真实像素
export function realPx(px) {
  const maxWidth = window.innerWidth > 500 ? 500 : window.innerWidth
  return px * (maxWidth / 375)
}
