
import { TimeWeightedVectorStoreRetriever } from "./time_weighted_retriever";
import { InMemoryDocstore, Document } from "langchain/docstore";
import { WindowAILLM } from './window_ai_llm';
import { FakeEmbeddings } from 'langchain/embeddings/fake';
import { MemoryVectorStore } from 'langchain/vectorstores/memory';

export function getWebConfig() {
    const log = console.log;
    const LLM = new WindowAILLM({});

    async function createNewMemoryRetriever(): Promise<TimeWeightedVectorStoreRetriever> {
        // TODO: change to use real embeddings when window.ai supports embedding models
        const embeddingsModel = new FakeEmbeddings();

        // Ran into errors when using FAISS in browser (perhaps C++ build not working for browser).
        // So using MemoryVectorStore instead.
        const vectorstore = new MemoryVectorStore(embeddingsModel);

        return new TimeWeightedVectorStoreRetriever({ vectorstore: vectorstore, otherScoreKeys: ["importance"], k: 15 });
    }

    return {
        log: log,
        llm: LLM,
        createNewMemoryRetriever: createNewMemoryRetriever
    }
}