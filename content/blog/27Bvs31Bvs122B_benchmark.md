---
title: "Qwen3.6-27B vs Gemma4-31B vs Qwen3.5-122B"
date: 2026-07-27T12:00:00Z
publishDate: 2026-07-27T12:00:00Z
draft: false
tags: ["llm", "llama.cpp", "benchmark", "qwen", "gemma"]
summary: "Do Gemma4-31B or Qwen3.5-122B beat Qwen3.6-27B in any meaningful way?"
cardImage: "cardimage.png"
---

{{< ctx-bar >}}
<span><strong>Tested in this article:</strong> Qwen3.6-27B Q8_0, Gemma4-31B Q8_0, Qwen3.5-122B Q4_K_M </span>

<span><strong>Hardware:</strong> 2× RTX 3090 · 48 GB VRAM, 96 GB DDR4  </span>
<span><strong>OS:</strong> Debian 13  </span>
<span><strong>Engine:</strong> llama.cpp  </span>
<span><strong>Benchmarks:</strong> BFCL v4, MMLU-Pro, IFEval, Arena-Hard, Word500</span>
{{< /ctx-bar >}}

<details>
<summary><strong>📊 Expand Model llama-server Config</strong></summary>

```sh
  Qwen3.5-122B-Q4_K_M:
    cmd: >
      /usr/local/bin/llama-server
      --port ${PORT}
      --model /models/Qwen3.5-122B-A10B-Q4_K_M-00001-of-00003.gguf
      --mmproj /models/qwen3.5-122b/mmproj-BF16.gguf
      --ctx-size 64000
      --flash-attn on
      --cache-type-k q8_0
      --cache-type-v q8_0
      --ubatch-size 512
      --split-mode layer
      --parallel 1
      --spec-type ngram-mod
```

``` sh
  gemma4-31b-Q8:
    cmd: >
      /usr/local/bin/llama-server
      --port ${PORT}
      --model /models/gemma-4-31B-it-Q8_0.gguf
      --model-draft /models/mtp-gemma-4-31B-it.gguf
      --mmproj /models/mmproj-BF16.gguf
      --n-gpu-layers 99
      --ctx-size 64000
      --flash-attn on
      --spec-type draft-mtp,ngram-mod
      --spec-draft-n-max 2
      --ubatch-size 512
      --split-mode tensor
      --fit off
      --parallel 1
```

```sh
  Qwen3.6-27B-Q8:
    cmd: >
      /usr/local/bin/llama-server
      --port ${PORT}
      --model /models/Qwen3.6-27B-Q8_0.gguf
      --mmproj /models/mmproj-Q8_0.gguf
      --n-gpu-layers 99
      --ctx-size 64000
      --flash-attn on
      --ubatch-size 512
      --spec-type draft-mtp,ngram-mod
      --spec-draft-n-max 2
      --split-mode tensor
      --fit off
      --parallel 1
```

</details>

## Intro
<br>
I often see claims that Gemma4-31b is so much better than Qwen3.6-27b. Such claims range from 27b looping to failing tool calls. Just as often, folks assert that Qwen3.5-122b is still the best model for tool calling consistency and coding. Neither of these sentiments match my personal experience, so I figured it was time to document some concrete comparisons. No vibes, only objective results. (Okay maybe a couple vibes but only at the end I promise.)

Caveat before we begin: I'm well aware running 122b at a 4bit quant with Q8 kv isn't giving it the best chance, but considering Q8_0 comes in at a cool ~130gb I genuinely don't think its worth considering in this discussion. My biggest focus is what I can run at home, and while I technically have 144gb ram combined I'm not interested in waiting many hours as a response crawls in the single digit decode (not even to mention the prefill freeze). I'd also imagine anyone with the requisite VRAM would be running Deepseek V4 Flash instead at this point. I also will not be doing the full count for each benchmark, so these results won't be comparable with the leaderboards. I simply don't want to run tests for a week. I'll mention how many tests were run for each benchmark.

## Traditional Benchmarks

### BFCL v4

**Details:** 50 samples, 6 test subsets → 300 samples total

My first priority is tool calling. My biggest complaint with Gemma4-31b is its apparent lack of desire to chain tool calls in my local use-cases. The Berkeley Function-Calling Leaderboard (BFCL) tool calling benchmark is the perfect place to get some understanding. The results showed only small deviation — not enough to exceed the confidence interval. These three models appear to be just about equal in this space. The gaps between 31B and 27B in Irrelevance and Live Multiple tests directly contradict my personal experiences. I'll get more into why in my personal benchmarks.

<img src="bfcl_v4_overall.png">
<img src="bfcl_v4_subsets.png">

<details>
<summary><strong>📊 Expand Data Tables</strong></summary>

#### Overall Accuracy

| Model | Overall Acc | Samples | Avg Latency (s) |
|---|---|---|---|
| Qwen3.6-27B-Q8 | 86.7% | 300 | 33.6 |
| Qwen3.5-122B-Q4_M | 85.7% | 300 | 78.1 |
| Gemma4-31B-Q8 | 84.7% | 300 | 12.5 |

#### By Subset

| Subset | Gemma4-31B-Q8 | Qwen3.6-27B-Q8 | Qwen3.5-122B-Q4_M |
|---|---|---|---|
| Irrelevance (hallucination) | 78.0% | 94.0% | 92.0% |
| Live Multiple (web search) | 90.0% | 78.0% | 84.0% |
| Multi-Turn Base | 58.0% | 64.0% | 50.0% |
| Multiple (function calls) | 94.0% | 98.0% | 98.0% |
| Parallel (concurrent calls) | 90.0% | 92.0% | 94.0% |
| Simple Python | 98.0% | 94.0% | 96.0% |

</details>

### IFEval

**Details:** 250 samples

The results of the Instruction-Following Evaluation were pretty middling with a marginally significant victory squeezed out by Gemma4-31B over the Qwens, which tied. One super interesting detail that does match my experience: Gemma4 uses notably fewer tokens for the same task. It averaged 21% fewer tokens on average (283 vs ~360).

<img src="ifeval.png">

<details>
<summary><strong>📊 Expand Data Tables</strong></summary>

| Model | Prompt-Level Strict | Inst-Level Strict | Prompt-Level Loose | Inst-Level Loose |
|---|---|---|---|---|
| Gemma4-31B-Q8 | 90.4% | 92.7% | 92.8% | 94.5% |
| Qwen3.5-122B-Q4_M | 85.6% | 90.9% | 88.4% | 93.0% |
| Qwen3.6-27B-Q8 | 85.2% | 90.5% | 88.4% | 93.2% |

</details>

### MMLU-Pro

**Details:** 30 samples, 14 categories → 420 samples total

MMLU's overall scores demonstrated a tie. Gemma4-31B did have a small accuracy lead, but definitely not significant at this test count. The latency differences were pretty notable and make sense. On my hardware, Gemma4-31B prefill and decode are a bit slower than Qwen3.6-27B, but it's so much more succinct with its responses/thinking that it makes up for it. There were some back and forths in individual categories.

<img src="mmlu_pro_overall.png">
<img src="mmlu_pro_categories.png">

<details>
<summary><strong>📊 Expand Data Tables</strong></summary>

#### Overall Scores

| Model | Mean Accuracy | Samples | Avg Latency (s) |
|---|---|---|---|
| Gemma4-31B-Q8 | 85.7% | 420 | 8.3 |
| Qwen3.6-27B-Q8 | 83.8% | 420 | 13.3 |
| Qwen3.5-122B-Q4_M | 83.1% | 420 | 44.4 |

#### By Category

| Category | Gemma4-31B-Q8 | Qwen3.6-27B-Q8 | Qwen3.5-122B-Q4_M |
|---|---|---|---|
| Computer Science | 96.7% | 93.3% | 96.7% |
| Math | 96.7% | 96.7% | 96.7% |
| Chemistry | 93.3% | 93.3% | 93.3% |
| Engineering | 90.0% | 83.3% | 83.3% |
| Biology | 96.7% | 93.3% | 93.3% |
| Physics | 93.3% | 96.7% | 96.7% |
| Psychology | 90.0% | 83.3% | 90.0% |
| Economics | 86.7% | 86.7% | 90.0% |
| Philosophy | 90.0% | 86.7% | 73.3% |
| Business | 83.3% | 86.7% | 83.3% |
| Health | 76.7% | 70.0% | 80.0% |
| Law | 76.7% | 70.0% | 70.0% |
| Other | 63.3% | 66.7% | 60.0% |
| History | 66.7% | 66.7% | 56.7% |

</details>

### Arena-Hard

**Details:** 75 samples, run with `--repeat-penalty 1.1 --min-p 0.05`, judge by Deepseek V4 Pro

Gemma4-31B squeezed an advantage with a marginally higher win rate and the least average output tokens. 122B did the worst in terms of win rate. Even considering Gemma's conciseness may be helping it with the judge and 122b only activates 10b, it being matched by models 1/4 its param count shows how substantial a couple months is in the LLM world right now. There were three super notable tests where Gemma aced it and the Qwens simply failed: JS deep object search, Python zip archiving, and yfinance data + plot.

<img src="arena_hard.png">

<details>
<summary><strong>📊 Expand Data Tables</strong></summary>

| Model | Win Rate | Samples | Avg Output Tokens |
|---|---|---|---|
| Gemma4-31B-Q8 | 98.8% | 75 | 1,871 |
| Qwen3.6-27B-Q8 | 94.7% | 75 | 4,237 |
| Qwen3.5-122B-Q4_M | 91.7% | 75 | 3,460 |

</details>

### HumanEval+ & MBPP+

**Details:** One pass each
- **HumanEval+:** 164 problems
- **MBPP+:** 378 problems

MBPP+ failed to differentiate the three models. All three are likely nearly saturated on that difficulty. On the other hand, Qwen3.6-27B really did not hold its own against the more expanded edge-case tests in HumanEval+. Qwen3.5-122B did quite well, and Gemma4-31B held a smaller but noteworthy 3.1% gap above. I was quite surprised at how poorly 27B did on this test in comparison. Most of the time, this is the exact context in which people claim it's superior.

<img src="humaneval_plus.png">
<img src="mbpp_plus.png">

<details>
<summary><strong>📊 Expand Data Tables</strong></summary>

#### Combined Comparison

| Benchmark | Gemma4-31B-Q8 | Qwen3.5-122B-Q4_M | Qwen3.6-27B-Q8 |
|---|---|---|---|
| HumanEval+ | 93.9% | 90.8% | 77.4% |
| MBPP+ | 95.2% | 94.2% | 94.2% |

#### HumanEval+ — pass@1 (164 problems)

| Model | pass@1 | Avg Latency (s) | Avg Output Tokens | Avg Output TPS |
|---|---|---|---|---|
| Gemma4-31B-Q8 | 93.9% | 2.1 | 192 | 91.1 |
| Qwen3.5-122B-Q4_M | 90.8% | 10.0 | 198 | 19.8 |
| Qwen3.6-27B-Q8 | 77.4% | 2.3 | 233 | 99.8 |

#### MBPP+ — pass@1 (378 problems)

| Model | pass@1 | Avg Latency (s) | Avg Output Tokens | Avg Output TPS |
|---|---|---|---|---|
| Gemma4-31B-Q8 | 95.2% | 7.7 | 506 | 66.1 |
| Qwen3.6-27B-Q8 | 94.2% | 2.6 | 207 | 80.4 |
| Qwen3.5-122B-Q4_M | 94.2% | 25.0 | 520 | 20.8 |

</details>

### Word500

My personal benchmark. For those who aren't familiar, see my more in-depth blog post covering this test: [The Word500 Benchmark](https://demietrich.com/blog/word500_benchmark/). It's a really good test of a model's reasoning capabilities and efficiency. I typically disregard speed on this benchmark. Going into this I knew from prior experience that Gemma4-31B would crush it, but I actually hadn't run it on Q8 before. All three models passed each test, but as expected Gemma crushed the Qwens in token efficiency. 122B used fewer tokens on average than 27B.

| Model | Run 1 | Run 2 | Run 3 | Run 4 | Run 5 | Avg Tokens |
|---|---|---|---|---|---|---|
| Qwen3.6-27B Q8_0 | Pass/28,098 | Pass/12,537 | Pass/28,005 | Pass/11,686 | Pass/13,142 | 18,693 |
| Qwen3.5-122B Q4_K_M | Pass/11,905 | Pass/14,651 | Pass/12,451 | Pass/13,261 | Pass/20,015 | 14,456 |
| Gemma4-31B Q8_0 | Pass/3,624 | Pass/4,851 | Pass/4,059 | Pass/5,450 | Pass/5,799 | 4,756 |

## Unstructured / Personal Tests

Thus far, the benchmarks have suggested that Gemma4-31B is simply the best choice between the three models. I'm really surprised because when I have tried it in my personal use-cases that hasn't been the case. This next section will focus on such use-cases.

### Open-WebUI Research Model

<img src="qwen-bench-loop.png">

For chat, I primarily use an Open-WebUI Docker container. I have a handful of models defined there, but the most important function of both my General and Deep Research models is the ability to search the web. I provide that tooling through a SearXNG/Firecrawl stack, and most specifically I expect the model to:

- Decide when it needs to `search_web`, either for missing or up-to-date knowledge.
- Decide `N`, how many results it should get based on query complexity.
- Look through snippets, pick the best one, and use `fetch_url` to get the full context.
- Loop this as many times needed to compile an informed response

I also like the Task function Open-WebUI provides. It lets the model `create_tasks` and `update_task` to track its own progress and display to the user the stage its on. This is not a crucial component, but a really nice to have feature.

Will any of these models outperform the others in this context?

#### Setup

For this section, I'll define three models in Open-WebUI - one for each of Gemma4-31B, Qwen3.6-27B, and Qwen3.5-122B. Each model will be provided the required tools, with Function Calling set to Native, and the following system prompt:

```plaintext 
- Current date: {{CURRENT_DATE}}

## Planning & Task Tracking
- Before acting, think through a concise plan of steps.
- Use "create_tasks" (plural) to publish that plan as a checklist immediately.
- Use "update_task" (singular) after completing each step - including the final one. Never skip the last "update_task" call.

## Web Search:
- use when the answer depends on current events, recent releases, prices,
  versions, or anything that may have changed since your cutoff - or when you're
  unsure of a fact. Don't search for stable knowledge you already hold. Ground your
  answer in the returned results and cite sources. If results are empty or weak, say
  so instead of guessing.

  - When using search_web, set the count parameter (1–3) proportional to query complexity:
  • 1: Simple facts, definitions, single-entity lookups
  • 2-3: More complex/niche topics or highly specific technical queries
  - After search_web ALWAYS select the most promising result and call fetch_url to extract deeper context
  ```

The prompts used were:

> **Prompt 1:** Search for a highly rated chocolate chip cookie recipe. Briefly summarize the author's included anecdotal story and tell me exactly how many grams of butter it uses, and what temperature it says to set the oven to.

> **Prompt 2:** Look up the 3 most popular Intel Core Ultra CPUs. Find the Passmark benchmark score and MSRP for each. Calculate the Price:Passmark ratio and the TDP:Passmark power efficiency ratios.

> **Prompt 3:** Find out who currently holds the outdoor world record in the men's 1 mile run, and identify the exact meet, venue, and date where it was set. Then, from a detailed report on that specific race, tell me: (a) the names of the pacemakers and roughly where in the race they dropped out, (b) the record-holder's split times at 800m and 1500m, and (c) exactly how many seconds the new mark beat the previous world record by.

Each was judged on the following criteria:

1. **Correctness** - It should get accurate, real answers before synthesizing a response.
2. **Efficiency** - It should set `N` to a logical value based on complexity and make no more search or fetch calls than necessary.
3. **Task generation** - Did it create a plan and generate tasks?

#### Results

**Gemma4-31B Q8_0**
|                | Cookies | Intel CPUs | Mile Run |
|----------------|---------|------------|------------|
| Pass/Fail      |  Pass   |     Pass*      |     Pass     |
| Output Tokens  |  1,843  |      6,239      |    2,225      |
| Correct        |   Yes   |      Yes      |      Yes      |
| Search/Fetch count | 1/1 | 8/2 | 2/2 |
| Search `N` considered? | No | No | No |
| Tasks opened/closed? | Opened, none closed | Opened, none closed | Opened, none closed |

\* *The Intel CPUs prompt took two tries to reach success. The first attempt blasted through 17 searches, then simply ended the response with a thought block containing "The".*

**Qwen3.6-27B Q8_0**
|                | Cookies | Intel CPUs | Mile Run |
|----------------|---------|------------|------------|
| Pass/Fail      |  Pass   |     Pass*      |     Pass     |
| Output Tokens  |  2,563  |      3,698      |    2,342      |
| Correct        |   Yes   |      Yes      |      Yes      |
| Search/Fetch count | 3/2 | 10/1 | 2/1 |
| Search `N` considered? | Yes | No | Yes |
| Tasks opened/closed? | No | No | No |

\* *Like Gemma4, the Intel CPU prompt failed the first run. Qwen did many searches then ended with a malformed tool call on the first try.*

**Qwen3.5-122B Q4_K_M**
|                | Cookies | Intel CPUs | Mile Run |
|----------------|---------|------------|------------|
| Pass/Fail      |  Pass   |     Pass      |     Pass     |
| Output Tokens  |  462  |      1,785      |    989      |
| Correct        |   Yes   |      Yes      |      Yes      |
| Search/Fetch count | 1/1 | 4/3 | 4/0\* |
| Search `N` considered? | Yes | Yes | Yes |
| Tasks opened/closed? | No | No | No |

\* *I guess my mile run prompt wasn't as snippet-resistant as I thought; somehow 122B got the answers without a fetch.*

These search query tests did not prove as useful or conclusive as I thought they would. In the past, when I've tried Gemma4-31B in this role, it was entirely reluctant to chain multiple tool calls of different kinds. It would `search_web` over and over and never follow up with a fetch. It would often simply tell me the information wasn't provided in the snippets, and try to force a conclusion from its own knowledge. Some of the quirks still remain, like how it refuses to supply an `N` for the search calls, or close open tasks it created, but overall it is plenty successful at the loop. I assume some of the changes must be attributed to Google's template improvements, though I had kept up with those in the past. The 122B Qwen3.5 was very efficient and controlled with the tool calls it made, even though it refused to interact with tasks just like Qwen3.6-27B did. I really like how 122B feels here, speed excluded. The lack of adherence to the `search_web` - `N` parameter and the sporadic spikes of a dozen-plus search calls do make Gemma4-31B a tough option for this, because it ends up sprinting toward a rate limit.

### Pelican on a Bicycle

Let's end on the classic silly "pelican on a bicycle" prompt to compare, why not.

> Generate an SVG of a pelican riding a bicycle

{{< figure src="pelican-bicycle.png" caption="SVG outputs from all three models: Qwen3.6-27B (top), Qwen3.5-122B (middle), Gemma4-31B (bottom)" >}}

I think these specific results speak for themselves - a pretty obvious gap on a likely "benchmaxxed" subjective test. 27B on top, followed by 122B, and Gemma4 dead last in a dramatic way.

{{< verdict >}}
<p class="verdict-lead">Conclusion</p>
Answer: on structured benchmarks, mostly no - except HumanEval+.

These models **are** close where it counts. Gemma4-31B seems to really have a lock on efficient thinking, takes the lead in a couple of notable benchmarks, and is never worse than tied. Qwen3.5-122B tends to match Qwen3.6-27B on most measurements. My takeaway here is that swapping 122B in for my Deep Research model may be a good idea: more knowledge, more methodical and efficient tool calls. It would also likely make a good planning model. Anywhere the speed sacrifice would be acceptable, 122B would fit nicely.

For standard day-to-day use, the benchmarks suggest a swap to Gemma4-31B Q8_0 would be intelligent. I'll have to just do so and get a feel for whether it gets better results over time than my current 27B daily driver. Just don't expect a good pelican SVG.
{{< /verdict >}}

