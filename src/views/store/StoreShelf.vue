<!-- 书架组件 -->
<template>
  <div class="store-shelf">
    <shelf-title :title="$t('shelf.title')"></shelf-title>
    <scroll class="store-shelf-scroll-wrapper"
            :top="0"
            :bottom="scrollBottom"
            @onScroll="onScroll"
            ref="scroll">
      <shelf-search></shelf-search>
      <shelf-list :data="shelfList"></shelf-list>
    </scroll>
    <shelf-footer></shelf-footer>
  </div>
</template>

<script>
  import ShelfTitle from '../../components/shelf/ShelfTitle'
  import { storeShelfMixin } from '../../utils/mixin'
  import Scroll from '../../components/common/Scroll'
  import ShelfSearch from '../../components/shelf/ShelfSearch'
  import ShelfList from '../../components/shelf/ShelfList'
  import ShelfFooter from '../../components/shelf/ShelfFooter'

  export default {
    mixins: [storeShelfMixin],
    components: {
      Scroll,
      ShelfTitle,
      ShelfSearch,
      ShelfList,
      ShelfFooter
    },
    watch: {
      // 监听编辑模式，编辑模式下滚动条距底部需要产生48像素的距离
      isEditMode(isEditMode) {
        this.scrollBottom = isEditMode ? 48 : 0
        this.$nextTick(() => {
          this.$refs.scroll.refresh()
        })
      }
    },
    data() {
      return {
        scrollBottom: 0
      }
    },
    methods: {
      // 滚动页面的监听事件，ShelfTitle和ShelfSearch组件会进行监听
      onScroll(offsetY) {
        this.setOffsetY(offsetY)
      }
    },
    mounted() {
      // 获取书架列表数据
      this.getShelfList()
      // 初始化书架分类数据
      this.setShelfCategory([])
      // 设置vuex的currentType为1，表示当前位于书架，影响ShelfTitle状态
      this.setCurrentType(1)
    }
  }
</script>

<style lang="scss" rel="stylesheet/scss" scoped>
  @import "../../assets/styles/global";

  .store-shelf {
    position: relative;
    z-index: 100;
    width: 100%;
    height: 100%;
    background: white;
    .store-shelf-scroll-wrapper {
      position: absolute;
      top: 0;
      left: 0;
      z-index: 101;
    }
  }
</style>
