import { TimeWeightedVectorStoreRetriever } from "./time_weighted_retriever";

// You will need to install the following dependencies:
// npm install @types/termcolor --save-dev
// npm install @types/datetime --save-dev
// npm install @types/pydantic --save-dev
// npm install @types/re --save-dev

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

type List<T> = T[];
type Optional<T> = T | null;
type Tuple<T extends any[]> = T;

interface GenerativeAgentConfig {
    arbitrary_types_allowed: boolean;
}

export class GenerativeAgent extends BaseModel {
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

    /**
     * Parse a newline-separated string into a list of strings.
     */
    _parseList(text: string): string[] {
        const lines = text.split(/\r?\n/);
        return lines.map(line => line.trim().replace(/^\\s*\\d+\\.\\s*/, '').trim());
    }

    _computeAgentSummary(): string {
        const prompt = PromptTemplate.fromTemplate(
            "How would you summarize {name}'s core characteristics given the"
            + " following statements:\n"
            + "{related_memories}"
            + "Do not embellish."
            + "\n\nSummary: "
        );

        // The agent seeks to think about their core characteristics.
        const relevantMemories: Memory[] = this.fetchMemories(`${this.name}'s core characteristics`);
        const relevantMemoriesStr: string = relevantMemories.map(mem => mem.pageContent).join('\n');
        const chain = new LLMChain({ llm: this.llm, prompt: prompt, verbose: this.verbose });

        return (await chain.run({ name: this.name, related_memories: relevantMemoriesStr })).trim();
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
}
