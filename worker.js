mkdir -p src

cat > src/index.js <<'EOF'
export default {
  async fetch(request, env) {
    return new Response(
      env.OPENAI_API_KEY ? "AI Photo Studio Worker running - key loaded" : "AI Photo Studio Worker running - missing key"
    );
  }
};
EOF
