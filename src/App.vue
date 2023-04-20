<script setup lang="ts">
import { getWebConfig } from './web_config';
import { runNotebook } from './notebook';
import { reactive } from 'vue';

const state = reactive({
  isNotebookRunning: false
});

function scrollToBottom() {
  const notebookEndDiv = document.getElementById("notebook_end");
  if (notebookEndDiv) {
    notebookEndDiv.scrollIntoView({
      behavior: "smooth"
    });
  }
}

async function clickRunNotebookButton() {
  // TODO: Import window.ai npm package (currently it's causing issues with Vite, need to debug)
  // @ts-ignore
  const ai = window.ai;
  if (!ai) {
    alert("window.ai not found. Please install at https://windowai.io/");
    throw new Error("window.ai not found");
  }

  const webConfig = getWebConfig();

  /*
  var term = new Terminal({
    convertEol: true,
    cols: 80,
    rows: 30,
  });

  term.open(document.getElementById('terminal')!);
  */

  // override log function
  webConfig.log = (a: any, b: any) => {
    if (b == undefined) {
      console.log(a);
    } else {
      console.log(a, b);
    }

    // if a is a string, then it's a log message; if it's an object, then JSON stringify it
    let logMessageA = a;
    let logMessageB = b;

    if (logMessageA != undefined) {
      logMessageA = typeof a === "string" ? a : JSON.stringify(a);
    }
    if (logMessageB != undefined) {
      logMessageA = typeof a === "string" ? a : JSON.stringify(a);
    }

    // append log messages to 'notebook_output' div
    // const notebookOutputDiv = document.getElementById("notebook_output");
    // if (notebookOutputDiv) {
    let content = logMessageA;
    if (logMessageB) {
      content += " " + logMessageB;
    }

    const container = document.getElementById('notebook_output')!;
    // const shouldScroll = container.scrollTop + container.clientHeight >= container.scrollHeight;
    let shouldScroll = false;
    const BUFFER = 3;
    // @ts-ignore
    if ($(window).scrollTop() + $(window).height() + BUFFER > $(document).height()) {
      // you're at the bottom of the page
      shouldScroll = true;
    }

    console.log(content);

    $('#notebook_output').append(content + '\n');

    // notebookOutputDiv.innerHTML += `${content}\n`;

    // term.write(`${content}\n`);
    // }

    if (shouldScroll) {
      setTimeout(() => {
        scrollToBottom();
      }, 1); // wait for UI to render new message
    }
  };

  state.isNotebookRunning = true;

  runNotebook(webConfig).catch(err => {
    console.error("Error encountered", err);
    alert('Error encountered: ' + err);
  });
}
</script>

<template>
  <div style="padding-left: 30px; padding-right: 30px;">
    <h1 class="mt-3">Generative Agents Notebook Demo</h1>
    <p>
      This text-based demo (relatively incomplete, see note) runs generative agents in your browser using <a target="_blank"
        href="https://windowai.io/">window.ai</a>.
      It executes a whole TypeScript "notebook" like the
      <a target="_blank" href="https://python.langchain.com/en/latest/use_cases/agents/characters.html">Generative
        Agents
        in LangChain Python notebook</a>.
      The source code (<a target="_blank" href="https://github.com/zoan37/generative-agents-notebook-js">view on
        Github</a>) was largely ported from the Python notebook via GPT-4.
    </p>
    <p>
      Note: In the "Dialogue between Generative Agents" section, the agents could get stuck in an infinite loop of saying goodbye.
      This could be because the web app uses a mock embedding model, and a memory vector store (the local script version
      doesn't have this issue, and it uses OpenAI embedding model and FAISS vector store).
    </p>

    <div v-if="!state.isNotebookRunning">
      <button class="btn btn-primary btn-lg" @click="clickRunNotebookButton">Run Notebook</button>
    </div>

    <div v-show="state.isNotebookRunning">
      <div id="notebook_container">
        <div id="notebook_output">
        </div>
        <div id="notebook_end">
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
#notebook_output {
  font-family: monospace;
  white-space: pre-line;
}

#notebook_end {
  height: 50px;
}
</style>
