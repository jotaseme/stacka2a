#!/usr/bin/env python3
"""
Enrich A2A agent JSON files with inferred language, category, and framework.

Conservative approach: only updates fields when there's strong signal from
multiple sources (tags, name, description, repository URL, framework).
"""

import json
import glob
import os
import re
from collections import Counter
from pathlib import Path

AGENTS_DIR = Path(__file__).parent.parent / "src" / "data" / "agents"

# ============================================================
# Language inference
# ============================================================

# Framework → language mapping (strong signal)
FRAMEWORK_TO_LANGUAGE = {
    "google-adk": "python",
    "langgraph": "python",
    "langchain": "python",
    "crewai": "python",
    "autogen": "python",
    "llamaindex": "python",
    "fastapi": "python",
    "semantic-kernel": "csharp",
    "spring-boot": "java",
    "nestjs": "typescript",
    "genkit": "typescript",
    "openai-agents": "python",
    "pydantic-ai": "python",
    "strands-agents": "python",
}

# Tags that directly indicate language (exact match)
TAG_TO_LANGUAGE = {
    "python": "python",
    "python3": "python",
    "python-sdk": "python",
    "adk-python": "python",
    "flask": "python",
    "django": "python",
    "fastapi": "python",
    "typescript": "typescript",
    "ts": "typescript",
    "javascript": "typescript",
    "js": "typescript",
    "nodejs": "typescript",
    "node": "typescript",
    "nextjs": "typescript",
    "nestjs": "typescript",
    "deno": "typescript",
    "java": "java",
    "java-sdk": "java",
    "spring": "java",
    "spring-boot": "java",
    "springboot": "java",
    "springboot3": "java",
    "springframework": "java",
    "spring-ai": "java",
    "a2a4j": "java",
    "wildfly": "java",
    "go": "go",
    "golang": "go",
    "go-sdk": "go",
    "rust": "rust",
    "rust-sdk": "rust",
    "csharp": "csharp",
    "c-sharp": "csharp",
    "dotnet": "csharp",
    ".net": "csharp",
    "aspnet": "csharp",
    "kotlin": "kotlin",
    "kotlin-sdk": "kotlin",
    "php": "php",
    "php-sdk": "php",
    "sdk-php": "php",
    "ruby": "ruby",
    "ruby-gem": "ruby",
    "rubygem": "ruby",
    "swift": "swift",
    "elixir": "elixir",
    "dart": "dart",
    "flutter": "dart",
    "zig": "zig",
    "adk-zig": "zig",
    "lua": "lua",
    # Python ecosystem tags
    "pydantic-ai": "python",
    "pydantic": "python",
    "modal": "python",
    "uvicorn": "python",
    "pip": "python",
    "poetry": "python",
    "uv": "python",
    # TypeScript/JS ecosystem tags
    "react": "typescript",
    "reactjs": "typescript",
    "vue": "typescript",
    "vite": "typescript",
    "bun": "typescript",
    "npm": "typescript",
    "vercel": "typescript",
    "vercel-ai-sdk": "typescript",
    "ai-sdk": "typescript",
    # Rust variants
    "rust-lang": "rust",
    # Go variants
    "go-lang": "go",
    # .NET / C# variants
    "asp-net-core": "csharp",
    "asp.net": "csharp",
    "blazor": "csharp",
}

# Patterns in repo URL / slug / name that indicate language
NAME_SLUG_LANGUAGE_PATTERNS = [
    (r'\bpython\b', "python"),
    (r'\b(?:typescript|ts)\b', "typescript"),
    (r'\bjava\b', "java"),
    (r'\bgolang\b', "go"),
    (r'\brust\b', "rust"),
    (r'\bcsharp\b', "csharp"),
    (r'\bkotlin\b', "kotlin"),
    (r'\bphp\b', "php"),
    (r'\bruby\b', "ruby"),
    (r'\bswift\b', "swift"),
    (r'\belixir\b', "elixir"),
    (r'\bdart\b', "dart"),
    (r'\bflutter\b', "dart"),
    (r'\bzig\b', "zig"),
]

# Repo URL suffix patterns (e.g. "a2a-go", "a2a-ruby")
REPO_SUFFIX_LANGUAGE = {
    "-go": "go",
    "-python": "python",
    "-py": "python",
    "-java": "java",
    "-ts": "typescript",
    "-typescript": "typescript",
    "-js": "typescript",
    "-rust": "rust",
    "-rs": "rust",
    "-csharp": "csharp",
    "-dotnet": "csharp",
    "-kotlin": "kotlin",
    "-php": "php",
    "-ruby": "ruby",
    "-rb": "ruby",
    "-swift": "swift",
    "-elixir": "elixir",
    "-dart": "dart",
    "-zig": "zig",
    "-lua": "lua",
}

# Description keywords for language (need word boundary matching)
DESC_LANGUAGE_PATTERNS = [
    (r'\bPython\b', "python"),
    (r'\bTypeScript\b', "typescript"),
    (r'\bJavaScript\b', "typescript"),
    (r'\bNode\.js\b', "typescript"),
    (r'\bJava\b(?!\s*Script)', "java"),
    (r'\bGo(?:lang)?\s+(?:implementation|sdk|library|client|server|agent)\b', "go"),
    (r'\bwritten in Go\b', "go"),
    (r'\bGo\s+implementation\b', "go"),
    (r'\bGolang\b', "go"),
    (r'\bRust\b', "rust"),
    (r'\bC#\b', "csharp"),
    (r'\.NET\b', "csharp"),
    (r'\bKotlin\b', "kotlin"),
    (r'\bPHP\b', "php"),
    (r'\bRuby\b', "ruby"),
    (r'\bSwift\b', "swift"),
    (r'\bElixir\b', "elixir"),
    (r'\bDart\b', "dart"),
    (r'\bFlutter\b', "dart"),
    (r'\bZig\b', "zig"),
]

# SDKs field as weak signal (only if single SDK listed and consistent)
SDK_TO_LANGUAGE = {
    "python": "python",
    "typescript": "typescript",
    "java": "java",
    "go": "go",
    "rust": "rust",
    "csharp": "csharp",
    "kotlin": "kotlin",
}


def infer_language(agent: dict) -> str | None:
    """Infer language from available signals. Returns None if not confident."""
    candidates = Counter()

    # 1. Framework mapping (strong signal, weight=3)
    fw = agent.get("framework", "")
    if fw in FRAMEWORK_TO_LANGUAGE:
        candidates[FRAMEWORK_TO_LANGUAGE[fw]] += 3

    # 2. Tags (strong signal, weight=3)
    for tag in agent.get("tags", []):
        tag_lower = tag.lower()
        if tag_lower in TAG_TO_LANGUAGE:
            candidates[TAG_TO_LANGUAGE[tag_lower]] += 3

    # 3. Repo URL suffix (strong signal, weight=3)
    repo = agent.get("repository", "")
    if repo:
        # Get the repo name (last path component, ignoring tree/main/... paths)
        repo_name = repo.rstrip("/").split("/")
        # Find the actual repo name (typically index 4 in github URLs)
        if "github.com" in repo and len(repo_name) >= 5:
            actual_repo = repo_name[4].lower()
            for suffix, lang in REPO_SUFFIX_LANGUAGE.items():
                if actual_repo.endswith(suffix):
                    candidates[lang] += 3

    # 4. Slug / name patterns (medium signal, weight=2)
    slug = agent.get("slug", "")
    name = agent.get("name", "")
    combined = f"{slug} {name}".lower()
    for pattern, lang in NAME_SLUG_LANGUAGE_PATTERNS:
        if re.search(pattern, combined):
            candidates[lang] += 2

    # 5. Description patterns (medium signal, weight=2)
    desc = agent.get("description", "")
    for pattern, lang in DESC_LANGUAGE_PATTERNS:
        if re.search(pattern, desc):
            candidates[lang] += 2

    # 6. Official sample description pattern (strong signal)
    if desc.startswith("Official A2A"):
        m = re.search(r'Official A2A (\w+) sample', desc)
        if m:
            sample_lang = m.group(1).lower()
            if sample_lang in ("python", "java", "typescript", "go", "rust", "csharp", "kotlin"):
                candidates[sample_lang] += 5

    # 7. SDKs field as weak tiebreaker (weight=1, only if single SDK)
    sdks = agent.get("sdks", [])
    if len(sdks) == 1 and sdks[0] in SDK_TO_LANGUAGE:
        candidates[SDK_TO_LANGUAGE[sdks[0]]] += 1

    if not candidates:
        return None

    # Need minimum confidence score of 2 (at least one medium signal)
    top = candidates.most_common(1)[0]
    if top[1] < 2:
        return None

    # If there's a tie at the top with very different languages, don't guess
    top2 = candidates.most_common(2)
    if len(top2) == 2 and top2[0][1] == top2[1][1]:
        return None

    return top[0]


# ============================================================
# Category inference
# ============================================================

# Valid categories from the existing data
VALID_CATEGORIES = {
    "orchestration", "enterprise", "code-generation", "search",
    "data-analytics", "conversational", "infrastructure", "utility",
    "finance", "security", "media-content", "travel",
    # Additional categories we can infer
    "multi-agent",
}

# Tag-based category mapping (check if ANY of these tags present)
TAG_CATEGORY_RULES = [
    # (set of tags to match, category, minimum matches needed)
    ({"business", "commerce"}, "enterprise", 1),
    ({"finance", "fintech", "banking", "payment", "payments", "trading", "crypto", "blockchain", "defi", "escrow"}, "finance", 1),
    ({"search", "retrieval", "rag", "web-search", "google-search", "semantic-search"}, "search", 1),
    ({"security", "authentication", "auth", "agent-security", "cybersecurity", "vulnerability"}, "security", 1),
    ({"devops", "docker", "kubernetes", "k8s", "infrastructure", "cloud", "aws", "gcp", "azure", "deployment", "ci-cd"}, "infrastructure", 1),
    ({"image", "video", "audio", "media", "image-generation", "text-to-image", "text-to-speech", "tts"}, "media-content", 1),
    ({"code", "code-generation", "coding", "code-review", "code-assistant", "github-copilot"}, "code-generation", 1),
    ({"data", "data-analysis", "analytics", "data-analytics", "data-science", "dataset", "visualization"}, "data-analytics", 1),
    ({"chat", "chatbot", "conversational", "conversation", "dialog", "dialogue"}, "conversational", 1),
    ({"travel", "flight", "hotel", "booking", "tourism", "trip"}, "travel", 1),
    ({"multi-agent", "multi-agent-systems", "agent-orchestration", "orchestration", "agent-collaboration"}, "orchestration", 1),
    ({"cli", "tool", "utility", "sdk", "library", "framework", "template", "boilerplate", "starter"}, "utility", 1),
    ({"protocol", "a2a-protocol", "agent-protocol", "agent2agent", "agent-to-agent", "llm-protocol", "m2m-protocol", "agentic-framework"}, "utility", 1),
    ({"mqtt", "amqp", "grpc", "json-rpc", "websocket"}, "infrastructure", 1),
    ({"demo", "example", "hello-world", "sample", "tutorial", "learning", "starter", "scaffold"}, "utility", 1),
    ({"browser", "browser-automation", "web-testing", "playwright", "selenium", "puppeteer"}, "infrastructure", 1),
    ({"registry", "discovery", "agent-registry", "agent-discovery", "a2a-discovery", "agent-marketplace"}, "infrastructure", 1),
    ({"gateway", "proxy", "middleware", "router", "routing"}, "infrastructure", 1),
    ({"agent-platform", "aiops", "governance", "guardrails"}, "infrastructure", 1),
    ({"mcp-server", "mcp-client"}, "infrastructure", 1),
    ({"ranking-system", "ranking-algorithm"}, "infrastructure", 1),
    ({"feature-pack", "wrapper", "adapter"}, "utility", 1),
    ({"legal", "legal-ai", "legal-tech", "contract"}, "enterprise", 1),
    ({"manufacturing", "machinery"}, "enterprise", 1),
    ({"healthcare", "medical"}, "enterprise", 1),
    ({"education", "tutoring", "learning"}, "enterprise", 1),
    ({"real-estate", "property"}, "enterprise", 1),
]

# Description keyword patterns for category
DESC_CATEGORY_PATTERNS = [
    (r'\b(?:search|retriev|find|lookup|query|RAG)\b', "search"),
    (r'\b(?:security|secur|authent|authoriz|encrypt|vulnerab|threat)\b', "security"),
    (r'\b(?:financ|bank|payment|trading|crypto|blockchain|escrow|defi)\b', "finance"),
    (r'\b(?:travel|flight|hotel|booking|trip|itinerary|tourism)\b', "travel"),
    (r'\b(?:image|video|audio|media|generat.*image|text-to-speech)\b', "media-content"),
    (r'\b(?:code.*generat|generat.*code|coding|code review|program)\b', "code-generation"),
    (r'\b(?:data.*analy|analy.*data|visualization|dataset|analytics)\b', "data-analytics"),
    (r'\b(?:chatbot|conversational|dialog|conversation)\b', "conversational"),
    (r'\b(?:deploy|docker|kubernetes|infra|DevOps|CI/CD)\b', "infrastructure"),
    (r'\b(?:orchestrat|multi-agent|coordinat.*agent)\b', "orchestration"),
    (r'\b(?:SDK|library|framework|implementation|toolkit|boilerplate|template|starter|wrapper)\b', "utility"),
    (r'\b(?:[Ss]amples?|demo|example|tutorial|beginner|learning|101|playground|toy project|[Dd]ocs|documentation)\b', "utility"),
    (r'(?:文档|教学|入门|示例)', "utility"),  # CJK: docs, tutorial, beginner, example
    (r'\b(?:Agent Development Kit|ADK|SDK)\b', "utility"),
    (r'\b(?:protocol.*implementation|implementation.*protocol|protocol.*specification)\b', "utility"),
    (r'\b(?:testing|mocking|mock|test and interact)\b', "utility"),
    (r'\b(?:template|scaffold|boilerplate|starter)\b', "utility"),
    (r'\b(?:song|music|generat.*song|generat.*music|audio.*generat)\b', "media-content"),
    (r'\b(?:agent.*platform|platform.*agent|governance|aiops)\b', "infrastructure"),
    (r'\b(?:dashboard|monitoring|observability|grafana|prometheus)\b', "data-analytics"),
    (r'\b(?:gateway|proxy|middleware|router|routing)\b', "infrastructure"),
    (r'\b(?:registry|discover|catalog|directory)\b', "infrastructure"),
    (r'\b(?:legal|lawyer|law\s+firm|attorney|contract.*review)\b', "enterprise"),
]

# Special: business/commerce agents from Lifie.ai hub get "enterprise"
def is_lifie_business_agent(agent: dict) -> bool:
    provider = agent.get("provider", {})
    provider_name = provider.get("name", "")
    tags = agent.get("tags", [])
    return (
        "Lifie" in provider_name or "lifie" in provider.get("url", "")
    ) and ("business" in tags or "commerce" in tags)


def infer_category(agent: dict) -> str | None:
    """Infer category from available signals. Returns None if not confident."""
    candidates = Counter()

    tags = set(t.lower() for t in agent.get("tags", []))
    desc = agent.get("description", "")
    name = agent.get("name", "").lower()
    slug = agent.get("slug", "").lower()

    # Special case: Lifie.ai business agents → enterprise
    if is_lifie_business_agent(agent):
        return "enterprise"

    # 1. Tag-based rules (strong signal, weight=3)
    for tag_set, category, min_matches in TAG_CATEGORY_RULES:
        matches = len(tags & tag_set)
        if matches >= min_matches:
            candidates[category] += 3 * matches

    # 2. Description patterns (medium signal, weight=2)
    for pattern, category in DESC_CATEGORY_PATTERNS:
        if re.search(pattern, desc, re.IGNORECASE):
            candidates[category] += 2

    # 3. Skill tags (medium signal, weight=2)
    for skill in agent.get("skills", []):
        skill_tags = set(t.lower() for t in skill.get("tags", []))
        for tag_set, category, min_matches in TAG_CATEGORY_RULES:
            matches = len(skill_tags & tag_set)
            if matches >= min_matches:
                candidates[category] += 2

    # 4. Name/slug patterns (weak signal, weight=1)
    combined = f"{name} {slug}"
    if re.search(r'search|retriev|rag', combined):
        candidates["search"] += 1
    if re.search(r'secur|auth', combined):
        candidates["security"] += 1
    if re.search(r'financ|bank|trade|crypto', combined):
        candidates["finance"] += 1
    if re.search(r'travel|flight|hotel|trip', combined):
        candidates["travel"] += 1
    if re.search(r'media|image|video|audio', combined):
        candidates["media-content"] += 1
    if re.search(r'code|coding|dev', combined):
        candidates["code-generation"] += 1
    if re.search(r'data|analy', combined):
        candidates["data-analytics"] += 1
    if re.search(r'chat|convers', combined):
        candidates["conversational"] += 1
    if re.search(r'orchestrat|multi.?agent', combined):
        candidates["orchestration"] += 1
    if re.search(r'deploy|infra|devops|docker|k8s', combined):
        candidates["infrastructure"] += 1

    # For "official-sample" tagged agents, they're typically "utility" (sample/demo)
    if "official-sample" in tags:
        candidates["utility"] += 2

    # Name/slug patterns for utility (template, sample, demo, etc.)
    if re.search(r'template|sample|demo|starter|scaffold|boilerplate|hello.?world', combined):
        candidates["utility"] += 2

    if not candidates:
        return None

    # Need minimum score of 2
    top = candidates.most_common(1)[0]
    if top[1] < 2:
        return None

    return top[0]


# ============================================================
# Framework inference
# ============================================================

# Patterns to detect frameworks from description, tags, name, repo
FRAMEWORK_DETECTION = [
    # (patterns to search in text, framework name)
    (r'\b(?:google[- ]?adk|agent[- ]?development[- ]?kit)\b', "google-adk"),
    (r'\badk\b', "google-adk"),  # weaker, needs supporting signal
    (r'\blanggraph\b', "langgraph"),
    (r'\blangchain\b', "langchain"),
    (r'\bcrewai\b', "crewai"),
    (r'\bcrew[- ]?ai\b', "crewai"),
    (r'\bspring[- ]?boot\b', "spring-boot"),
    (r'\bspring[- ]?ai\b', "spring-boot"),
    (r'\bspringframework\b', "spring-boot"),
    (r'\bspringboot\b', "spring-boot"),
    (r'\bautogen\b', "autogen"),
    (r'\bag2\b', "autogen"),
    (r'\bsemantic[- ]?kernel\b', "semantic-kernel"),
    (r'\bllama[- ]?index\b', "llamaindex"),
    (r'\bllamaindex\b', "llamaindex"),
    (r'\bfastapi\b', "fastapi"),
    (r'\bnestjs\b', "nestjs"),
    (r'\bgenkit\b', "genkit"),
    (r'\bopenai[- ]?agents?\b', "openai-agents"),
    (r'\bopenai[- ]?agent[- ]?sdk\b', "openai-agents"),
    (r'\bpydantic[- ]?ai\b', "pydantic-ai"),
    (r'\bstrands[- ]?agents?\b', "strands-agents"),
]

# Tags that directly indicate framework
TAG_TO_FRAMEWORK = {
    "adk": "google-adk",
    "adk-google": "google-adk",
    "adk-python": "google-adk",
    "google-adk": "google-adk",
    "langgraph": "langgraph",
    "langchain": "langchain",
    "crewai": "crewai",
    "crew-ai": "crewai",
    "spring": "spring-boot",
    "spring-boot": "spring-boot",
    "springboot": "spring-boot",
    "springboot3": "spring-boot",
    "springframework": "spring-boot",
    "spring-ai": "spring-boot",
    "autogen": "autogen",
    "ag2": "autogen",
    "semantic-kernel": "semantic-kernel",
    "llamaindex": "llamaindex",
    "llama-index": "llamaindex",
    "fastapi": "fastapi",
    "nestjs": "nestjs",
    "genkit": "genkit",
    "openai-agents-sdk": "openai-agents",
    "openai-agent-sdk": "openai-agents",
    "openai-agents": "openai-agents",
    "pydantic-ai": "pydantic-ai",
    "strands-agents": "strands-agents",
    "strands": "strands-agents",
}


def infer_framework(agent: dict) -> str | None:
    """Infer framework from available signals. Returns None if not confident."""
    candidates = Counter()

    tags = agent.get("tags", [])
    desc = agent.get("description", "")
    name = agent.get("name", "")
    slug = agent.get("slug", "")
    repo = agent.get("repository", "")

    # Combine all text sources
    all_text = f"{name} {slug} {desc} {repo}"

    # 1. Tag-based (strong signal, weight=3)
    for tag in tags:
        tag_lower = tag.lower()
        if tag_lower in TAG_TO_FRAMEWORK:
            candidates[TAG_TO_FRAMEWORK[tag_lower]] += 3

    # 2. Text-based patterns in description/name/slug/repo (medium signal, weight=2)
    for pattern, framework in FRAMEWORK_DETECTION:
        if re.search(pattern, all_text, re.IGNORECASE):
            candidates[framework] += 2

    # 3. Official sample description parsing
    if "Official A2A" in desc:
        # e.g., "Official A2A python sample agent: Crewai"
        sample_name = desc.split(":")[-1].strip().lower() if ":" in desc else ""
        for pattern, framework in FRAMEWORK_DETECTION:
            if re.search(pattern, sample_name, re.IGNORECASE):
                candidates[framework] += 4

    if not candidates:
        return None

    # Need minimum score of 2
    top = candidates.most_common(1)[0]
    if top[1] < 2:
        return None

    # Handle ambiguity: "adk" alone is weak, need at least 4 for google-adk
    # unless explicitly tagged
    if top[0] == "google-adk" and top[1] < 3:
        # Check if there's a stronger "adk" signal
        has_adk_tag = any(t.lower() in ("adk", "adk-google", "adk-python", "google-adk") for t in tags)
        if not has_adk_tag:
            return None

    return top[0]


# ============================================================
# Main enrichment logic
# ============================================================

def enrich_agents():
    """Read all agent JSON files, enrich, and write back."""
    files = sorted(glob.glob(str(AGENTS_DIR / "*.json")))
    print(f"Found {len(files)} agent files\n")

    stats = {
        "language_changed": 0,
        "category_changed": 0,
        "framework_changed": 0,
        "files_modified": 0,
        "language_details": Counter(),
        "category_details": Counter(),
        "framework_details": Counter(),
        "language_still_unknown": 0,
        "category_still_general": 0,
        "framework_still_custom": 0,
    }

    changes_log = []

    for filepath in files:
        with open(filepath, "r", encoding="utf-8") as f:
            agent = json.load(f)

        modified = False
        slug = agent.get("slug", os.path.basename(filepath))
        file_changes = []

        # 1. Enrich language
        if agent.get("language") == "unknown":
            new_lang = infer_language(agent)
            if new_lang:
                old = agent["language"]
                agent["language"] = new_lang
                modified = True
                stats["language_changed"] += 1
                stats["language_details"][new_lang] += 1
                file_changes.append(f"  language: {old} -> {new_lang}")
            else:
                stats["language_still_unknown"] += 1

        # 2. Enrich category
        if agent.get("category") == "general":
            new_cat = infer_category(agent)
            if new_cat:
                old = agent["category"]
                agent["category"] = new_cat
                modified = True
                stats["category_changed"] += 1
                stats["category_details"][new_cat] += 1
                file_changes.append(f"  category: {old} -> {new_cat}")
            else:
                stats["category_still_general"] += 1

        # 3. Enrich framework
        if agent.get("framework") == "custom":
            new_fw = infer_framework(agent)
            if new_fw:
                old = agent["framework"]
                agent["framework"] = new_fw
                modified = True
                stats["framework_changed"] += 1
                stats["framework_details"][new_fw] += 1
                file_changes.append(f"  framework: {old} -> {new_fw}")
            else:
                stats["framework_still_custom"] += 1

        # Write back if modified
        if modified:
            stats["files_modified"] += 1
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(agent, f, indent=2, ensure_ascii=False)
                f.write("\n")
            changes_log.append(f"{slug}:")
            changes_log.extend(file_changes)

    # Print detailed changes
    print("=" * 60)
    print("CHANGES MADE")
    print("=" * 60)
    for line in changes_log:
        print(line)

    # Print summary
    print()
    print("=" * 60)
    print("SUMMARY")
    print("=" * 60)
    print(f"Total files processed: {len(files)}")
    print(f"Files modified: {stats['files_modified']}")
    print()

    print(f"Language changes: {stats['language_changed']}")
    if stats["language_details"]:
        for lang, count in stats["language_details"].most_common():
            print(f"  -> {lang}: {count}")
    print(f"  Still unknown: {stats['language_still_unknown']}")
    print()

    print(f"Category changes: {stats['category_changed']}")
    if stats["category_details"]:
        for cat, count in stats["category_details"].most_common():
            print(f"  -> {cat}: {count}")
    print(f"  Still general: {stats['category_still_general']}")
    print()

    print(f"Framework changes: {stats['framework_changed']}")
    if stats["framework_details"]:
        for fw, count in stats["framework_details"].most_common():
            print(f"  -> {fw}: {count}")
    print(f"  Still custom: {stats['framework_still_custom']}")


if __name__ == "__main__":
    enrich_agents()
