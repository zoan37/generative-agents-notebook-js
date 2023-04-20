<script setup lang="ts">
import HelloWorld from './components/HelloWorld.vue'

import { getWindowAI } from 'window.ai';

import { WindowAILLM } from './window_ai_llm';

import { runNotebook } from './notebook';

async function clickRunNotebookButton() {
  const ai = await getWindowAI();

  runNotebook({
    log: console.log, // TODO: write to html
    llm: new WindowAILLM({})
  });
}
</script>

<template>
  <div>
    <button @click="clickRunNotebookButton">Run Notebook</button>
  </div>
  <div>
    <a href="https://vitejs.dev" target="_blank">
      <img src="/vite.svg" class="logo" alt="Vite logo" />
    </a>
    <a href="https://vuejs.org/" target="_blank">
      <img src="./assets/vue.svg" class="logo vue" alt="Vue logo" />
    </a>
  </div>
</template>

<style scoped>
.logo {
  height: 6em;
  padding: 1.5em;
  will-change: filter;
  transition: filter 300ms;
}
.logo:hover {
  filter: drop-shadow(0 0 2em #646cffaa);
}
.logo.vue:hover {
  filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
