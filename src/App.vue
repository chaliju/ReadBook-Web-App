<template>
  <div id="app">
    <router-view />
  </div>
</template>

<script>
export default {

}
document.addEventListener('DOMContentLoaded', () => {
  // 获取html元素
  const html = document.querySelector('html')
  // 根据屏幕宽度动态计算fontSize
  let fontSize = window.innerWidth / 10
  // 当fontSize大于50时，设置最大值为50
  fontSize = fontSize > 50 ? 50 : fontSize
  // 设置html的fontSize属性，使rem生效，1rem = fontSize + 'px'
  html.style.fontSize = fontSize + 'px'
})
</script>

<style lang="scss" scoped>
#app {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #7d8188;
}
</style>
