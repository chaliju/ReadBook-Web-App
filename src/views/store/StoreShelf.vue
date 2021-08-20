<template>
  <div class="store-shelf">
    <shelf-title></shelf-title>
    <scroll class="store-shelf-scroll-wrapper" :top="0">
      <shelf-search></shelf-search>
    </scroll>
  </div>
</template>

<script>
import ShelfTitle from '../../components/shelf/ShelfTitle.vue'
import Scroll from '../../components/common/Scroll.vue'
import ShelfSearch from '../../components/shelf/ShelfSearch.vue'
import { storeShelfMixin } from '../../utils/mixin'
import { shelf } from '../../api/store'

export default {
  name: 'StoreShelf',
  mixins: [storeShelfMixin],
  components: {
    ShelfTitle,
    Scroll,
    ShelfSearch
  },
  methods: {
    getShelfList() {
      shelf().then(response => {
        if (response.status === 200 && response.data && response.data.bookList) {
          this.setShelfList(response.data.bookList)
        }
      })
    }
  },
  mounted() {
    this.getShelfList()
  }
}
</script>

<style lang='scss' rel='stylesheet/scss' scoped>
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