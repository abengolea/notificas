export type CrmLlmTool = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type CrmLlmFunctionCall = {
  call_id: string;
  name: string;
  arguments: unknown;
};

export type CrmLlmContent =
  | { role: "user" | "model"; text: string }
  | { role: "model"; functionCalls: CrmLlmFunctionCall[] }
  | { role: "user"; functionResponses: Array<{ call_id: string; name: string; result: unknown }> };

export type CrmLlmTurn = {
  text: string;
  functionCalls: CrmLlmFunctionCall[];
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
};

export type CrmLlmPort = {
  generate(input: {
    model: string;
    system: string;
    contents: CrmLlmContent[];
    tools: CrmLlmTool[];
  }): Promise<CrmLlmTurn>;
};
