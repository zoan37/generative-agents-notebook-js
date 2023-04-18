import { ChatOpenAI } from "langchain/chat_models/openai";
import { HumanChatMessage, SystemChatMessage } from "langchain/schema";
import { TimeWeightedVectorStoreRetriever } from "./time_weighted_retriever";

const USER_NAME = "Person A" // The name you want to use when interviewing the agent.

const LLM = new ChatOpenAI({ 
   maxTokens: 1500
});


class GenerativeAgent {
  constructor({
    name,
    age,
    traits,
    status,
    llm,
    memory_retriever,
    verbose = false,
    reflection_threshold = null,
    current_plan = [],
    summary = '',
    summary_refresh_seconds = 3600,
    last_refreshed = Date.now(),
    daily_summaries = [],
    memory_importance = 0.0,
    max_tokens_limit = 1200,
  }) {
    this.name = name;
    this.age = age;
    this.traits = traits;
    this.status = status;
    this.llm = llm;
    this.memory_retriever = memory_retriever;
    this.verbose = verbose;
    this.reflection_threshold = reflection_threshold;
    this.current_plan = current_plan;
    this.summary = summary;
    this.summary_refresh_seconds = summary_refresh_seconds;
    this.last_refreshed = last_refreshed;
    this.daily_summaries = daily_summaries;
    this.memory_importance = memory_importance;
    this.max_tokens_limit = max_tokens_limit;
  }

  static _parse_list(text) {
    const lines = re.split(r'\n', text.trim());
    return lines.map((line) => re.sub(r'^\s*\d+\.\s*', '', line).trim());
  }

  async _compute_agent_summary() {
    const prompt = PromptTemplate.from_template(
      "How would you summarize {name}'s core characteristics given the"
      + " following statements:\n"
      + "{related_memories}"
      + "Do not embellish."
      + "\n\nSummary: "
    );
    const relevant_memories = await this.fetch_memories(`${this.name}'s core characteristics`);
    const relevant_memories_str = relevant_memories.map((mem) => mem.page_content).join('\n');
    const chain = new LLMChain({ llm: this.llm, prompt, verbose: this.verbose });
    return (await chain.run({ name: this.name, related_memories: relevant_memories_str })).trim();
  }

  async _get_topics_of_reflection(last_k = 50) {
    const prompt = PromptTemplate.from_template(
      "{observations}\n\n"
      + "Given only the information above, what are the 3 most salient"
      + " high-level questions we can answer about the subjects in the statements?"
      + " Provide each question on a new line.\n\n"
    );
    const reflection_chain = new LLMChain({ llm: this.llm, prompt, verbose: this.verbose });
    const observations = this.memory_retriever.memory_stream.slice(-last_k);
    const observation_str = observations.map((o) => o.page_content).join('\n');
    const result = await reflection_chain.run({ observations: observation_str });
    return this.constructor._parse_list(result);
  }

  async _get_insights_on_topic(topic) {
    const prompt = PromptTemplate.from_template(
      "Statements about {topic}\n"
      + "{related_statements}\n\n"
      + "What 5 high-level insights can you infer from the above statements?"
      + " (example format:
