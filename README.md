# generative-agents-notebook-js

**Web demo:** https://generative-agents-notebook-js.vercel.app/

This package includes an experimental implementation and text-based "notebook" demos of generative agents in TypeScript. The motivation is to run generative agents on the web browser. The code is largely ported (via GPT-4) from the [Generative Agents in LangChain Python notebook](https://python.langchain.com/en/latest/use_cases/agents/characters.html), which is based on the [Generative Agents: Interactive Simulacra of Human Behavior](https://arxiv.org/abs/2304.03442) paper.

The local demo runs generative agents with OpenAI embedding model and FAISS vector store.

The web demo runs generative agents with a mock embedding model and a memory vector store. It is powered by [window.ai](https://windowai.io/), which allows you to use your own AI models on the web. Mock embedding model was used because window.ai doesn't support embedding models yet (maybe could explore local embedding models also), and memory vector store was used because FAISS is difficult to build for the web (originally in C++) and haven't found a way yet. This can lead to the dialogue between the agents getting stuck in an infinite loop of saying goodbye.

Some differences between this TypeScript implementation and the Generative Agents in LangChain Python notebook:
* The relevance score function is not used in the embedding model because the FAISS vector store implementation in TypeScript doesn't support it (the implementation comes from [this pull request](https://github.com/hwchase17/langchainjs/pull/685)).
* Some `chain.run()` calls were failing so had to change to `chain.call()`.

### Run locally

Local demo:

```
export OPENAI_API_KEY=<your_key>
npx tsx run_notebook.ts
```

Web demo:
```
npm run dev
```

