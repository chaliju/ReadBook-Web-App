<!-- 听书组件 -->
<template>
  <div class="book-speaking">
    <detail-title @back="back" ref="title"></detail-title>
    <scroll
      class="content-wrapper"
      :top="42"
      :bottom="scrollBottom"
      :ifNoScroll="disableScroll"
      @onScroll="onScroll"
      ref="scroll"
    >
      <book-info :cover="cover" :title="title" :author="author" :desc="desc">
      </book-info>
      <div class="book-speak-title-wrapper">
        <div class="icon-speak-wrapper">
          <span class="icon-speak"></span>
        </div>
        <div class="speak-title-wrapper">
          <span class="speak-title">{{ $t("speak.voice") }}</span>
        </div>
        <div class="icon-down-wrapper" @click="toggleContent">
          <span
            :class="{ 'icon-down2': !ifShowContent, 'icon-up': ifShowContent }"
          ></span>
        </div>
      </div>
      <div class="book-detail-content-wrapper" v-show="ifShowContent">
        <div class="book-detail-content-list-wrapper">
          <div class="loading-text-wrapper" v-if="!this.navigation">
            <span class="loading-text">{{ $t("detail.loading") }}</span>
          </div>
          <div class="book-detail-content-item-wrapper">
            <div
              class="book-detail-content-item"
              v-for="(item, index) in flatNavigation"
              :key="index"
              @click="speak(item, index)"
            >
              <speak-playing
                v-if="playingIndex === index"
                :number="5"
                ref="speakPlaying"
              ></speak-playing>
              <div
                class="book-detail-content-navigation-text"
                :class="{ 'is-playing': playingIndex === index }"
                v-if="item.label"
              >
                {{ item.label }}
              </div>
            </div>
          </div>
        </div>
      </div>
      <audio
        @canplay="onCanPlay"
        @timeupdate="onTimeUpdate"
        @ended="onAudioEnded"
        ref="audio"
      ></audio>
    </scroll>
    <bottom
      :chapter="chapter"
      :currentSectionIndex="currentSectionIndex"
      :currentSectionTotal="currentSectionTotal"
      :showPlay="showPlay"
      :isPlaying.sync="isPlaying"
      :playInfo="playInfo"
      @onPlayingCardClick="onPlayingCardClick"
    ></bottom>
    <div class="book-wrapper">
      <div id="read"></div>
    </div>
    <speak-window
      :title="this.chapter ? this.chapter.label : ''"
      :book="book"
      :section="section"
      :currentSectionIndex.sync="currentSectionIndex"
      :currentSectionTotal="currentSectionTotal"
      :isPlaying.sync="isPlaying"
      :playInfo="playInfo"
      @updateText="updateText"
      ref="speakWindow"
    ></speak-window>
  </div>
</template>

<script type="text/ecmascript-6">
import DetailTitle from "../../components/detail/DetaiTitle";
import BookInfo from "../../components/detail/BookInfo";
import Scroll from "../../components/common/Scroll";
import SpeakPlaying from "../../components/speak/SpeakPlaying";
import Bottom from "../../components/speak/SpeakBottom";
import SpeakWindow from "../../components/speak/SpeakMask";
import { findBook, getCategoryName } from "../../utils/store";
import { flatList } from "../../api/store";
import { getLocalForage } from "../../utils/localForage";
import { realPx } from "../../utils/utils";
import Epub from "epubjs";

global.ePub = Epub;

const APPID = "ec8950ac";
const API_SECRET = "ZTE2ZGFhN2VjODRiNWE4NjJiNDcxNGI0";
const API_KEY = "3bd0b49cdce8ed0a3b0c012350dd3b3d";
let isChrome = navigator.userAgent.toLowerCase().match(/chrome/);
let notSupportTip = isChrome
  ? "您的浏览器暂时不支持体验功能，请升级您的浏览器"
  : "您现在使用的浏览器暂时不支持体验功能，<br />推荐使用谷歌浏览器Chrome";

function getWebsocketUrl() {
  return new Promise((resolve, reject) => {
    var apiKey = API_KEY;
    var apiSecret = API_SECRET;
    var url = "wss://tts-api.xfyun.cn/v2/tts";
    var host = location.host;
    var date = new Date().toGMTString();
    var algorithm = "hmac-sha256";
    var headers = "host date request-line";
    var signatureOrigin = `host: ${host}\ndate: ${date}\nGET /v2/tts HTTP/1.1`;
    var signatureSha = CryptoJS.HmacSHA256(signatureOrigin, apiSecret);
    var signature = CryptoJS.enc.Base64.stringify(signatureSha);
    var authorizationOrigin = `api_key="${apiKey}", algorithm="${algorithm}", headers="${headers}", signature="${signature}"`;
    var authorization = btoa(authorizationOrigin);
    url = `${url}?authorization=${authorization}&date=${date}&host=${host}`;
    resolve(url);
  });
}

let audioCtx;
let source;
let btnState = {
  unTTS: "立即合成",
  ttsing: "正在合成",
  endTTS: "立即播放",
  play: "停止播放",
  pause: "继续播放",
  endPlay: "重新播放",
  errorTTS: "合成失败",
};

class Experience {
  constructor({
    speed = 50,
    voice = 50,
    pitch = 50,
    text = "",
    engineType = "aisound",
    voiceName = "xiaoyan",
    playBtn = ".js-base-play",
    defaultText = "",
  } = {}) {
    this.speed = speed;
    this.voice = voice;
    this.pitch = pitch;
    this.text = text;
    this.defaultText = defaultText;
    this.engineType = engineType;
    this.voiceName = voiceName;
    this.playBtn = playBtn;
    this.playState = "";
    this.audioDatas = [];
    this.pcmPlayWork = new Worker("./transform.worker.js");
    this.pcmPlayWork.onmessage = (e) => {
      this.onmessageWork(e);
    };
  }

  setConfig({ speed, voice, pitch, text, defaultText, engineType, voiceName }) {
    speed && (this.speed = speed);
    voice && (this.voice = voice);
    pitch && (this.pitch = pitch);
    text && (this.text = text);
    defaultText && (this.defaultText = defaultText);
    engineType && (this.engineType = engineType);
    voiceName && (this.voiceName = voiceName);
    this.resetAudio();
  }

  onmessageWork(e) {
    switch (e.data.command) {
      case "newAudioData": {
        this.audioDatas.push(e.data.data);
        if (this.playState === "ttsing" && this.audioDatas.length === 1) {
          this.playTimeout = setTimeout(() => {
            this.audioPlay();
          }, 1000);
        }
        break;
      }
    }
  }

  setBtnState(state) {
    let oldState = this.playState;
    this.playState = state;
  }

  getAudio() {
    this.setBtnState("ttsing");
    getWebsocketUrl().then((url) => {
      this.connectWebsocket(url);
    });
  }

  connectWebsocket(url) {
    if ("WebSocket" in window) {
      this.websocket = new WebSocket(url);
    } else if ("MozWebSocket" in window) {
      this.websocket = new MozWebSocket(url);
    } else {
      alert(notSupportTip);
      return;
    }
    let self = this;
    this.websocket.onopen = (e) => {
      var params = {
        common: {
          app_id: APPID, // APPID
        },
        business: {
          ent: self.engineType,
          aue: "raw",
          auf: "audio/L16;rate=16000",
          vcn: self.voiceName,
          speed: self.speed,
          volume: self.voice * 10,
          pitch: self.pitch,
          //'bgs': 1,
          tte: "UTF8",
        },
        data: {
          status: 2,
          text: Base64.encode(self.text || self.defaultText || DEFAULT_TEXT),
        },
      };
      this.websocket.send(JSON.stringify(params));
    };
    this.websocket.onmessage = (e) => {
      let jsonData = JSON.parse(e.data);
      // 合成失败
      if (jsonData.code !== 0) {
        alert(`${jsonData.code}:${jsonData.message}`);
        self.resetAudio();
        this.websocket.close();
        return;
      }
      self.pcmPlayWork.postMessage({
        command: "transData",
        data: jsonData.data.audio,
      });

      if (jsonData.code === 0 && jsonData.data.status === 2) {
        this.websocket.close();
      }
    };
    this.websocket.onerror = (e) => {
      console.log(e);
      console.log(e.data);
    };
    this.websocket.onclose = (e) => {
      console.log(e);
    };
  }

  resetAudio() {
    this.audioPause();
    this.setBtnState("unTTS");
    this.audioDatasIndex = 0;
    this.audioDatas = [];
    this.websocket && this.websocket.close();
    clearTimeout(this.playTimeout);
  }

  audioPlay() {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (!audioCtx) {
        alert(notSupportTip);
        return;
      }
    } catch (e) {
      alert(notSupportTip);
      return;
    }
    this.audioDatasIndex = 0;
    if (this.audioDatas.length) {
      this.playSource();
      this.setBtnState("play");
    } else {
      this.getAudio();
    }
  }

  audioPause(state) {
    if (this.playState === "play") {
      this.setBtnState(state || "endPlay");
    }
    clearTimeout(this.playTimeout);
    try {
      source && source.stop();
    } catch (e) {
      console.log(e);
    }
  }

  playSource() {
    let bufferLength = 0;
    let dataLength = this.audioDatas.length;
    for (let i = this.audioDatasIndex; i < dataLength; i++) {
      bufferLength += this.audioDatas[i].length;
    }
    let audioBuffer = audioCtx.createBuffer(1, bufferLength, 22050);
    let offset = 0;
    let nowBuffering = audioBuffer.getChannelData(0);
    for (let i = this.audioDatasIndex; i < dataLength; i++) {
      let audioData = this.audioDatas[i];
      if (audioBuffer.copyToChannel) {
        audioBuffer.copyToChannel(audioData, 0, offset);
      } else {
        for (let j = 0; j < audioData.length; j++) {
          nowBuffering[offset + j] = audioData[j];
        }
      }
      offset += audioData.length;
      this.audioDatasIndex++;
    }

    source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioCtx.destination);
    source.start();
    source.onended = (event) => {
      if (this.playState !== "play") {
        return;
      }
      if (this.audioDatasIndex < this.audioDatas.length) {
        this.playSource();
      } else {
        this.audioPause("endPlay");
      }
    };
  }
}

let experience = new Experience({
  speed: 50,
  voice: 50,
  pitch: 50,
  playBtn: `.audio-ctrl-btn`,
});

export default {
  components: {
    DetailTitle,
    BookInfo,
    Scroll,
    SpeakPlaying,
    Bottom,
    SpeakWindow,
  },
  computed: {
    // 音频当前播放的分钟数
    currentMinute() {
      const m = Math.floor(this.currentPlayingTime / 60);
      return m < 10 ? "0" + m : m;
    },
    // 音频当前播放的秒数
    currentSecond() {
      const s = Math.floor(
        this.currentPlayingTime - parseInt(this.currentMinute) * 60
      );
      return s < 10 ? "0" + s : s;
    },
    // 音频的总时长
    totalMinute() {
      const m = Math.floor(this.totalPlayingTime / 60);
      return m < 10 ? "0" + m : m;
    },
    // 音频的总秒数
    totalSecond() {
      const s = Math.floor(
        this.totalPlayingTime - parseInt(this.totalMinute) * 60
      );
      return s < 10 ? "0" + s : s;
    },
    // 音频的剩余分钟数
    leftMinute() {
      const m = Math.floor(
        (this.totalPlayingTime - this.currentPlayingTime) / 60
      );
      return m < 10 ? "0" + m : m;
    },
    // 音频的剩余秒数
    leftSecond() {
      const s = Math.floor(
        this.totalPlayingTime -
          this.currentPlayingTime -
          parseInt(this.leftMinute) * 60
      );
      return s < 10 ? "0" + s : s;
    },
    // 播放信息对象
    playInfo() {
      if (this.audioCanPlay) {
        return {
          currentMinute: this.currentMinute,
          currentSecond: this.currentSecond,
          totalMinute: this.totalMinute,
          totalSecond: this.totalSecond,
          leftMinute: this.leftMinute,
          leftSecond: this.leftSecond,
        };
      } else {
        return null;
      }
    },
    // 电子书的语种
    lang() {
      return this.metadata ? this.metadata.language : "";
    },
    // 当播放面板显示时，禁用滚动条（解决事件穿透问题）
    disableScroll() {
      if (this.$refs.speakWindow) {
        return this.$refs.speakWindow.visible;
      } else {
        return false;
      }
    },
    // 是否底部的播放面板
    showPlay() {
      return this.playingIndex >= 0;
    },
    // 滚动条距底部距离，当显示播放面板时为116像素，不显示时为52像素
    scrollBottom() {
      return this.showPlay ? 116 : 52;
    },
    // 当前章节信息
    chapter() {
      return this.flatNavigation[this.playingIndex];
    },
    // 电子书摘要信息
    desc() {
      if (this.description) {
        return this.description.substring(0, 100);
      } else {
        return "";
      }
    },
    // 一维数组的目录
    flatNavigation() {
      if (this.navigation) {
        return Array.prototype.concat.apply(
          [],
          Array.prototype.concat.apply(
            [],
            this.doFlatNavigation(this.navigation.toc)
          )
        );
      } else {
        return [];
      }
    },
    // 电子书分类
    category() {
      return this.bookItem ? getCategoryName(this.bookItem.category) : "";
    },
    // 电子书书名
    title() {
      return this.metadata ? this.metadata.title : "";
    },
    // 电子书作者
    author() {
      return this.metadata ? this.metadata.creator : "";
    },
  },
  data() {
    return {
      bookItem: null,
      book: null,
      rendition: null,
      metadata: null,
      cover: null,
      navigation: null,
      description: null,
      ifShowContent: true,
      playingIndex: -1,
      paragraph: null,
      currentSectionIndex: null,
      currentSectionTotal: null,
      section: null,
      isPlaying: false,
      audio: null,
      audioCanPlay: false,
      currentPlayingTime: 0,
      totalPlayingTime: 0,
      playStatus: 0, // 0 - 未播放，1 - 播放中，2 - 暂停中
      toastText: "",
      isOnline: false,
    };
  },
  methods: {
    // 在线语音合成
    createVoice(text) {
      // console.log("在线语音合成", text);
      // if (text !== experience.text) {
      //   experience.setConfig({
      //     text,
      //   });
      // }
      // console.log(experience);
      // if (experience.playState === "play") {
      //   experience.audioPause();
      //   this.resetPlay();
      // } else {
      //   experience.audioPlay();
      //   this.isPlaying = true;
      //   this.playStatus = 1;
      // }

      const xmlhttp = new XMLHttpRequest();
      // 创建HTTP请求，同步接收结果
      xmlhttp.open(
        "GET",
        `${
          process.env.VUE_APP_VOICE_URL
        }/voice?text=${text}&lang=${this.lang.toLowerCase()}`,
        false
      );
      // 发送请求
      xmlhttp.send();
      // 获取响应内容
      const xmlDoc = xmlhttp.responseText;
      if (xmlDoc) {
        // 解析响应内容
        const json = JSON.parse(xmlDoc);
        // console.log(json);
        if (json.path) {
          // path为语音合成生成的MP3文件下载路径，将该路径赋值audio.src
          // audio控件会自动加载音频文件
          this.$refs.audio.src = json.path;
          // 自动播放MP3
          this.continuePlay();
        } else {
          this.showToast("播放失败，未生成链接");
        }
      } else {
        this.showToast("播放失败");
      }
    },
    // 切换播放状态，如果处于播放状态则暂停，如果处于暂停状态，则播放
    // 注意状态0和状态2是不通的
    // 状态0 表示还未播放，所以需要先进行语音合成
    // 状态2 表示已经合成，所以直接进行播放即可
    togglePlay() {
      if (!this.isPlaying) {
        if (this.playStatus === 0) {
          this.play();
        } else if (this.playStatus === 2) {
          this.continuePlay();
        }
      } else {
        this.pausePlay();
      }
    },
    // 生成语音合成的文本信息
    speak(item, index) {
      // 重置播放状态，停止一切播放
      this.resetPlay();
      this.playingIndex = index;
      this.$nextTick(() => {
        this.$refs.scroll.refresh();
        if (this.chapter) {
          // 获取当前点击的章节信息
          this.section = this.book.spine.get(this.chapter.href);
          // 渲染章节
          this.rendition.display(this.section.href).then((section) => {
            // 获取当前位置对象
            const currentPage = this.rendition.currentLocation();
            const cfibase = section.cfiBase;
            const cfistart = currentPage.start.cfi
              .replace(/.*!/, "")
              .replace(/\)/, "");
            const cfiend = currentPage.end.cfi
              .replace(/.*!/, "")
              .replace(/\)/, "");
            this.currentSectionIndex = currentPage.start.displayed.page;
            this.currentSectionTotal = currentPage.start.displayed.total;
            // 合成cfi信息
            const cfi = `epubcfi(${cfibase}!,${cfistart},${cfiend})`;
            // console.log(currentPage, cfi, cfibase, cfistart, cfiend)
            // 通过Book.getRange(cfi)方法获取指定片段的cfi对应的文本
            this.book.getRange(cfi).then((range) => {
              // 获取章节片段的文本信息
              let text = range.toLocaleString();
              // 对文本信息进行过滤，去除其中的空格（注意是2个空格，1个空格是合理的）、换行符等特殊字符
              text = text.replace(/\s(2,)/g, "");
              text = text.replace(/\r/g, "");
              text = text.replace(/\n/g, "");
              text = text.replace(/\t/g, "");
              text = text.replace(/\f/g, "");
              // 更新语音合成的文本信息
              this.updateText(text);
            });
          });
        }
      });
    },
    // 重置播放状态
    resetPlay() {
      if (this.playStatus === 1) {
        this.pausePlay();
      }
      this.isPlaying = false;
      this.playStatus = 0;
    },
    // 从头开始语音合成并播放
    play() {
      this.createVoice(this.paragraph);
    },
    // 继续播放
    continuePlay() {
      this.$refs.audio.play().then(() => {
        // 显示播放动画
        this.$refs.speakPlaying[0].startAnimation();
        this.isPlaying = true;
        this.playStatus = 1;
      });
    },
    // 暂停播放
    pausePlay() {
      this.$refs.audio.pause();
      // 暂停播放动画
      // this.$refs.speakPlaying[0].stopAnimation();
      this.isPlaying = false;
      this.playStatus = 2;
    },
    // 当播放结束时，刷新播放信息
    onAudioEnded() {
      this.resetPlay();
      this.currentPlayingTime = this.$refs.audio.currentTime;
      const percent = Math.floor(
        (this.currentPlayingTime / this.totalPlayingTime) * 100
      );
      this.$refs.speakWindow.refreshProgress(percent);
    },
    // 当播放进行时，刷新播放信息
    onTimeUpdate() {
      this.currentPlayingTime = this.$refs.audio.currentTime;
      const percent = Math.floor(
        (this.currentPlayingTime / this.totalPlayingTime) * 100
      );
      this.$refs.speakWindow.refreshProgress(percent);
    },
    // 调用audio.src时，audio控件会调用canplay事件
    // 此时我们可以获取总播放时长和当前播放时长
    onCanPlay() {
      this.audioCanPlay = true;
      this.currentPlayingTime = this.$refs.audio.currentTime;
      this.totalPlayingTime = this.$refs.audio.duration;
    },
    // 通过API找到当前电子书的详情数据
    findBookFromList(fileName) {
      flatList().then((response) => {
        if (response.status === 200) {
          const bookList = response.data.data.filter(
            (item) => item.fileName === fileName
          );
          if (bookList && bookList.length > 0) {
            this.bookItem = bookList[0];
            this.init();
          }
        }
      });
    },
    // 初始化参数信息
    init() {
      const fileName = this.$route.query.fileName;
      if (!this.bookItem) {
        this.bookItem = findBook(fileName);
      }
      if (this.bookItem) {
        // 如果电子书已经缓存，则直接从IndexedDB数据库中获取
        getLocalForage(fileName, (err, blob) => {
          if (err || !blob) {
            // 如果获取缓存失败，则拼接opf文件来获取电子书
            this.isOnline = true;
            const opf = this.$route.query.opf;
            if (opf) {
              this.parseBook(opf);
            }
          } else {
            this.isOnline = false;
            // 解析电子书
            this.parseBook(blob);
          }
        });
      } else {
        this.findBookFromList(fileName);
      }
    },
    // 解析电子书
    parseBook(blob) {
      // 解析电子书
      this.book = new Epub(blob);
      // 获取电子书的metadata
      this.book.loaded.metadata.then((metadata) => {
        this.metadata = metadata;
      });
      // 如果是在线获取的电子书，则通过Book.coverUrl()方法获取封面链接
      if (this.isOnline) {
        this.book.coverUrl().then((url) => {
          this.cover = url;
        });
      } else {
        // 如果是本地获取的电子书，通过Book.loaded.cover方法获取封面链接（加快封面获取速度）
        this.book.loaded.cover.then((cover) => {
          this.book.archive.createUrl(cover).then((url) => {
            this.cover = url;
          });
        });
      }
      // 获取电子书的目录信息
      this.book.loaded.navigation.then((nav) => {
        this.navigation = nav;
      });
      // 渲染电子书
      this.display();
    },
    back() {
      this.$router.go(-1);
    },
    // 处理滚动条的事件，决定标题阴影是否展示
    onScroll(offsetY) {
      if (offsetY > realPx(42)) {
        this.$refs.title.showShadow();
      } else {
        this.$refs.title.hideShadow();
      }
    },
    toggleContent() {
      this.ifShowContent = !this.ifShowContent;
    },
    // 渲染电子书
    display() {
      const height =
        window.innerHeight * 0.9 -
        realPx(40) -
        realPx(54) -
        realPx(46) -
        realPx(48) -
        realPx(60) -
        realPx(44);
      this.rendition = this.book.renderTo("read", {
        width: window.innerWidth,
        height: height,
        method: "default",
      });
      this.rendition.display();
    },
    doFlatNavigation(content, deep = 1) {
      const arr = [];
      content.forEach((item) => {
        item.deep = deep;
        arr.push(item);
        if (item.subitems && item.subitems.length > 0) {
          arr.push(this.doFlatNavigation(item.subitems, deep + 1));
        }
      });
      return arr;
    },
    showToast(text) {
      this.simpleToast(text);
    },
    onPlayingCardClick() {
      this.$refs.speakWindow.show();
    },
    updateText(text) {
      this.paragraph = text;
    },
  },
  mounted() {
    this.init();
  },
};
</script>

<style lang="scss" rel="stylesheet/scss" scoped>
@import "../../assets/styles/global";

.book-speaking {
  font-size: px2rem(16);
  width: 100%;
  background: white;

  .content-wrapper {
    width: 100%;

    .book-speak-title-wrapper {
      display: flex;
      padding: px2rem(15);
      box-sizing: border-box;
      border-bottom: px2rem(1) solid #eee;

      .icon-speak-wrapper {
        flex: 0 0 px2rem(40);
        @include left;

        .icon-speak {
          font-size: px2rem(24);
          color: #999;
        }
      }

      .speak-title-wrapper {
        flex: 1;
        @include left;

        .speak-title {
          font-size: px2rem(16);
          font-weight: bold;
          color: #666;
        }
      }

      .icon-down-wrapper {
        flex: 0 0 px2rem(40);
        @include right;

        .icon-up {
          font-size: px2rem(12);
          color: #999;
        }

        .icon-down2 {
          font-size: px2rem(12);
          color: #999;
        }
      }
    }

    .book-detail-content-wrapper {
      width: 100%;
      border-bottom: px2rem(1) solid #eee;
      box-sizing: border-box;

      .book-detail-content-list-wrapper {
        padding: px2rem(10) px2rem(15);

        .loading-text-wrapper {
          width: 100%;

          .loading-text {
            font-size: px2rem(14);
            color: #999;
          }
        }

        .book-detail-content-item-wrapper {
          .book-detail-content-item {
            display: flex;
            padding: px2rem(15) 0;
            font-size: px2rem(14);
            line-height: px2rem(16);
            color: #333;
            border-bottom: px2rem(1) solid #eee;

            &:last-child {
              border-bottom: none;
            }

            .book-detail-content-navigation-text {
              flex: 1;
              width: 100%;
              @include ellipsis;

              &.is-playing {
                color: $color-blue;
                font-weight: bold;
                margin-left: px2rem(10);
              }
            }
          }
        }
      }
    }
  }

  .book-wrapper {
    position: absolute;
    bottom: -100%;
    z-index: 100;
  }
}
</style>
