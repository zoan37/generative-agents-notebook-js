import { TimeWeightedVectorStoreRetriever } from "./time_weighted_retriever";
import { ChatOpenAI } from 'langchain/chat_models/openai'
import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import { InMemoryDocstore, Document } from "langchain/docstore";
import { GenerativeAgent } from './generative_agent';
import { BaseLanguageModel } from 'langchain/base_language';

// TODO: use this function
function relevanceScoreFn(score: number): number {
    // This function converts the euclidean norm of normalized embeddings
    // (0 is most similar, sqrt(2) most dissimilar)
    // to a similarity function (0 to 1)
    return 1.0 - score / Math.sqrt(2);
}

export async function runNotebook(config: { log: any; llm: BaseLanguageModel; createNewMemoryRetriever: () => Promise<TimeWeightedVectorStoreRetriever>; }) {
    const log = config.log || console.log;

    const USER_NAME = "Person A" // The name you want to use when interviewing the agent.

    const LLM = config.llm;
    const createNewMemoryRetriever = config.createNewMemoryRetriever;

    function printTitle(title: string) {
        log('\n' + '='.repeat(title.length));
        log(title);
        log('='.repeat(title.length) + '\n');
    }

    async function printInterview(agent: GenerativeAgent, question: string) {
        log('QUESTION:');
        log(question);
        log('ANSWER:');

        try {
            log((await interviewAgent(agent, question))[1] + '\n');
        } catch (err) {
            console.error(err);
        }
    }

    /** 
     * Start of notebook
     */
    log('--- Start of notebook ---\n')

    /**
     * Create a Generative Character
     */
    printTitle('Create a Generative Character')

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
    log('\nSummary:')
    log(await tommie.getSummary());

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
        log('Adding memory:', memory);
        await tommie.addMemory(memory);
    }

    // Now that Tommie has 'memories', their self-summary is more descriptive, though still rudimentary.
    // We will see how this summary updates after more observations to create a more rich description.
    log('\nSummary:')
    log(await tommie.getSummary(true));

    /**
     * Pre-Interview with Character
     */
    printTitle('Pre-Interview with Character')

    async function interviewAgent(agent: GenerativeAgent, message: string): Promise<[boolean, string]> {
        // Help the notebook user interact with the agent.
        const newMessage = `${USER_NAME} says ${message}`;
        return agent.generateDialogueResponse(newMessage);
    }

    await printInterview(tommie, "What do you like to do?");

    await printInterview(tommie, "What are you looking forward to doing today?");

    await printInterview(tommie, "What are you most worried about today?");

    /**
     * Step through the day's observations.
     */
    printTitle("Step through the day's observations")

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
        log('OBSERVATION:');
        log(observation);
        log('REACTION:');
        log(reaction);

        if ((i + 1) % 20 === 0) {
            const summary = await tommie.getSummary(true);
            log('*'.repeat(40));
            log(`After ${i + 1} observations, Tommie's summary is:\n${summary}`); // Replace with your preferred method for colored console output if needed
            log('*'.repeat(40));
        }
    }

    /**
     * Interview after the day
     */
    printTitle('Interview after the day')

    await printInterview(tommie, "Tell me about how your day has been going");

    await printInterview(tommie, "How do you feel about coffee?");

    await printInterview(tommie, "Tell me about your childhood dog!");

    /**
     * Adding Multiple Characters
     */
    printTitle('Adding Multiple Characters')

    const eve = new GenerativeAgent({
        name: "Eve",
        age: 34,
        traits: "curious, helpful", // You can add more persistent traits here 
        status: "N/A", // When connected to a virtual world, we can have the characters update their status
        memory_retriever: await createNewMemoryRetriever(),
        llm: LLM,
        daily_summaries: [
            "Eve started her new job as a career counselor last week and received her first assignment, a client named Tommie."
        ],
        reflection_threshold: 5,
    });

    // Note: yesterday is unused in the Python notebook for some reason; including code here anyway
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    const eveMemories = [
        "Eve overhears her colleague say something about a new client being hard to work with",
        "Eve wakes up and hear's the alarm",
        "Eve eats a bowl of porridge",
        "Eve helps a coworker on a task",
        "Eve plays tennis with her friend Xu before going to work",
        "Eve overhears her colleague say something about Tommie being hard to work with",
    ];

    for (const memory of eveMemories) {
        await eve.addMemory(memory);
    }

    log('\nSummary:');
    log(await eve.getSummary());

    /**
     * Pre-conversation interviews
     */
    printTitle('Pre-conversation interviews')

    await printInterview(eve, "How are you feeling about today?");

    await printInterview(eve, "What do you know about Tommie?");

    await printInterview(eve, "Tommie is looking to find a job. What are are some things you'd like to ask him?");

    await printInterview(eve, "You'll have to ask him. He may be a bit anxious, so I'd appreciate it if you keep the conversation going and ask as many questions as possible.");

    /**
     * Dialogue between Generative Agents
     */
    printTitle('Dialogue between Generative Agents')

    async function runConversation(agents: GenerativeAgent[], initialObservation: string): Promise<void> {
        // Runs a conversation between agents
        let [, observation] = await agents[1].generateReaction(initialObservation);
        log(observation);
        let turns = 0;
        while (true) {
            let breakDialogue = false;
            for (const agent of agents) {
                const [stayInDialogue, newObservation] = await agent.generateDialogueResponse(observation);
                log(newObservation);
                observation = newObservation;
                if (!stayInDialogue) {
                    breakDialogue = true;
                }
            }
            if (breakDialogue) {
                break;
            }
            turns += 1;
        }
    }

    const agents = [tommie, eve]; // Assuming you have the tommie and eve instances available
    await runConversation(agents, "Tommie said: Hi, Eve. Thanks for agreeing to share your story with me and give me advice. I have a bunch of questions.");

    /**
     * Let’s interview our agents after their conversation
     */
    printTitle('Let’s interview our agents after their conversation')

    log('\nSummary:')
    log(await tommie.getSummary(true));

    log('\nSummary:')
    log(await eve.getSummary(true));

    await printInterview(tommie, "How was your conversation with Eve?");
    await printInterview(eve, "How was your conversation with Tommie?");
    await printInterview(eve, "What do you wish you would have said to Tommie?");
    await printInterview(tommie, "What happened with your coffee this morning?");

    /** 
     * End of notebook
     */
    log('\n--- End of notebook ---')
}
