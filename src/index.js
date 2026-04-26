export default {
  async fetch(request, env) {
    return new Response(env.OPENAI_API_KEY ? "OpenAI key loaded" : "Missing OpenAI key");
  }
};
