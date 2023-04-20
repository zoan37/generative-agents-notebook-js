import { FaissStore } from "./faiss";
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { TimeWeightedVectorStoreRetriever } from "./src/time_weighted_retriever";
import { InMemoryDocstore, Document } from "langchain/docstore";

export function getLocalConfig() {
    const log = console.log;
    const LLM = new ChatOpenAI({
        maxTokens: 1500
    });

    async function createNewMemoryRetriever(): Promise<TimeWeightedVectorStoreRetriever> {
        // Define your embedding model
        const embeddingsModel = new OpenAIEmbeddings();
        // Initialize the vectorstore as empty
        const embeddingSize = 1536;

        const { IndexFlatL2 } = await FaissStore.imports();
        const index = new IndexFlatL2(embeddingSize);

        // log('index.getDimension()', index.getDimension());

        // TODO: the FaissStore implementation does not support injecting relevanceScoreFn yet
        // Note: MemoryVectorStore would also function instead of FaissStore.
        // I don't understand the difference in functionality between the two yet.
        const vectorstore = new FaissStore(embeddingsModel, {
            index: index,
            docstore: new InMemoryDocstore()
        });

        return new TimeWeightedVectorStoreRetriever({ vectorstore: vectorstore, otherScoreKeys: ["importance"], k: 15 });
    }

    return {
        log: log,
        llm: LLM,
        createNewMemoryRetriever: createNewMemoryRetriever
    }
}