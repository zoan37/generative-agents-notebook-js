import { BaseLanguageModel } from 'langchain/base_language';
import { LLMResult } from 'langchain/dist/schema';
import { BaseLLM } from 'langchain/llms/base';
import { getWindowAI } from 'window.ai';

export class WindowAILLM extends BaseLLM {
    async _generate(prompts: string[], stop?: string[] | undefined): Promise<LLMResult> {
        const ai = await getWindowAI();

        // TODO: Not sure if prompts is meant to be processed in separate calls or in a single 
        // call. For now, we'll assume it's a single call.
        const messages = prompts.map((prompt) => ({
            role: "user",
            content: prompt,
        }));

        const response = await ai.getCompletion({
            messages: messages,
        }, {
            // temperature: 0,
        });

        const result = {
            generations: [
                [
                    {
                        text: response.message.content,
                    },
                ],
            ],
        };

        return result;
    }

    _llmType(): string {
        return 'window.ai';
    }
}