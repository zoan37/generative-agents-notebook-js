import { TimeWeightedVectorStoreRetriever } from "./time_weighted_retriever";
import { ChatOpenAI } from 'langchain/chat_models/openai'
import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import { InMemoryDocstore, Document } from "langchain/docstore";
// const { IndexFlatL2 } = require('faiss-node');
import { FaissStore } from "./faiss";

import { GenerativeAgent } from './generative_agent'

const USER_NAME = "Person A" // The name you want to use when interviewing the agent.
const LLM = new ChatOpenAI({
    maxTokens: 1500
}) // Can be any LLM you want.

// TODO: use this function
function relevanceScoreFn(score: number): number {
    // This function converts the euclidean norm of normalized embeddings
    // (0 is most similar, sqrt(2) most dissimilar)
    // to a similarity function (0 to 1)
    return 1.0 - score / Math.sqrt(2);
}

async function createNewMemoryRetriever(): Promise<TimeWeightedVectorStoreRetriever> {
    // Define your embedding model
    const embeddingsModel = new OpenAIEmbeddings();
    // Initialize the vectorstore as empty
    const embeddingSize = 1536;

    const { IndexFlatL2 } = await FaissStore.imports();
    const index = new IndexFlatL2(embeddingSize);

    console.log('index.getDimension()', index.getDimension());

    const vectorstore = new FaissStore(embeddingsModel, {
        index: index,
        docstore: new InMemoryDocstore()
    });
    return new TimeWeightedVectorStoreRetriever({ vectorstore: vectorstore, otherScoreKeys: ["importance"], k: 15 });
}

async function run() {
    const tommie = new GenerativeAgent({
        name: "Tommie",
        age: 25,
        traits: "anxious, likes design", // You can add more persistent traits here 
        status: "looking for a job", // When connected to a virtual world, we can have the characters update their status
        memory_retriever: await createNewMemoryRetriever(),
        llm: LLM,
        daily_summaries: [
            "Drove across state to move to a new town but doesn't have a job yet."
        ],
        reflection_threshold: 8, // we will give this a relatively low number to show how reflection works
    });

    // The current "Summary" of a character can't be made because the agent hasn't made
    // any observations yet.
    console.log(await tommie.getSummary());

    // We can give the character memories directly
    const tommieMemories: string[] = [
        "Tommie remembers his dog, Bruno, from when he was a kid",
        "Tommie feels tired from driving so far",
        "Tommie sees the new home",
        "The new neighbors have a cat",
        "The road is noisy at night",
        "Tommie is hungry",
        "Tommie tries to get some rest.",
    ];

    for (const memory of tommieMemories) {
        console.log('Adding memory:', memory);
        await tommie.addMemory(memory);
    }

    // Now that Tommie has 'memories', their self-summary is more descriptive, though still rudimentary.
    // We will see how this summary updates after more observations to create a more rich description.
    console.log(await tommie.getSummary(true));
}

run();