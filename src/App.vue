<script setup lang="ts">
import { getWebConfig } from './web_config';
import { runNotebook } from './notebook';

async function clickRunNotebookButton() {
  // TODO: Import window.ai npm package (currently it's causing issues with Vite, need to debug)
  // @ts-ignore
  const ai = window.ai;
  if (!ai) {
    alert("window.ai not found. Please install at https://windowai.io/");
    throw new Error("window.ai not found");
  }

  const webConfig = getWebConfig();

  runNotebook(webConfig);
}
</script>

<template>
  <div class="container">
    <h1 class="mt-3">Generative Agents Notebook Demo</h1>
    <p>
      This demo runs generative agents in your browser using <a target="_blank" href="https://windowai.io/">window.ai</a>.
      It executes a whole TypeScript "notebook" like the
      <a target="_blank" href="https://python.langchain.com/en/latest/use_cases/agents/characters.html">Generative Agents in LangChain Python notebook</a>.
      The source code (<a target="_blank" href="https://github.com/zoan37/generative-agents-notebook-js">view on Github</a>) was mainly ported from the Python notebook via GPT-4.
    </p>

    <div>
      <button class="btn btn-primary btn-lg" @click="clickRunNotebookButton">Run Notebook</button>
    </div>
  </div>
</template>

<style scoped>
</style>
