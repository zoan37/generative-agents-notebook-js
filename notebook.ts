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
    /**
     * Create a Generative Character
     */

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

    /**
     * Pre-Interview with Character
     */

    async function interviewAgent(agent: GenerativeAgent, message: string): Promise<[boolean, string]> {
        // Help the notebook user interact with the agent.
        const newMessage = `${USER_NAME} says ${message}`;
        return agent.generateDialogueResponse(newMessage);
    }

    console.log('Interview agent result:');
    console.log(await interviewAgent(tommie, "What do you like to do?"));

    console.log('Interview agent result:');
    console.log(await interviewAgent(tommie, "What are you looking forward to doing today?"));

    console.log('Interview agent result:');
    console.log(await interviewAgent(tommie, "What are you most worried about today?"));

    /**
     * Step through the day’s observations.
     */

    // Let's have Tommie start going through a day in the life.
    const observations: string[] = [
        "Tommie wakes up to the sound of a noisy construction site outside his window.",
        "Tommie gets out of bed and heads to the kitchen to make himself some coffee.",
        "Tommie realizes he forgot to buy coffee filters and starts rummaging through his moving boxes to find some.",
        "Tommie finally finds the filters and makes himself a cup of coffee.",
        "The coffee tastes bitter, and Tommie regrets not buying a better brand.",
        "Tommie checks his email and sees that he has no job offers yet.",
        "Tommie spends some time updating his resume and cover letter.",
        "Tommie heads out to explore the city and look for job openings.",
        "Tommie sees a sign for a job fair and decides to attend.",
        "The line to get in is long, and Tommie has to wait for an hour.",
        "Tommie meets several potential employers at the job fair but doesn't receive any offers.",
        "Tommie leaves the job fair feeling disappointed.",
        "Tommie stops by a local diner to grab some lunch.",
        "The service is slow, and Tommie has to wait for 30 minutes to get his food.",
        "Tommie overhears a conversation at the next table about a job opening.",
        "Tommie asks the diners about the job opening and gets some information about the company.",
        "Tommie decides to apply for the job and sends his resume and cover letter.",
        "Tommie continues his search for job openings and drops off his resume at several local businesses.",
        "Tommie takes a break from his job search to go for a walk in a nearby park.",
        "A dog approaches and licks Tommie's feet, and he pets it for a few minutes.",
        "Tommie sees a group of people playing frisbee and decides to join in.",
        "Tommie has fun playing frisbee but gets hit in the face with the frisbee and hurts his nose.",
        "Tommie goes back to his apartment to rest for a bit.",
        "A raccoon tore open the trash bag outside his apartment, and the garbage is all over the floor.",
        "Tommie starts to feel frustrated with his job search.",
        "Tommie calls his best friend to vent about his struggles.",
        "Tommie's friend offers some words of encouragement and tells him to keep trying.",
        "Tommie feels slightly better after talking to his friend.",
    ];

    // Let's send Tommie on their way. We'll check in on their summary every few observations to watch it evolve
    for (let i = 0; i < observations.length; i++) {
        const observation = observations[i];
        const [, reaction] = await tommie.generateReaction(observation);

        // Replace with your preferred method for colored console output if needed
        console.log('OBSERVATION:');
        console.log(observation);
        console.log('REACTION:');
        console.log(reaction);

        if ((i + 1) % 20 === 0) {
            console.log('*'.repeat(40));
            console.log(`After ${i + 1} observations, Tommie's summary is:\n${tommie.getSummary(true)}`); // Replace with your preferred method for colored console output if needed
            console.log('*'.repeat(40));
        }
    }
}

run();