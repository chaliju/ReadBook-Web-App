<template>
  <div class="shelf-list">
    <div class="shelf-list-item-wrapper" v-for="item in shelfList" :key="item.id">
      <shelf-item :data="item" :style="{ height: itemHeight }"></shelf-item>
      <div class="shelf-list-item-title-wrapper">
        <span class="shelf-list-title title-small">{{ item.title }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import { storeShelfMixin } from '../../utils/mixin'
import ShelfItem from './ShelfItem.vue'
import { realPx } from '../../utils/utils'

export default {
  name: 'ShelfList',
  mixins: [storeShelfMixin],
  components: {
    ShelfItem
  },
  computed: {
    itemHeight() {
      // 实际高度 h =w * 350 / 250
      return ((window.innerWidth - realPx(120)) / 3) / 250 * 350 + 'px'
    }
  }
}
</script>

<style lang='scss' rel='stylesheet/scss' scoped>
@import "../../assets/styles/global";

.shelf-list {
  position: absolute;
  top: px2rem(94);
  left: 0;
  z-index: 100;
  display: flex;
  flex-flow: row wrap; // 水平排列，可换行
  width: 100%;
  padding: 0 px2rem(15);
  box-sizing: border-box;
  .shelf-list-item-wrapper {
    flex: 0 0 33.33%;
    width: 33.33%;
    padding: px2rem(15);
    box-sizing: border-box;
    .shelf-list-item-title-wrapper{
      margin-top: px2rem(10);
    }
  }
}
</style>