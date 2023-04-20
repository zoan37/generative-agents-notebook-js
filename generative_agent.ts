import { TimeWeightedVectorStoreRetriever } from "./time_weighted_retriever";

// You will need to install the following dependencies:
// npm install @types/termcolor --save-dev
// npm install @types/datetime --save-dev
// npm install @types/pydantic --save-dev
// npm install @types/re --save-dev

/*
import { BaseModel, Field } from 'pydantic';
import { colored } from 'termcolor';
import { datetime, timedelta } from 'datetime';

import { LLMChain } from "langchain/chains";

import { ChatOpenAI } from './langchain/chat_models';
import { InMemoryDocstore } from './langchain/docstore';
import { OpenAIEmbeddings } from './langchain/embeddings';

import { PromptTemplate } from 'langchain/prompts';

import { BaseLanguageModel } from './langchain/schema';
import { FAISS } from './langchain/vectorstores';

import { DateTime } from 'luxon';
import { Document } from 'langchain/document';
import { VectorStore } from 'langchain/vectorstores/base';
*/


import { LLMChain } from "langchain/chains";

import { PromptTemplate } from 'langchain/prompts';

import { BaseLanguageModel } from 'langchain/base_language';

import { DateTime } from 'luxon';
import { Document } from 'langchain/document';

type List<T> = T[];
type Optional<T> = T | null;

interface GenerativeAgentConfig {
    arbitrary_types_allowed: boolean;
}

export class GenerativeAgent {
    name: string;
    age: number;
    traits: string;
    status: string;
    llm: BaseLanguageModel;
    memory_retriever: TimeWeightedVectorStoreRetriever;
    verbose: boolean = false;
    reflection_threshold: Optional<number> = null;
    current_plan: List<string> = [];
    summary: string = "";
    summary_refresh_seconds: number = 3600;
    last_refreshed: DateTime = DateTime.local();
    daily_summaries: List<string>;
    memory_importance: number = 0.0;
    max_tokens_limit: number = 1200;
    static Config: GenerativeAgentConfig = {
        arbitrary_types_allowed: true,
    };

    /*
        Constructor that is like this Python code:

        GenerativeAgent(name="Tommie", 
            age=25,
            traits="anxious, likes design", # You can add more persistent traits here 
            status="looking for a job", # When connected to a virtual world, we can have the characters update their status
            memory_retriever=create_new_memory_retriever(),
            llm=LLM,
            daily_summaries = [
                "Drove across state to move to a new town but doesn't have a job yet."
            ],
            reflection_threshold = 8, # we will give this a relatively low number to show how reflection works
            )

        but for TypeScript with kwargs.
    */
    constructor(kwargs: {
        name: string,
        age: number,
        traits: string,
        status: string,
        memory_retriever: TimeWeightedVectorStoreRetriever,
        llm: BaseLanguageModel,
        daily_summaries?: List<string>,
        reflection_threshold?: Optional<number>,
    }) {
        this.name = kwargs.name;
        this.age = kwargs.age;
        this.traits = kwargs.traits;
        this.status = kwargs.status;
        this.llm = kwargs.llm;
        this.memory_retriever = kwargs.memory_retriever;
        this.daily_summaries = kwargs.daily_summaries || [];
        this.reflection_threshold = kwargs.reflection_threshold || null;
    }

    /**
     * Parse a newline-separated string into a list of strings.
     */
    _parseList(text: string): string[] {
        const lines = text.split(/\r?\n/);
        return lines.map(line => line.trim().replace(/^\\s*\\d+\\.\\s*/, '').trim());
    }

    async _computeAgentSummary(): Promise<string> {
        const prompt1 = PromptTemplate.fromTemplate(
            "How would you summarize {name}'s core characteristics given the"
            + " following statements:\n"
            + "{related_memories}"
            + "Do not embellish."
            + "\n\nSummary: "
        );
        const prompt = new PromptTemplate({ template: "How would you summarize {name}'s core characteristics given the"
        + " following statements:\n"
        + "{related_memories}"
        + "Do not embellish."
        + "\n\nSummary: ", inputVariables: ["name", "related_memories"] });

        // The agent seeks to think about their core characteristics.
        const relevantMemories: Document[] = this.fetchMemories(`${this.name}'s core characteristics`);
        const relevantMemoriesStr: string = relevantMemories.map(mem => mem.pageContent).join('\n');
        const chain = new LLMChain({ llm: this.llm, prompt: prompt, verbose: this.verbose });

        console.log(this.name);
        console.log(relevantMemoriesStr);

        console.log('chain.call');
        console.log({ name: this.name, related_memories: relevantMemoriesStr });

        const value = await chain.call({ name: this.name, related_memories: relevantMemoriesStr });

        console.log(value);

        return value.text;
    }

    /**
     * Return the 3 most salient high-level questions about recent observations.
     */
    async _getTopicsOfReflection(last_k: number = 50): Promise<string[]> {
        const prompt = PromptTemplate.fromTemplate(
            "{observations}\n\n"
            + "Given only the information above, what are the 3 most salient"
            + " high-level questions we can answer about the subjects in the statements?"
            + " Provide each question on a new line.\n\n"
        );
        const reflection_chain = new LLMChain({ llm: this.llm, prompt: prompt, verbose: this.verbose });
        const observations = this.memory_retriever.memory_stream.slice(-last_k);
        const observation_str = observations.map(o => o.pageContent).join('\n');
        const result = await reflection_chain.run({ observations: observation_str });

        return this._parseList(result);
    }

    /**
     * Generate 'insights' on a topic of reflection, based on pertinent memories.
     */
    async _getInsightsOnTopic(topic: string): Promise<string[]> {
        const prompt = PromptTemplate.fromTemplate(
            "Statements about {topic}\n"
            + "{related_statements}\n\n"
            + "What 5 high-level insights can you infer from the above statements?"
            + " (example format: insight (because of 1, 5, 3))"
        );
        const related_memories = this.fetchMemories(topic);
        const related_statements = related_memories.map((memory, i) => `${i + 1}. ${memory.pageContent}`).join('\n');
        const reflection_chain = new LLMChain({ llm: this.llm, prompt: prompt, verbose: this.verbose });
        const result = await reflection_chain.run({ topic: topic, related_statements: related_statements });

        // TODO: Parse the connections between memories and insights
        return this._parseList(result);
    }

    /**
     * Reflect on recent observations and generate 'insights'.
     */
    async pauseToReflect(): Promise<string[]> {
        console.log(`Character ${this.name} is reflecting`);

        const new_insights: string[] = [];
        const topics = await this._getTopicsOfReflection();
        for (const topic of topics) {
            const insights = await this._getInsightsOnTopic(topic);
            for (const insight of insights) {
                this.addMemory(insight);
            }
            new_insights.push(...insights);
        }

        return new_insights;
    }

    /**
     * Score the absolute importance of the given memory.
     */
    async _scoreMemoryImportance(memory_content: string, weight: number = 0.15): Promise<number> {
        const prompt = PromptTemplate.fromTemplate(
            "On the scale of 1 to 10, where 1 is purely mundane"
            + " (e.g., brushing teeth, making bed) and 10 is"
            + " extremely poignant (e.g., a break up, college"
            + " acceptance), rate the likely poignancy of the"
            + " following piece of memory. Respond with a single integer."
            + "\nMemory: {memory_content}"
            + "\nRating: "
        );
        const chain = new LLMChain({ llm: this.llm, prompt: prompt, verbose: this.verbose });
        const score = (await chain.run({ memory_content: memory_content })).trim();
        const match = score.match(/^\D*(\d+)/);
        if (match) {
            return (parseFloat(score[0]) / 10) * weight;
        } else {
            return 0.0;
        }
    }

    // Note: For some reason, the VectorStore addDocuments method returns Promise<void>,
    // but the Python equivalent returns List[str].
    /**
     * Add an observation or memory to the agent's memory.
     */
    async addMemory(memory_content: string): Promise<void> {
        const importance_score = await this._scoreMemoryImportance(memory_content);
        this.memory_importance += importance_score;
        const document = new Document({ pageContent: memory_content, metadata: { importance: importance_score } });
        const result = await this.memory_retriever.addDocuments([document]);

        // After an agent has processed a certain amount of memories (as measured by
        // aggregate importance), it is time to reflect on recent events to add
        // more synthesized memories to the agent's memory stream.
        if (this.reflection_threshold !== null
            && this.memory_importance > this.reflection_threshold
            && this.status !== "Reflecting") {
            const old_status = this.status;
            this.status = "Reflecting";
            this.pauseToReflect();
            // Hack to clear the importance from reflection
            this.memory_importance = 0.0;
            this.status = old_status;
        }
        return result;
    }

    /**
     * Fetch related memories.
     */
    fetchMemories(observation: string): Document[] {
        return this.memory_retriever.getRelevantDocuments(observation);
    }

    /**
     * Return a descriptive summary of the agent.
     */
    async getSummary(force_refresh: boolean = false): Promise<string> {
        const current_time = DateTime.local();
        const since_refresh = (current_time.toMillis() - this.last_refreshed.toMillis()) * 1.0 / 1000;
        if (!this.summary || since_refresh >= this.summary_refresh_seconds || force_refresh) {
            this.summary = await this._computeAgentSummary();
            this.last_refreshed = current_time;
        }
        return (
            `Name: ${this.name} (age: ${this.age})`
            + `\nInnate traits: ${this.traits}`
            + `\n${this.summary}`
        );
    }

    /**
     * Return a full header of the agent's status, summary, and current time.
     */
    getFullHeader(force_refresh: boolean = false): string {
        const summary = this.getSummary(force_refresh);
        const current_time_str = new Date().toLocaleString("en-US", { month: "long", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
        return `${summary}\nIt is ${current_time_str}.\n${this.name}'s status: ${this.status}`;
    }

    async _getEntityFromObservation(observation: string): Promise<string> {
        const prompt = PromptTemplate.fromTemplate(
            "What is the observed entity in the following observation? {observation}"
            + "\nEntity="
        );
        const chain = new LLMChain({ llm: this.llm, prompt: prompt, verbose: this.verbose });
        return (await chain.run({ observation: observation })).trim();
    }

    async _getEntityAction(observation: string, entity_name: string): Promise<string> {
        const prompt = PromptTemplate.fromTemplate(
            "What is the {entity} doing in the following observation? {observation}"
            + "\nThe {entity} is"
        );
        const chain = new LLMChain({ llm: this.llm, prompt: prompt, verbose: this.verbose });
        return (await chain.run({ entity: entity_name, observation: observation })).trim();
    }

    async _formatMemoriesToSummarize(relevant_memories: Document[]): Promise<string> {
        const content_strs = new Set<string>();
        const content: string[] = [];
        for (const mem of relevant_memories) {
            if (content_strs.has(mem.pageContent)) {
                continue;
            }
            content_strs.add(mem.pageContent);
            const created_time = new Date(mem.metadata.created_at).toLocaleString("en-US", { month: "long", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
            content.push(`- ${created_time}: ${mem.pageContent.trim()}`);
        }
        return content.join("\n");
    }

    /**
     * Summarize memories that are most relevant to an observation.
     */
    async summarizeRelatedMemories(observation: string): Promise<string> {
        const entity_name = await this._getEntityFromObservation(observation);
        const entity_action = this._getEntityAction(observation, entity_name);
        // Fetch memories related to the agent's relationship with the entity
        const q1 = `What is the relationship between ${this.name} and ${entity_name}`;
        let relevant_memories = this.fetchMemories(q1);
        // Fetch things related to the entity-action pair
        const q2 = `${entity_name} is ${entity_action}`;
        relevant_memories = relevant_memories.concat(this.fetchMemories(q2));
        const context_str = await this._formatMemoriesToSummarize(relevant_memories);
        const prompt = PromptTemplate.fromTemplate(
            "{q1}?\nContext from memory:\n{context_str}\nRelevant context: "
        );
        const chain = new LLMChain({ llm: this.llm, prompt: prompt, verbose: this.verbose });
        return (await chain.run({ q1: q1, context_str: context_str.trim() })).trim();
    }

    /**
     * Reduce the number of tokens in the documents.
     */
    async _getMemoriesUntilLimit(consumed_tokens: number): Promise<string> {
        const result: string[] = [];
        for (const doc of this.memory_retriever.memory_stream.slice().reverse()) {
            if (consumed_tokens >= this.max_tokens_limit) {
                break;
            }
            consumed_tokens += await this.llm.getNumTokens(doc.pageContent);
            if (consumed_tokens < this.max_tokens_limit) {
                result.push(doc.pageContent);
            }
        }
        return result.reverse().join("; ");
    }

    /**
     * React to a given observation.
     */
    async _generateReaction(observation: string, suffix: string): Promise<string> {
        const prompt = PromptTemplate.fromTemplate(
            "{agent_summary_description}"
            + "\nIt is {current_time}."
            + "\n{agent_name}'s status: {agent_status}"
            + "\nSummary of relevant context from {agent_name}'s memory:"
            + "\n{relevant_memories}"
            + "\nMost recent observations: {recent_observations}"
            + "\nObservation: {observation}"
            + "\n\n" + suffix
        );
        const agent_summary_description = this.getSummary();
        const relevant_memories_str = this.summarizeRelatedMemories(observation);
        const current_time_str = new Date().toLocaleString("en-US", { month: "long", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
        const kwargs = {
            agent_summary_description: agent_summary_description,
            current_time: current_time_str,
            relevant_memories: relevant_memories_str,
            agent_name: this.name,
            observation: observation,
            agent_status: this.status
        };
        const consumed_tokens = await this.llm.getNumTokens(await prompt.format({ recent_observations: "", ...kwargs }));
        kwargs["recent_observations"] = this._getMemoriesUntilLimit(consumed_tokens);
        const action_prediction_chain = new LLMChain({ llm: this.llm, prompt: prompt });
        const result = await action_prediction_chain.run(kwargs);
        return result.trim();
    }

    async generateReaction(observation: string): Promise<[boolean, string]> {
        const call_to_action_template = (
            "Should {agent_name} react to the observation, and if so,"
            + " what would be an appropriate reaction? Respond in one line."
            + ' If the action is to engage in dialogue, write:\nSAY: "what to say"'
            + "\notherwise, write:\nREACT: {agent_name}'s reaction (if anything)."
            + "\nEither do nothing, react, or say something but not both.\n\n"
        );
        const full_result = await this._generateReaction(observation, call_to_action_template);
        const result = full_result.trim().split('\n')[0];
        this.addMemory(`${this.name} observed ${observation} and reacted by ${result}`);
        if (result.includes("REACT:")) {
            const reaction = result.split("REACT:").pop().trim();
            return [false, `${this.name} ${reaction}`];
        }
        if (result.includes("SAY:")) {
            const said_value = result.split("SAY:").pop().trim();
            return [true, `${this.name} said ${said_value}`];
        } else {
            return [false, result];
        }
    }

    async generateDialogueResponse(observation: string): Promise<[boolean, string]> {
        const call_to_action_template = (
            'What would {agent_name} say? To end the conversation, write: GOODBYE: "what to say". Otherwise to continue the conversation, write: SAY: "what to say next"\n\n'
        );
        const full_result = await this._generateReaction(observation, call_to_action_template);
        const result = full_result.trim().split('\n')[0];
        if (result.includes("GOODBYE:")) {
            const farewell = result.split("GOODBYE:").pop().trim();
            this.addMemory(`${this.name} observed ${observation} and said ${farewell}`);
            return [false, `${this.name} said ${farewell}`];
        }
        if (result.includes("SAY:")) {
            const response_text = result.split("SAY:").pop().trim();
            this.addMemory(`${this.name} observed ${observation} and said ${response_text}`);
            return [true, `${this.name} said ${response_text}`];
        } else {
            return [false, result];
        }
    }
}
