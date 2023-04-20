import { BaseLanguageModel } from 'langchain/base_language';
import { LLMResult } from 'langchain/dist/schema';
import { BaseLLM } from 'langchain/llms/base';

export class WindowAILLM extends BaseLLM {
    async _generate(prompts: string[], stop?: string[] | undefined): Promise<LLMResult> {
        // TODO: Import window.ai npm package (currently it's causing issues with Vite, need to debug)
        // @ts-ignore
        const ai = window.ai;

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