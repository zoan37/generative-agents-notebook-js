# generative-agents-notebook-js

This package includes an experimental implementation and text-based "notebook" demos of generative agents in TypeScript. The code is largely ported (via GPT-4) from the [Generative Agents in LangChain Python notebook](https://python.langchain.com/en/latest/use_cases/agents/characters.html), which is based on the [Generative Agents: Interactive Simulacra of Human Behavior](https://arxiv.org/abs/2304.03442) paper.

The local demo runs generative agents with OpenAI embedding model and FAISS vector store.

The web demo runs generative agents with a mock embedding model and a memory vector store. It is powered by [window.ai](https://windowai.io/), which allows you to use your on AI models. Mock embedding model was used because window.ai doesn't support embedding models yet, and memory vector store was used because FAISS is difficult to build for the web (originally in C++) and haven't found a way yet. This can lead to the dialogue between the agents getting stuck in an infinite loop of saying goodbye.

Some differences between this TypeScript implementation and the Generative Agents in LangChain Python notebook:
* The relevance score function is not used in the embedding model because the FAISS vector store implementation in TypeScript doesn't support it (the implemenation comes from [this pull request](https://github.com/hwchase17/langchainjs/pull/685)).
* Some `chain.run()` calls were failing so had to change to `chain.call()`.


## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur) + [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin).

## Type Support For `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin) to make the TypeScript language service aware of `.vue` types.

If the standalone TypeScript plugin doesn't feel fast enough to you, Volar has also implemented a [Take Over Mode](https://github.com/johnsoncodehk/volar/discussions/471#discussioncomment-1361669) that is more performant. You can enable it by the following steps:

1. Disable the built-in TypeScript Extension
   1. Run `Extensions: Show Built-in Extensions` from VSCode's command palette
   2. Find `TypeScript and JavaScript Language Features`, right click and select `Disable (Workspace)`
2. Reload the VSCode window by running `Developer: Reload Window` from the command palette.
