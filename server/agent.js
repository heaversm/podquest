import { OpenAI } from 'langchain/llms';
import { initializeAgentExecutorWithOptions } from 'langchain/agents';
import { SerpAPI } from 'langchain/tools';

const tools = [new SerpAPI(process.env.SERP_API_KEY)];

const llm = new OpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  temperature: 0.9,
});
// const tools = loadTools(['serpapi'], { llm });
const agent = await initializeAgentExecutorWithOptions(tools, llm, {
  agentType: 'zero-shot-react-description',
  verbose: true,
});

agent.run('which club is Cristiano Ronaldo playing right now?');
